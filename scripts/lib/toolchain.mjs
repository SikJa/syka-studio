/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import extract from 'extract-zip';

// Immutable upstream artifacts, verified against upstream SHA256 checksums.
// FFmpeg is a retained month-end build. Downloads go straight to the user's PC;
// Syka does not redistribute this GPL binary as part of its installer.
export const windowsTools = Object.freeze([
  { id: 'node', names: ['node'], version: '24.14.1', format: 'zip',
    url: 'https://nodejs.org/dist/v24.14.1/node-v24.14.1-win-x64.zip',
    sha256: '6e50ce5498c0cebc20fd39ab3ff5df836ed2f8a31aa093cecad8497cff126d70',
    prefix: 'node-v24.14.1-win-x64', files: ['node.exe', 'LICENSE'], license: 'MIT and included third-party notices' },
  { id: 'ffmpeg', names: ['ffmpeg', 'ffprobe'], version: '8.1.3-9-g29e619e767', format: 'zip',
    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-09-30-13-08/ffmpeg-n8.1.3-9-g29e619e767-win64-gpl-shared-8.1.zip',
    sha256: 'dfe81c3aa0a546ee81980b1b824486dd0fe0a1d452f00cb55135379a74be7bcf',
    prefix: 'ffmpeg-n8.1.3-9-g29e619e767-win64-gpl-shared-8.1', files: ['bin/ffmpeg.exe', 'bin/ffprobe.exe', 'LICENSE.txt'], license: 'GPL-3.0-or-later (separate upstream executables)' },
  { id: 'yt-dlp', names: ['yt-dlp'], version: '2026.08.19', format: 'exe',
    url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp.exe',
    sha256: '66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a',
    prefix: '', files: ['yt-dlp.exe'], license: 'GPL-3.0-or-later (upstream standalone build)' },
]);
export function childPath(root, part) {
  const path = resolve(root, part), rel = relative(resolve(root), path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('Invalid tools directory.');
  return path;
}
export function validateTool(tool) {
  const url = new URL(tool.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || !['nodejs.org', 'github.com'].includes(url.hostname)
    || !/^[a-z][a-z0-9-]*$/.test(tool.id) || !/^[a-f0-9]{64}$/.test(tool.sha256)) throw Error('Invalid tool manifest.');
}
export async function downloadVerified(tool, output, fetcher = fetch, progress = () => {}) {
  validateTool(tool);
  const response = await fetcher(tool.url, { signal: AbortSignal.timeout(5 * 60_000), redirect: 'follow' });
  if (!response.ok || !response.body) throw Error(`Could not download ${tool.id}.`);
  const limit = 300 * 1024 * 1024;
  const size = Number(response.headers.get('content-length') || 0);
  if (size > limit) throw Error('Tool download is too large.');
  const hash = createHash('sha256'), reader = response.body.getReader();
  const { open } = await import('node:fs/promises');
  const handle = await open(output, 'wx'); let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      received += value.length; if (received > limit) throw Error('Tool download is too large.');
      hash.update(value); await handle.writeFile(value); progress(received, size);
    }
    if (size && size !== received) throw Error('Incomplete tool download.');
    if (hash.digest('hex') !== tool.sha256) throw Error('Tool checksum did not match.');
  } catch (error) {
    await reader.cancel().catch(() => {}); throw error;
  } finally { await handle.close(); }
}
export async function toolComplete(root, tool) {
  try {
    const dir = childPath(root, tool.id);
    const receipt = JSON.parse(await readFile(join(dir, 'syka-tool.json'), 'utf8'));
    if (receipt.sha256 !== tool.sha256) return false;
    // Verify installed files too, so a corrupt/truncated executable can be repaired.
    for (const [name, hash] of Object.entries(receipt.files)) {
      const bytes = await readFile(childPath(dir, name));
      if (createHash('sha256').update(bytes).digest('hex') !== hash) return false;
    }
    return tool.files.every(file => existsSync(childPath(dir, file)));
  } catch { return false; }
}
const installations = new Map();
export function installTool(root, tool, options = {}) {
  const key = childPath(root, tool.id);
  const running = installations.get(key); if (running) return running;
  const task = performInstall(root, tool, options).finally(() => installations.delete(key));
  installations.set(key, task); return task;
}
async function performInstall(root, tool, { fetcher, progress, extractor = extract } = {}) {
  validateTool(tool); await mkdir(root, { recursive: true });
  if (await toolComplete(root, tool)) return;
  const stage = childPath(root, `.stage-${tool.id}-${randomUUID()}`);
  const download = childPath(root, `.download-${tool.id}-${randomUUID()}`);
  const old = childPath(root, `.previous-${tool.id}-${randomUUID()}`);
  const dest = childPath(root, tool.id); let backedUp = false, promoted = false;
  await mkdir(stage);
  try {
    await downloadVerified(tool, download, fetcher, progress);
    if (tool.format === 'exe') await copyFile(download, join(stage, `${tool.id}.exe`));
    else {
      const unpack = childPath(stage, '.unpack'); await mkdir(unpack);
      await extractor(download, { dir: unpack });
      const source = childPath(unpack, tool.prefix);
      for (const file of tool.files) {
        const target = childPath(stage, file); await mkdir(dirname(target), { recursive: true });
        await copyFile(childPath(source, file), target);
      }
      // Shared FFmpeg requires all adjacent DLLs, not just its two executables.
      if (tool.id === 'ffmpeg') for (const entry of await readdir(join(source, 'bin'), { withFileTypes: true })) {
        if (entry.isFile() && /\.dll$/i.test(entry.name)) await copyFile(join(source, 'bin', entry.name), join(stage, 'bin', entry.name));
      }
      await rm(unpack, { recursive: true, force: true });
    }
    const hashes = {};
    const files = [...tool.files, ...(tool.id === 'ffmpeg' ? (await readdir(join(stage, 'bin'))).filter(name => /\.dll$/i.test(name)).map(name => `bin/${name}`) : [])];
    for (const name of files) hashes[name] = createHash('sha256').update(await readFile(childPath(stage, name))).digest('hex');
    await writeFile(join(stage, 'syka-tool.json'), JSON.stringify({ version: tool.version, sha256: tool.sha256, source: tool.url, license: tool.license, files: hashes }, null, 2));
    if (existsSync(dest)) { await rename(dest, old); backedUp = true; }
    await rename(stage, dest); promoted = true;
    if (backedUp) await rm(old, { recursive: true, force: true });
  } catch (error) {
    if (backedUp && !promoted && !existsSync(dest)) await rename(old, dest);
    throw error;
  } finally {
    await rm(download, { force: true }); await rm(stage, { recursive: true, force: true });
  }
}
