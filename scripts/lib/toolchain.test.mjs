import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { childPath, downloadVerified, installTool, toolComplete, validateTool, windowsTools } from './toolchain.mjs';
const body = Buffer.from('downloaded fixture bytes');
function manifest(overrides = {}) { return { id: 'yt-dlp', names: ['yt-dlp'], version: 'fixture', format: 'exe', prefix: '', files: ['yt-dlp.exe'], license: 'fixture',
  url: 'https://github.com/yt-dlp/yt-dlp/releases/download/fixture/yt-dlp.exe', sha256: createHash('sha256').update(body).digest('hex'), ...overrides }; }
const fakeFetch = async () => new Response(body, { headers: { 'content-length': String(body.length) } });
async function fixture(run) { const root = await mkdtemp(join(tmpdir(), 'syka-tools-test-')); try { await run(root); } finally { await rm(root, { recursive: true, force: true }); } }

test('all pinned tools have valid HTTPS provenance and hashes', () => {
  for (const tool of windowsTools) validateTool(tool);
  assert.deepEqual(windowsTools.map(tool => tool.id), ['node', 'ffmpeg', 'yt-dlp']);
});
test('rejects paths escaping the managed tools root and invalid provenance', () => {
  for (const part of ['../another', '.', '../../Windows']) assert.throws(() => childPath('/tools', part));
  for (const url of ['http://github.com/owner/repo/file', 'https://user:password@github.com/owner/repo/file', 'https://attacker.example/tool.exe']) assert.throws(() => validateTool(manifest({ url })));
  assert.throws(() => validateTool(manifest({ id: '../escape' })));
});
test('verifies stream integrity before accepting executable data', async () => fixture(async root => {
  const output = join(root, 'received'); const events = [];
  await downloadVerified(manifest(), output, fakeFetch, bytes => events.push(bytes));
  assert.deepEqual(await readFile(output), body); assert.equal(events.at(-1), body.length);
  await assert.rejects(downloadVerified(manifest({ sha256: '0'.repeat(64) }), join(root, 'bad'), fakeFetch), /checksum/);
  await assert.rejects(downloadVerified(manifest(), join(root, 'missing'), async () => new Response('', { status: 404 })), /download/);
  await assert.rejects(downloadVerified(manifest(), join(root, 'too-big'), async () => new Response(body, { headers: { 'content-length': '400000000' } })), /large/);
}));
test('deduplicates installation, keeps provenance, cleans downloads and reuses verified files', async () => fixture(async root => {
  let requests = 0; const fetcher = async () => { requests++; return fakeFetch(); };
  const tool = manifest(); await Promise.all([installTool(root, tool, { fetcher }), installTool(root, tool, { fetcher })]);
  assert.equal(requests, 1); assert.equal(await toolComplete(root, tool), true);
  const receipt = JSON.parse(await readFile(join(root, tool.id, 'syka-tool.json'), 'utf8'));
  assert.equal(receipt.sha256, tool.sha256); assert.equal(receipt.source, tool.url);
  await installTool(root, tool, { fetcher }); assert.equal(requests, 1);
  assert.deepEqual(await readdir(root), ['yt-dlp']);
}));
test('failed integrity never replaces an existing tool and can retry', async () => fixture(async root => {
  await mkdir(join(root, 'yt-dlp')); await writeFile(join(root, 'yt-dlp', 'yt-dlp.exe'), 'previous installation');
  await assert.rejects(installTool(root, manifest(), { fetcher: async () => new Response('wrong bytes') }), /checksum/);
  assert.equal(await readFile(join(root, 'yt-dlp', 'yt-dlp.exe'), 'utf8'), 'previous installation');
  assert.deepEqual(await readdir(root), ['yt-dlp']);
  await installTool(root, manifest(), { fetcher: fakeFetch }); assert.equal(await toolComplete(root, manifest()), true);
}));
test('detects damaged installed files and repairs without trusting the receipt alone', async () => fixture(async root => {
  await installTool(root, manifest(), { fetcher: fakeFetch });
  await writeFile(join(root, 'yt-dlp', 'yt-dlp.exe'), 'damaged');
  assert.equal(await toolComplete(root, manifest()), false);
  await installTool(root, manifest(), { fetcher: fakeFetch }); assert.equal(await toolComplete(root, manifest()), true);
}));
test('shared FFmpeg keeps both executables, license and DLLs, excluding other files', async () => fixture(async root => {
  const tool = manifest({ id: 'ffmpeg', format: 'zip', prefix: 'ffmpeg-fixture', files: ['bin/ffmpeg.exe', 'bin/ffprobe.exe', 'LICENSE.txt'] });
  const extractor = async (_, { dir }) => {
    const source = join(dir, tool.prefix); await mkdir(join(source, 'bin'), { recursive: true });
    for (const name of ['ffmpeg.exe', 'ffprobe.exe', 'avcodec.dll', 'unused.txt']) await writeFile(join(source, 'bin', name), name);
    await writeFile(join(source, 'LICENSE.txt'), 'fixture license');
  };
  await installTool(root, tool, { fetcher: fakeFetch, extractor });
  assert.deepEqual((await readdir(join(root, 'ffmpeg', 'bin'))).sort(), ['avcodec.dll', 'ffmpeg.exe', 'ffprobe.exe']);
  assert.equal(await toolComplete(root, tool), true); assert.deepEqual(await readdir(root), ['ffmpeg']);
}));
