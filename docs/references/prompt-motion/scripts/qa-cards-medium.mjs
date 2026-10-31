// Isolated, real Electron/agent/MCP validation. No shared build, profile or ports.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import * as esbuild from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const require = createRequire(import.meta.url);
const { _electron } = require('playwright-core');
const WebSocket = require('ws');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const resources = join(root, 'docs/references/prompt-motion');
const runtime = join(resources, 'evidence/qa-cards-runtime');
const appDir = join(runtime, 'app');
const project = resolve(root, '../Pruebas Syka/QA-cartas-medium-2026-10-06');
const evidenceDir = join(project, 'qa-evidence');
const url = 'http://127.0.0.1:5317';
const resultPath = join(resources, 'evidence/cards-medium-integration.json');
const requestedEffort = 'medium'; // Explicitly requested by Sikora.
const previous = undefined;
const result = { startedAt: new Date().toISOString(), project, ports: { web: 5317, mcp: 3317, cdp: 9417 },
  privateBundleOverride: 'Development docsDir points at the actual repository docs; source files are unchanged.',
  pageErrors: [], events: [], checks: {} };
const delay = ms => new Promise(done => setTimeout(done, ms));
const sanitize = text => String(text).replace(/([?&]token=)[^\s"&]+/g, '$1[redacted]');
const persist = () => writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
const log = (label, value = '') => process.stdout.write(`${label} ${sanitize(typeof value === 'string' ? value : JSON.stringify(value))}\n`);
async function portFree(port) {
  const server = net.createServer();
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', ok); });
  await new Promise(ok => server.close(ok));
}
await Promise.all([5317, 3317, 9417].map(portFree));
await mkdir(join(appDir, 'dist'), { recursive: true });
await mkdir(evidenceDir, { recursive: true });
await writeFile(join(runtime, 'finish.txt'), 'RUNNING');
const codex = 'C:/Users/Sikora/AppData/Local/OpenAI/Codex/bin/5ea220ae823df3d7/codex.exe';
await access(codex);
await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'syka-motion-qa-private', version: '0.207.0', main: 'dist/main.cjs' }));
const docsExpression = 'const dir = app.isPackaged ? join(process.resourcesPath, "docs") : join(app.getAppPath(), "..", "..", "docs");';
await esbuild.build({ entryPoints: [join(root, 'apps/desktop/src/main.ts')], bundle: true, platform: 'node', format: 'cjs',
  external: ['electron', 'esbuild', '@babel/core', '@babel/preset-typescript', 'babel-preset-solid'],
  outfile: join(appDir, 'dist/main.cjs'), plugins: [{ name: 'isolated-docs-path', setup(build) {
    build.onLoad({ filter: /[\\/]apps[\\/]desktop[\\/]src[\\/]main\.ts$/ }, async args => {
      const source = await readFile(args.path, 'utf8');
      assert.equal(source.split(docsExpression).length, 2, 'Expected one docsDir assignment');
      return { contents: source.replace(docsExpression, `const dir = ${JSON.stringify(join(root, 'docs'))};`), loader: 'ts', resolveDir: dirname(args.path) };
    });
  } }] });
await esbuild.build({ entryPoints: [join(root, 'apps/desktop/src/preload.ts')], bundle: true, platform: 'node', format: 'cjs',
  external: ['electron'], outfile: join(appDir, 'dist/preload.js') });
await esbuild.build({ entryPoints: [join(root, 'packages/agent-chat/src/bin.ts')], bundle: true, platform: 'node', format: 'esm', target: 'node20',
  external: ['electron', 'playwright-core'], banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  outfile: join(appDir, 'dist/agent-host.mjs') });
