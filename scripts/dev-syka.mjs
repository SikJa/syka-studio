/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from 'node:http';
import { brandedElectron } from './branded-electron.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.SYKA_RUNTIME_ROOT || resolve(root, '..', '.runtime', 'diffusion');
const port = Number(process.env.SYKA_DEV_PORT || 5188);
const url = `http://localhost:${port}`;
const env = { ...process.env, SYKA_DEV_RUN: '1', SYKA_RUNTIME_ROOT: runtime, SYKA_DEV_PORT: String(port), SYKA_DEV_URL: url,
  SYKA_MEDIA_ROOT: process.env.SYKA_MEDIA_ROOT || join(runtime, 'projects'),
  TEMP: join(runtime, 'temp'), TMP: join(runtime, 'temp'), SKIP_SIGN: '1',
  npm_config_cache: resolve(root, '..', '.runtime', 'npm-cache'), ELECTRON_CACHE: resolve(root, '..', '.runtime', 'electron-cache') };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
// Electron's resolver may invoke its installer inside THIS Node process.
for (const name of ['ELECTRON_CACHE', 'npm_config_cache', 'TEMP', 'TMP']) process.env[name] = env[name];
for (const path of [runtime, env.TEMP, env.SYKA_MEDIA_ROOT]) mkdirSync(path, { recursive: true });
const children = [];
let stopping = false;
function start(command, args, cwd = root, shell = false) {
  const child = spawn(command, args, { cwd, env, stdio: 'inherit', shell, windowsHide: true });
  children.push(child);
  child.on('error', error => { console.error(error); shutdown(1); });
  return child;
}
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 400);
}
function completed(child) { return new Promise((resolve, reject) => child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Build exited ${code}`)))); }
function probe() { return new Promise(resolve => {
  const req = get(url, res => { res.resume(); resolve(true); });
  req.on('error', () => resolve(false)); req.setTimeout(1000, () => { req.destroy(); resolve(false); });
}); }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown());
if (await probe()) throw new Error(`Port ${port} already has a server. No unrelated process will be stopped.`);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
try {
  await completed(start(npm, ['run', 'build', '--workspace=@diffusionstudio/cli'], root, process.platform === 'win32'));
  await completed(start(npm, ['run', 'build', '--workspace=@diffusionstudio/desktop'], root, process.platform === 'win32'));
  const web = start(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort'], join(root, 'apps/web'));
  web.on('exit', code => { if (!stopping) shutdown(code || 1); });
  const deadline = Date.now() + 60000;
  while (!(await probe())) {
    if (Date.now() > deadline) throw new Error('Syka UI did not start.');
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  const require = createRequire(import.meta.url);
  // Opt-in loopback debugging for local UI verification; normal launches stay closed.
  const debugPort = Number(process.env.SYKA_QA_CDP_PORT || 0);
  if (debugPort && (!Number.isInteger(debugPort) || debugPort < 1024 || debugPort > 65535)) {
    throw new Error('SYKA_QA_CDP_PORT must be an integer between 1024 and 65535.');
  }
  const electronArgs = debugPort
    ? [`--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=${debugPort}`, join(root, 'apps/desktop')]
    : [join(root, 'apps/desktop')];
  const electron = start(await brandedElectron(root, runtime), electronArgs);
  writeFileSync(join(runtime, 'launch.json'), JSON.stringify({ parentPid: process.pid, electronPid: electron.pid, vitePid: web.pid, url, runtime, mediaRoot: env.SYKA_MEDIA_ROOT }, null, 2));
  console.log(`Syka Studio running at ${url}; Electron PID ${electron.pid}`);
  electron.on('exit', code => shutdown(code || 0));
} catch (error) { console.error(error); shutdown(1); }
