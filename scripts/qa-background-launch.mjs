// Isolated real Electron app. Does not overwrite apps/desktop/dist or stop any
// shared listener. Ctrl+C stops only the PIDs this launcher creates.
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createConnection } from 'node:net';
const require = createRequire(import.meta.url), root = resolve('.');
const qa = join(root, '.runtime/background-ui-qa'), appDir = join(qa, 'desktop'), runtime = join(qa, 'ui-runtime');
const ports = { web: 5417, cdp: 9367, mcp: 3397 };
const busy = port => new Promise(done => { const socket = createConnection({ port, host: '127.0.0.1' }); socket.once('connect', () => { socket.destroy(); done(true); }); socket.once('error', () => done(false)); });
for (const port of Object.values(ports)) if (await busy(port)) throw Error(`QA port ${port} is occupied. No process was stopped.`);
await Promise.all([join(appDir, 'dist'), join(appDir, 'syka-assets'), runtime].map(p => mkdir(p, { recursive: true })));
await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'syka-background-isolated-qa', version: '0.207.0', main: 'dist/main.js' }));
await copyFile(join(root, 'apps/desktop/syka-assets/icon.png'), join(appDir, 'syka-assets/icon.png'));
await build({ entryPoints: [join(root, 'apps/desktop/src/main.ts')], outfile: join(appDir, 'dist/main.js'), bundle: true, platform: 'node', format: 'cjs', external: ['electron', 'esbuild', '@babel/core', '@babel/preset-typescript', 'babel-preset-solid'] });
await build({ entryPoints: [join(root, 'apps/desktop/src/preload.ts')], outfile: join(appDir, 'dist/preload.js'), bundle: true, platform: 'node', format: 'cjs', external: ['electron'] });
await build({ entryPoints: [join(root, 'packages/agent-chat/src/bin.ts')], outfile: join(appDir, 'dist/agent-host.mjs'), bundle: true, platform: 'node', format: 'esm', external: ['electron', 'playwright-core'], banner: { js: "import { createRequire as __qaRequire } from 'node:module'; const require = __qaRequire(import.meta.url);" } });
const env = { ...process.env, SYKA_DEV_PORT: String(ports.web), SYKA_DEV_URL: `http://127.0.0.1:${ports.web}`, SYKA_RUNTIME_ROOT: runtime, SYKA_MEDIA_ROOT: join(runtime, 'projects'), SYKA_MCP_PORT: String(ports.mcp), SYKA_CODE_GRAPH_ROOT: root, SYKA_BACKGROUND_MODULES: join(root, '.runtime/background-removal/node_modules'), SYKA_BACKGROUND_RUNNER: join(root, 'scripts/background-removal-runner.mjs') };
delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
let stopping = false;
const children = [];
function stop() {
  if (stopping) return; stopping = true;
  for (const child of children) if (child.pid && child.exitCode === null) {
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(), 500);
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
function start(command, args, cwd) { const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: 'inherit' }); children.push(child); child.on('error', stop); child.on('exit', stop); return child; }
const vite = start(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(ports.web), '--strictPort'], join(root, 'apps/web'));
const deadline = Date.now() + 60000;
while (!await busy(ports.web)) { if (Date.now() > deadline) { stop(); throw Error('Vite QA timeout'); } await new Promise(r => setTimeout(r, 200)); }
const electron = start(require('electron'), ['--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${ports.cdp}`, appDir], root);
await writeFile(join(qa, 'ui-launch.json'), JSON.stringify({ launcher: process.pid, vite: vite.pid, electron: electron.pid, ports, runtime, appDir }, null, 2));
console.log('Isolated Syka ready on ' + env.SYKA_DEV_URL);