log('PRIVATE_BUILD_READY');
const vite = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--port', '5317', '--strictPort', '--host', '127.0.0.1'],
  { cwd: join(root, 'apps/web'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
vite.stdout.on('data', chunk => { if (String(chunk).includes('ready')) log('VITE_READY'); });
vite.stderr.on('data', chunk => log('VITE_DIAGNOSTIC', String(chunk).slice(0, 800)));
let electronApp, mcp, socket;
try {
  for (let i = 0; i < 150; i++) {
    if (vite.exitCode !== null) throw Error(`Isolated Vite exited ${vite.exitCode}`);
    try { if ((await fetch(url)).ok) break; } catch {}
    if (i === 149) throw Error('Isolated Vite did not become ready');
    await delay(200);
  }
  const env = { ...process.env, SYKA_RUNTIME_ROOT: join(runtime, 'profile-root'), SYKA_MEDIA_ROOT: dirname(project),
    SYKA_DEV_URL: url, SYKA_DEV_PORT: '5317', SYKA_MCP_PORT: '3317', SYKA_CODEX_PATH: codex,
    SYKA_FFMPEG_PATH: 'C:/ffmpeg/bin/ffmpeg.exe', SYKA_FFPROBE_PATH: 'C:/ffmpeg/bin/ffprobe.exe' };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS; delete env.SYKA_QA_CDP_PORT;
  electronApp = await _electron.launch({ executablePath: require('electron'), args: [appDir, '--hidden', '--remote-debugging-port=9417'], cwd: root, env, timeout: 60_000 });
  const page = await electronApp.firstWindow();
  page.on('pageerror', error => { result.pageErrors.push(error.message); log('PAGE_ERROR', error.message); });
  await page.waitForLoadState('networkidle', { timeout: 60_000 });
  await page.setViewportSize({ width: 1500, height: 980 });
  log('ELECTRON_READY');
  mcp = new Client({ name: 'syka-motion-reference-qa', version: '1.0' });
  await mcp.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3317/mcp')));
  async function tool(name, args) {
    const reply = await mcp.callTool({ name, arguments: args }, undefined, { timeout: 180_000 });
    if (reply.isError) throw Error(`${name}: ${reply.content?.filter(x => x.type === 'text').map(x => x.text).join('\n')}`);
    if (reply.structuredContent) return reply.structuredContent;
    const text = reply.content?.filter(x => x.type === 'text').map(x => x.text).join('\n') || '';
    try { return JSON.parse(text); } catch { return { text }; }
  }
  result.open = await tool('open', { dir: project });
  for (let attempt = 0; attempt < 100; attempt++) { result.contextBefore = await tool('context', {}); if (result.contextBefore.projectDir) break; await delay(200); }
  assert.equal(resolve(result.open.dir).toLowerCase(), project.toLowerCase());
  assert.equal(resolve(result.contextBefore.projectDir).toLowerCase(), project.toLowerCase());
  await page.screenshot({ path: join(evidenceDir, 'before.png') });
  log('PROJECT_OPEN', { id: result.open.id, dir: result.open.dir });
  let endpoint;
  for (let i = 0; i < 100 && !endpoint; i++) {
    endpoint = await page.evaluate(() => new Promise((ok, fail) => {
      const id = crypto.randomUUID();
      const timeout = setTimeout(() => { remove(); fail(Error('agent endpoint IPC timed out')); }, 5000);
      const remove = window.desktop.on('main:response', reply => {
        if (reply.id !== id) return;
        clearTimeout(timeout); remove(); reply.ok ? ok(reply.data) : fail(Error(reply.error));
      });
      window.desktop.send('main:request', { id, channel: 'agent-chat:endpoint', data: undefined });
    }));
    if (!endpoint) await delay(300);
  }
  if (!endpoint?.url) throw Error('Real agent host endpoint unavailable');
  socket = new WebSocket(endpoint.url, { origin: url });
  await new Promise((ok, fail) => { socket.once('open', ok); socket.once('error', fail); });
  const pending = new Map();
  let completeTurn;
  const finished = new Promise(ok => { completeTurn = ok; });
  socket.on('message', async bytes => {
    const message = JSON.parse(String(bytes));
    if (message.t === 'res') {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id); clearTimeout(waiter.timeout);
      message.ok ? waiter.ok(message.data) : waiter.fail(Error(JSON.stringify(message.error)));
    } else if (message.t === 'event') {
      const event = message.event;
      if (event.type === 'item.completed' && event.item.kind === 'tool') {
        result.events.push({ seq: message.seq, kind: 'tool', name: event.item.name, title: sanitize(event.item.title), status: event.item.status });
        log('AGENT_TOOL', `${event.item.status}: ${event.item.title}`);
      } else if (event.type === 'item.completed' && event.item.kind === 'assistant') {
        result.events.push({ seq: message.seq, kind: 'assistant', phase: event.item.phase, text: sanitize(event.item.text) });
        log('AGENT_MESSAGE', event.item.text.slice(0, 1500));
      } else if (event.type === 'request.opened') {
        result.pendingRequest = event.request; await persist();
        log('AGENT_NEEDS_INPUT', event.request); completeTurn({ status: 'waiting' });
      } else if (event.type === 'turn.completed') {
        result.turn = event; await persist(); completeTurn(event);
      }
    }
  });
  function request(method, params, timeoutMs = 60_000) {
    return new Promise((ok, fail) => {
      const id = randomUUID();
      const timeout = setTimeout(() => { pending.delete(id); fail(Error(`${method} timeout`)); }, timeoutMs);
      pending.set(id, { ok, fail, timeout }); socket.send(JSON.stringify({ t: 'req', id, method, params }));
    });
  }
  const harnesses = await request('harnesses.list', { refresh: true }, 90_000);
  const codexInfo = harnesses.find(h => h.id === 'codex');
  result.provider = codexInfo;
  const requested = codexInfo?.models.find(m => m.id === 'gpt-6.1-sol');
  assert.equal(codexInfo?.status, 'ready', `Codex not ready: ${codexInfo?.detail}`);
  assert.ok(requested, 'Requested gpt-6.1-sol is not advertised; no fallback permitted');
  assert.ok(requested.efforts?.includes(requestedEffort), 'Requested Medio is not advertised; no fallback permitted');
  const model = { harness: 'codex', model: requested.id, effort: requestedEffort };
  result.model = model;
  log('MODEL_VERIFIED', model);
  const chat = previous?.chatId
    ? (await request('chats.open', { chatId: previous.chatId })).chat
    : await request('chats.create', { projectId: result.open.id, cwd: project, model, title: 'Cartas · GPT-6.1 Sol Medio' });
  result.chatId = chat.id;
  await request('chats.open', { chatId: chat.id });
  const brief = `Esta es una nueva prueba aislada pedida por Sikora: hacé una animación de cartas de póker propia, 10 segundos, 1920×1080, 60 fps, sin audio. GPT-6.1 Sol está configurado en medium (Medio), no cambies modelo ni esfuerzo. Secuencia: un mazo compacto aparece sobre una mesa verde profundo, se abre en un abanico elegante, se separa el as de picas, gira revelando su frente y termina junto a los otros tres ases en una disposición final clara. Las cartas deben mantener identidad, tamaño y continuidad espacial, con aceleración y desaceleración cuidadas, sombras discretas y pausas para leer el resultado. Estética editorial pulida: fondo #103b32, cartas marfil #f5f0e5, palos negros #18201c y rojos #ba3940, reverso propio geométrico en dorado apagado. Sin marcas, partículas, humo, metraje precocinado ni cuentas. No copies la animación anterior ni sus documentos: elegí pocas referencias pertinentes con la skill local syka-motion-references; leé los prompts elegidos disponibles y sus análisis, e inspeccioná frames cuando estén disponibles. Registrá las referencias y qué decisiones tomás de cada una en qa-evidence/references.json y escribí design.md y frame.md propios. Usá nodos nativos editables de Diffusion para formas, texto y keyframes; para el giro podés simular perspectiva con escala horizontal y alternar frente/reverso sin afirmar 3D real. Estado determinista por tiempo absoluto, sin GSAP/CSS dependiente de reproducción. El id de escena será qa_cards. Todos los assets deben ser propios y portátiles. Podés crear archivos y componentes SOLO dentro de este proyecto aislado; no modifiques el repo ni otros proyectos. Revisá legibilidad de índices y palos, evita que las cartas atraviesen otras de manera incoherente, y ajustá si hay recortes o solapes accidentales. Corré check, capturá estados y transiciones, probá seek fuera de orden y exportá MP4 nativo en este proyecto. No hagas onboarding ni preguntas: este brief está cerrado y autoriza crear y exportar esta prueba. Terminá contando las referencias utilizadas, qué se validó y cualquier límite real.`;
  result.brief = brief;
  await persist();
  const turnText = brief;
  await request('turn.send', { chatId: chat.id, projectId: result.open.id, cwd: project, text: turnText, model });
  log('TURN_STARTED');
  let deadline;
  const timedOut = new Promise(ok => { deadline = setTimeout(() => ok({ status: 'timeout' }), 20 * 60_000); });
  const turn = await Promise.race([finished, timedOut]);
  clearTimeout(deadline);
  if (turn.status === 'timeout') await request('turn.interrupt', { chatId: chat.id });
  result.turnOutcome = turn;
  await persist();
  if (turn.status !== 'completed') throw Error(`Agent turn ${turn.status}`);
  result.contextAfter = await tool('context', {});
  result.checks.structure = await tool('check', { id: 'qa_cards' });
  result.checks.capture = await tool('capture', { id: 'qa_cards', times: ['0.5', '2.0', '3.5', '4.5', '5.5', '6.5', '8.0', '9.8'], output: join(evidenceDir, 'states') });
  result.checks.nativeExport = await tool('export', { id: 'qa_cards', path: join(project, 'qa-cartas-medium.mp4') });
  await page.screenshot({ path: join(evidenceDir, 'after.png') });
  result.uiRecon = await page.evaluate(() => ({
    buttons: [...document.querySelectorAll('button')].map(x => ({ label: x.getAttribute('aria-label'), text: x.textContent?.trim() })).filter(x => x.label || x.text),
    inputs: [...document.querySelectorAll('input')].map(x => ({ type: x.type, label: x.getAttribute('aria-label'), value: x.value })),
    canvases: [...document.querySelectorAll('canvas')].map(x => ({ width: x.width, height: x.height, rect: x.getBoundingClientRect().toJSON() }))
  }));
  result.completedAt = new Date().toISOString();
  await persist();
  log('NATIVE_CAPTURE_EXPORT_READY', { capture: result.checks.capture, export: result.checks.nativeExport });
  log('REVIEW_WINDOW_READY', 'Write qa-cards-runtime/finish.txt to close only this isolated instance.');
  for (let i = 0; i < 2400; i++) {
    try { if ((await readFile(join(runtime, 'finish.txt'), 'utf8')).trim() !== 'RUNNING') break; } catch {}
    await delay(500);
  }
} catch (error) {
  result.error = sanitize(error.stack || error.message); await persist(); log('QA_FAILURE', result.error); process.exitCode = 1;
} finally {
  socket?.close(); await mcp?.close().catch(() => {}); await electronApp?.close().catch(() => {});
  if (vite.exitCode === null) vite.kill();
  result.closedAt = new Date().toISOString(); await persist();
}
