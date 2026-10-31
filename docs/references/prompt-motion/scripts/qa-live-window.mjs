// Reopen the same QA source in a visible private editor for actual UI seeks.
// Uses the already-built QA app and no additional model turns.
import { readFile, writeFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const require = createRequire(import.meta.url);
const { _electron } = require('playwright-core');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const resources = join(root, 'docs/references/prompt-motion');
const runtime = join(resources, 'evidence/qa-runtime');
const recorded = JSON.parse(await readFile(join(resources, 'evidence/native-integration.json'), 'utf8'));
const delay = ms => new Promise(ok => setTimeout(ok, ms));
for (const port of [5317, 3317, 9417]) {
  const listener = net.createServer();
  await new Promise((ok, fail) => { listener.once('error', fail); listener.listen(port, '127.0.0.1', ok); });
  await new Promise(ok => listener.close(ok));
}
await writeFile(join(runtime, 'live-finish.txt'), 'RUNNING');
const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--port', '5317', '--strictPort', '--host', '127.0.0.1'],
  { cwd: join(root, 'apps/web'), windowsHide: true, stdio: 'ignore' });
let app, mcp;
try {
  for (let n = 0; n < 150; n++) { try { if ((await fetch('http://127.0.0.1:5317')).ok) break; } catch {} await delay(200); }
  const env = { ...process.env, SYKA_RUNTIME_ROOT: join(runtime, 'profile-root'), SYKA_MEDIA_ROOT: dirname(recorded.project),
    SYKA_DEV_URL: 'http://127.0.0.1:5317', SYKA_DEV_PORT: '5317', SYKA_MCP_PORT: '3317',
    SYKA_CODEX_PATH: 'C:/Users/Sikora/AppData/Local/OpenAI/Codex/bin/5ea220ae823df3d7/codex.exe',
    SYKA_FFMPEG_PATH: 'C:/ffmpeg/bin/ffmpeg.exe' };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS; delete env.SYKA_QA_CDP_PORT;
  app = await _electron.launch({ executablePath: require('electron'), args: [join(runtime, 'app'), '--remote-debugging-port=9417'], cwd: root, env, timeout: 60_000 });
  const page = await app.firstWindow();
  await page.waitForLoadState('networkidle', { timeout: 60_000 });
  await page.setViewportSize({ width: 1500, height: 980 });
  mcp = new Client({ name: 'syka-motion-live-ui', version: '1.0' });
  await mcp.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3317/mcp')));
  await mcp.callTool({ name: 'open', arguments: { dir: recorded.project } }, undefined, { timeout: 60_000 });
  await page.bringToFront();
  if (await page.getByRole('button', { name: 'Ahora no', exact: true }).count()) await page.getByRole('button', { name: 'Ahora no', exact: true }).click();
  process.stdout.write('VISIBLE_QA_EDITOR_READY — existing source, no new agent turn.\n');
  await writeFile(join(runtime, 'live-ready.txt'), new Date().toISOString());
  for (let n = 0; n < 1200; n++) { try { if ((await readFile(join(runtime, 'live-finish.txt'), 'utf8')).trim() !== 'RUNNING') break; } catch {} await delay(500); }
} finally { await mcp?.close().catch(() => {}); await app?.close().catch(() => {}); if (server.exitCode === null) server.kill(); }
