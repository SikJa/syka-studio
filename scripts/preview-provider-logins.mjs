import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, open } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = join(root, '.runtime', 'provider-logins-live');
const endpointPath = join(runtime, 'endpoint.json');
await mkdir(runtime, { recursive: true });
async function alive() {
  try {
    const endpoint = JSON.parse(await readFile(endpointPath, 'utf8'));
    if (endpoint.mode !== 'real' || !Number.isInteger(endpoint.pid)) return false;
    process.kill(endpoint.pid, 0);
    return await new Promise(resolveAlive => {
      const socket = new WebSocket(endpoint.url, { origin: 'http://localhost:5188' });
      const timer = setTimeout(() => { socket.terminate(); resolveAlive(false); }, 1500);
      socket.once('open', () => { clearTimeout(timer); socket.close(); resolveAlive(true); });
      socket.once('error', () => { clearTimeout(timer); socket.terminate(); resolveAlive(false); });
    });
  } catch { return false; }
}
if (!await alive()) {
  const hostPath = join(runtime, 'host.mjs');
  await build({ entryPoints: [join(root, 'apps/web/qa/provider-live-host.ts')], bundle: true, platform: 'node', format: 'esm', target: 'node20', external: ['electron', 'playwright-core'], banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" }, outfile: hostPath, logLevel: 'warning' });
  const out = await open(join(runtime, 'host.log'), 'a');
  const child = spawn(process.execPath, [hostPath], { cwd: root, env: { ...process.env, SYKA_PROVIDER_PREVIEW_ROOT: runtime }, detached: true, windowsHide: true, stdio: ['ignore', out.fd, out.fd] });
  child.on('error', () => {});
  child.unref(); await out.close();
  const deadline = Date.now() + 20_000;
  while (!await alive()) {
    if (Date.now() > deadline) throw Error('The real provider preview host did not start. See its local host.log.');
    await new Promise(resolveWait => setTimeout(resolveWait, 300));
  }
}
const endpointUrl = '/@fs/' + endpointPath.replaceAll('\\', '/');
await writeFile(join(root, 'apps/web/qa/providers-live-endpoint.js'), `window.__sykaProviderEndpoint=${JSON.stringify(endpointUrl)};\n`);
console.log('Real provider backend ready. Existing projects and previews were not restarted.');
console.log('http://localhost:5188/qa/providers-live.html');
