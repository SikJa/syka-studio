/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brandedElectron } from './branded-electron.mjs';

// A separate development profile and server. No installer, update feed or
// personal project is used. Keep Vite alive across Electron's real relaunch.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runtime = join(root, '.runtime', 'update-demo');
const qa = process.argv.includes('--qa');
const port = 5198, mcpPort = 6295, url = `http://localhost:${port}`;
const children = [];
let stopping = false;
const env = { ...process.env, SYKA_DEV_RUN: '1', SYKA_UPDATE_DEMO: '1', SYKA_UPDATE_DEMO_APPLIED: '',
  SYKA_RUNTIME_ROOT: runtime, SYKA_MEDIA_ROOT: join(runtime, 'projects'), SYKA_DEV_PORT: String(port),
  SYKA_DEV_URL: url, SYKA_MCP_PORT: String(mcpPort), TEMP: join(runtime, 'temp'), TMP: join(runtime, 'temp') };
delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
for (const path of [runtime, env.TEMP, env.SYKA_MEDIA_ROOT]) mkdirSync(path, { recursive: true });
async function free(port) {
  await new Promise((done, reject) => {
    const server = createServer(); server.once('error', reject);
    server.listen({ port, host: 'localhost' }, () => server.close(done));
  });
}
function start(command, args, cwd = root, shell = false, visible = false) {
  const child = spawn(command, args, { cwd, env, shell, stdio: 'inherit', windowsHide: !visible });
  children.push(child); child.on('error', error => { console.error(error.message); shutdown(1); });
  return child;
}
function shutdown(code = 0) {
  if (stopping) return; stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 400);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown());
async function build(script) {
  const child = start(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script, '--workspace=@diffusionstudio/desktop'], root, process.platform === 'win32');
  await new Promise((done, reject) => child.once('exit', code => code === 0 ? done() : reject(Error(`Build failed: ${script}`))));
}
try {
  for (const candidate of [port, mcpPort, ...(qa ? [9260, 9261] : [])]) await free(candidate);
  if (!process.argv.includes('--no-build')) for (const script of ['build:main', 'build:preload', 'build:agent-host']) await build(script);
  const vite = start(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort'], join(root, 'apps/web'));
  vite.once('exit', code => { if (!stopping) shutdown(code || 1); });
  const deadline = Date.now() + 60_000;
  while (!await fetch(url).then(response => response.ok).catch(() => false)) {
    if (Date.now() > deadline) throw Error('The update preview server did not start.');
    await new Promise(done => setTimeout(done, 300));
  }
  const args = [...(qa ? ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9260', '--inspect=127.0.0.1:9261'] : []), join(root, 'apps/desktop')];
  const electron = start(await brandedElectron(root, resolve(root, '..', '.runtime', 'diffusion')), args, root, false, true);
  writeFileSync(join(runtime, 'launch.json'), JSON.stringify({ parentPid: process.pid, electronPid: electron.pid, vitePid: vite.pid, url, runtime, qa }, null, 2));
  console.log(`Update simulation at ${url}; isolated profile ${runtime}. Ctrl+C stops the preview server.`);
  electron.once('exit', code => {
    if (code && !stopping) shutdown(code);
    // A successful exit can be an intentional restart from the update UI.
  });
} catch (error) { console.error(error.message); shutdown(1); }
