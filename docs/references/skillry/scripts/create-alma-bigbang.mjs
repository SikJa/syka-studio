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
const resources = join(root, 'docs/references/skillry');
const runtime = join(resources, 'evidence/qa-runtime/alma-bigbang-production-2026-10-08');
const appDir = join(runtime, 'app');
const project = resolve(root, '../Pruebas Syka/Alma-y-BigBang-20s-Sol-MuyAlto-2026-10-08');
const evidenceDir = join(project, 'qa-evidence');
const url = 'http://127.0.0.1:5317';
const resultPath = join(project, 'qa-evidence/production.json');
const requestedEffort = 'xhigh'; // Explicitly requested by Sikora.
const previous = undefined;
const result = { startedAt: new Date().toISOString(), project, ports: { web: 5317, mcp: 3317, cdp: 9417 },
  privateBundleOverride: 'Development docsDir points at the staged public app resources, without the research archive.',
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

const projectName = 'alma-bigbang-20s-2026-10-08';
await mkdir(project, { recursive: true });
const entry = join(project, 'index.tsx');
try { await access(entry); const pkg = JSON.parse(await readFile(join(project, 'package.json'), 'utf8')); assert.equal(pkg.name, projectName, 'Only our new project may be reused'); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const scaffold = 'export default function Project(){return <stage id="stage_alma20" background="#090B15"><scene id="alma_bigbang" name="Alma y Big Bang" width={1920} height={1080} fill="#090B15" workarea={[0,20]} active><rect id="alma_bg" name="Fondo" width={1920} height={1080} fill="#090B15" start={0} end={20}/></scene></stage>;}\n';
  await writeFile(entry, scaffold, { flag: 'wx' });
  await writeFile(join(project, 'package.json'), JSON.stringify({ name: projectName, displayName: 'Alma y Big Bang · 20 segundos', private: true, type: 'module', main: 'index.tsx', devDependencies: { '@diffusionstudio/jsx': 'latest', 'solid-js': '^1.9.10' }, diffusion: { export: { alma_bigbang: { format: 'mp4', video: { enabled: true, codec: 'avc', bitrate: 16000000, fps: 60, resolution: 1080 }, audio: { enabled: true, codec: 'aac', sampleRate: 48000, bitrate: 256000 } } } } }, null, 2) + '\n', { flag: 'wx' });
}

await mkdir(evidenceDir, { recursive: true });
await writeFile(join(runtime, 'finish.txt'), 'RUNNING');
const codex = process.env.SYKA_CODEX_PATH;
if (!codex) throw Error('Set SYKA_CODEX_PATH to the verified local account CLI.');
await access(codex);
await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'syka-motion-qa-private', version: '0.207.0', main: 'dist/main.cjs' }));
const docsExpression = 'const dir = app.isPackaged ? join(process.resourcesPath, "docs") : join(app.getAppPath(), "..", "..", "docs");';
await esbuild.build({ entryPoints: [join(root, 'apps/desktop/src/main.ts')], bundle: true, platform: 'node', format: 'cjs',
  external: ['electron', 'esbuild', '@babel/core', '@babel/preset-typescript', 'babel-preset-solid'],
  outfile: join(appDir, 'dist/main.cjs'), plugins: [{ name: 'isolated-docs-path', setup(build) {
    build.onLoad({ filter: /[\\/]apps[\\/]desktop[\\/]src[\\/]main\.ts$/ }, async args => {
      const source = await readFile(args.path, 'utf8');
      assert.equal(source.split(docsExpression).length, 2, 'Expected one docsDir assignment');
      return { contents: source.replace(docsExpression, `const dir = ${JSON.stringify(join(root, 'apps/desktop/docs'))};`), loader: 'ts', resolveDir: dirname(args.path) };
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
  electronApp = await _electron.launch({ executablePath: require('electron'), args: [appDir, '--remote-debugging-port=9417'], cwd: root, env, timeout: 60_000 });
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
        result.events.push({ seq: message.seq, kind: 'tool', name: event.item.name, title: sanitize(event.item.title), status: event.item.status, output: event.item.output, imageCount: event.item.images?.length ?? 0 });
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
  assert.ok(requested.efforts?.includes(requestedEffort), 'Requested xhigh is not advertised; no fallback permitted');
  const model = { harness: 'codex', model: requested.id, effort: requestedEffort };
  result.model = model;
  log('MODEL_VERIFIED', model);
  const chat = previous?.chatId
    ? (await request('chats.open', { chatId: previous.chatId })).chat
    : await request('chats.create', { projectId: result.open.id, cwd: project, model, title: 'Alma y Big Bang · 20s · Sol Muy alto' });
  result.chatId = chat.id;
  await request('chats.open', { chatId: chat.id });
  const brief = "Creá y terminá una pieza de motion de exactamente 20 segundos sobre EL ALMA Y EL BIG BANG. Sikora pidió GPT-6.1 Sol con esfuerzo Muy alto/xhigh y creatividad; ya estás configurado con ese modelo, no lo cambies. Es una prueba artística con metáforas, no una afirmación científica o religiosa. Usá las referencias y reglas escritas incluidas en Syka mediante syka-motion-references/design-rules.md y la herramienta nativa syka_motion_knowledge; elegí dos o tres estudios pertinentes (ancla/esfera, tipografía y continuidad) y anotá las decisiones transferidas con sus IDs. No descargues videos de referencia ni dependas de carpetas privadas.\n\nEl pedido adicional es central: LA MÚSICA Y LOS SONIDOS SON SÚPER IMPORTANTES. Diseñá el arreglo y un mapa de cues al mismo tiempo que los beats visuales. Usá syka-local-audio y sus soportes music-and-sfx.md/native-mixing.md/audio-studio.mjs, recursos incluidos con licencia o sintetizá una partitura propia más desarrollada. Debe tener evolución y cierre para 20s: anticipación/tensión, golpe profundo de expansión, apertura armónica y una resolución íntima/respirada; no un whoosh por cada palabra ni un loop genérico cortado a20s. Podés usar 96 BPM y8compases para20s si te sirve, pero elegí el tempo/arreglo según la idea. Conservá pistas/stems editables en el proyecto y no dupliques mix+stems. Alineá eventos visuales a los cues reales y medí el render mezclado para evitar clipping. Sin voz salvo que resulte necesario; este brief funciona con tipografía poética y música. No uses servicios pagos ni proveedores externos.\n\nDirección propuesta, adaptala con criterio: un mismo foco de luz nace en la oscuridad, se expande en un cosmos geométrico y termina convirtiéndose en algo íntimo, como un alma mirando hacia su origen. Una continuidad reconocible conecta lo enorme y lo humano. Inventá copy corto, evocador y en español, jerarquía tipográfica cuidada y composición cinematográfica limpia; construí una transformación visible, no cinco títulos con fades sobre puntitos. Hacé que la música explique ese recorrido. Podés contrastar una fuente editorial/serif real con una sans geométrica disponible, si funciona; tipografías reales y sin texto microscópico. Diseño de 1920x1080,60fps,una composición alma_bigbang de20s; Diffusion nativo y fuente editable. Podés crear SVG, vectores, código procedural, html o surface gobernados por useTicker/tiempo absoluto. Nada de un video ajeno como resultado ni otro renderer, temporizadores acumulativos o dependencias nuevas.\n\nTrabajá exclusivamente en este proyecto nuevo. Leé contexto, receta y documentación nativa necesaria. Escribí design.md, frame.md y audio-plan.md, con beats, cues, assets, procedencia y límites. Capturá primero el beat de mayor riesgo con el copy real; inspeccioná las imágenes. Confirmá que todo siga dibujándose después de16s (html necesita end explícito), que los frames intermedios no se pierdan por máscaras/opacidades y que el cierre tenga hold. Check, export nativo a02 Finales/alma-bigbang-final.mp4 y syka_motion_review con focusTime elegido por tu transición de mayor riesgo y holds pertinentes. Mirá las imágenes reales y corregí hasta3defectos locales si hace falta; reexportá sólo ante cambios. No confundas análisis de niveles con escucha subjetiva. Guardá qa-evidence/creative-review.json con decisiones, estudio utilizado, archivos reales, modelo solicitado, fuente/export y pruebas. Terminá con la animación completa con audio, no sólo una propuesta. El usuario ya autorizó hacer/exportar esta prueba: no preguntes por aprobación, onboarding ni cosas opcionales; no subagentes, no otros proyectos, no publicar/Drive. Mantener el modelo y duración es obligatorio.";
  result.brief = brief;
  await persist();
  await request('turn.send', { chatId: chat.id, projectId: result.open.id, cwd: project, text: brief, model });
  log('PRODUCTION_TURN_STARTED');
  let deadline;
  const timedOut = new Promise(ok => { deadline = setTimeout(() => ok({ status: 'timeout' }), 30 * 60_000); });
  const turn = await Promise.race([finished, timedOut]);
  clearTimeout(deadline);
  if (turn.status === 'timeout') await request('turn.interrupt', { chatId: chat.id });
  result.turnOutcome = turn;
  if (turn.status !== 'completed') throw Error(`Agent turn ${turn.status}`);
  assert.ok(result.events.some(e => e.name === 'syka_motion_knowledge' && e.status === 'done'), 'Included reference knowledge must actually be used');
  result.contextAfter = await tool('context', {});
  result.checks.structure = await tool('check', { id: 'alma_bigbang' });
  result.checks.capture = await tool('capture', { id: 'alma_bigbang', times: ['0.75','3.0','6.0','10.0','14.5','18.5','19.8'], output: join(evidenceDir, 'final-states') });
  const finalPath = join(project, '02 Finales/alma-bigbang-final.mp4');
  try { await access(finalPath); result.checks.nativeExport = { path: finalPath, createdBy: 'requested native agent turn' }; }
  catch { result.checks.nativeExport = await tool('export', { id: 'alma_bigbang', path: finalPath }); }
  await page.screenshot({ path: join(evidenceDir, 'native-editor.png') });
  result.completedAt = new Date().toISOString(); await persist();
  log('NATIVE_MOTION_READY', { model: result.model, export: result.checks.nativeExport, capture: result.checks.capture });
  log('REVIEW_WINDOW_READY', runtime);
  for (let i=0; i<3600; i++) {
    try { if ((await readFile(join(runtime, 'finish.txt'), 'utf8')).trim() !== 'RUNNING') break; } catch {}
    try {
      const followup = await readFile(join(runtime, 'followup.txt'), 'utf8');
      if (followup.trim()) {
        await writeFile(join(runtime, 'followup.txt'), '');
        const fresh = new Promise(ok => { completeTurn = ok; });
        await request('turn.send', { chatId: chat.id, projectId: result.open.id, cwd: project, text: followup, model });
        result.followupOutcome = await fresh; await persist();
        log('FOLLOWUP_FINISHED', result.followupOutcome);
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await delay(500);
  }

} catch (error) {
  result.error = sanitize(error.stack || error.message); await persist(); log('QA_FAILURE', result.error); process.exitCode = 1;
} finally {
  socket?.close(); await mcp?.close().catch(() => {}); await electronApp?.close().catch(() => {});
  if (vite.exitCode === null) vite.kill();
  result.closedAt = new Date().toISOString(); await persist();
}
