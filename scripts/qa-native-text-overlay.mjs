// Compile a COPY of the supplied project and inspect it in an isolated browser.
// Never opens, edits, or sends a model turn to the user's editor/project.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

if (!process.argv[2]) throw Error('Usage: node scripts/qa-native-text-overlay.mjs <project directory>');
const project = resolve(process.argv[2]);
const output = resolve('output/playwright/native-text-overlay');
await mkdir(output, { recursive: true });
const copy = await mkdtemp(join(output, 'project-copy-'));
const sources = ['index.tsx', ...(await readdir(join(project, 'components'))).filter(name => /\.(tsx?|jsx?)$/.test(name)).map(name => 'components/' + name)];
const hash = async file => createHash('sha256').update(await readFile(join(project, file))).digest('hex');
const before = await Promise.all(sources.map(hash));
await mkdir(join(copy, 'components'));
for (const file of sources) await copyFile(join(project, file), join(copy, file));
await writeFile(join(copy, 'package.json'), JSON.stringify({ main: 'index.tsx', name: 'native-text-overlay-qa', displayName: 'Isolated native overlay QA', projectId: 'native-text-overlay-qa' }));
const compiler = join(output, 'compiler.cjs');
await build({ entryPoints: ['apps/desktop/src/projects.ts'], outfile: compiler, bundle: true, platform: 'node', format: 'cjs',
  external: ['esbuild', '@babel/core', '@babel/preset-typescript', 'babel-preset-solid'], logLevel: 'silent',
  plugins: [{ name: 'qa-electron-stub', setup(build) {
    build.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'qa' }));
    build.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: 'export const app={isPackaged:false,getPath:()=>"."};export const dialog={};export const shell={};export const ipcMain={on(){}};', loader: 'js' }));
  } }],
});
const { compileProject } = createRequire(import.meta.url)(compiler);
const compiled = await compileProject(copy);
if (!compiled.ok) throw Error(compiled.error);
await writeFile(join(output, 'project.cjs'), compiled.code);
if ((await Promise.all(sources.map(hash))).some((value, i) => value !== before[i])) throw Error('Original project sources changed during QA');

const browser = await chromium.launch({ headless: true, args: ['--enable-blink-features=CanvasDrawElement', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 780 } });
  page.setDefaultTimeout(12000);
  await page.goto('http://localhost:5188');
  const base = '/@fs/' + resolve('.').replaceAll('\\', '/').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/, '$1:');
  await page.evaluate(async ({ base, code }) => {
    const runtime = await import(base + '/packages/runtime/src/index.ts');
    const reconciler = await import(base + '/packages/reconciler/src/index.ts');
    const solid = await import('/node_modules/.vite/deps/solid-js.js'), web = await import('/node_modules/.vite/deps/solid-js_web.js');
    const source = await (await fetch('/src/components/canvas/visual-target-picker.tsx')).text();
    const imported = path => source.match(new RegExp('from "(' + path.replaceAll('.', '\\.') + '[^"]*)"'))?.[1] ?? path;
    const { EngineProvider, useEngineContext } = await import(imported('/src/engine/context.tsx'));
    const { ProjectProvider } = await import(imported('/src/context/project.tsx'));
    const { VisualTargetPicker } = await import('/src/components/canvas/visual-target-picker.tsx');
    const overlay = document.createElement('div'); overlay.style.cssText = 'position:fixed;inset:0;background:#141414;z-index:90;display:grid;place-items:center'; document.body.append(overlay);
    const area = document.createElement('div'); area.style.cssText = 'position:relative;width:760px;height:470px'; overlay.append(area);
    const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 470; canvas.style.cssText = 'width:100%;height:100%'; area.append(canvas);
    const mount = document.createElement('div'); mount.style.display = 'contents'; area.append(mount);
    let engine;
    const Fixture = () => { engine = useEngineContext(); engine.mount(canvas); return solid.createComponent(VisualTargetPicker, {}); };
    web.render(() => solid.createComponent(ProjectProvider, { project: { id: 'native-text-overlay-qa', dir: 'isolated-copy', displayName: 'Isolated native overlay QA' },
      get children() { return solid.createComponent(EngineProvider, { projectId: 'native-text-overlay-qa', get children() { return solid.createComponent(Fixture, {}); } }); } }), mount);
    const world = engine.world;
    reconciler.mount(code, world);
    const scene = runtime.getActiveEntity(world);
    if (!scene) throw Error('Actual copied project has no active scene');
    runtime.setPlayhead(world, scene, 0);
    engine.start();
    window.__nativeQA = { world, scene, engine, canvas, runtime };
  }, { base, code: compiled.code });
  await page.waitForTimeout(600);
  const evidence = await page.evaluate(async () => {
    const q = window.__nativeQA, { world, scene, runtime, canvas } = q;
    const model = await import('/src/agent-chat/visual-target-model.ts');
    const { pickVisualTarget } = await import('/src/agent-chat/visual-hit-target.ts');
    const text = world.query(runtime.Chars).find(node => node.get(runtime.Chars)?.value === 'HACÉ');
    if (!text) throw Error('Actual HACÉ native text missing');
    const box = model.targetBox(world, text), point = { x: box.x + box.width * .1, y: box.y + box.height * .4 };
    const quad = runtime.entityQuad(world, text), layoutWidth = Math.max(...quad.map(p => p.x)) - Math.min(...quad.map(p => p.x));
    if (box.width >= layoutWidth * .75) throw Error('Text outline still uses the wide layout box');
    const blank = { x: Math.max(...quad.map(p => p.x)) - 5, y: point.y };
    if (pickVisualTarget(world, scene, blank)?.entity === text) throw Error('Empty text layout space still selects HACÉ');
    const old = model.pickNativeTarget(world, scene, point), current = pickVisualTarget(world, scene, point);
    if (old === text) throw Error('Regression setup did not reproduce old overlay interception');
    if (current?.entity !== text || current.html) throw Error('Transparent HTML still steals the native text: ' + JSON.stringify(current && model.targetDetails(current.entity)));
    // An opaque HTML container really covers the text and must win again.
    const front = old.get(runtime.Host)?.element;
    if (!(front instanceof HTMLElement)) throw Error('Front overlay is not HTML');
    front.style.background = '#222';
    if (pickVisualTarget(world, scene, point)?.entity !== old) throw Error('Selected text through opaque foreground HTML');
    front.style.background = '';
    const wrapper = front.firstElementChild;
    wrapper.style.background = '#222';
    if (pickVisualTarget(world, scene, point)?.entity !== old) throw Error('Selected text through opaque HTML container');
    wrapper.style.background = '';
    runtime.setCameraMatrix(world, [.27, 0, 0, .27, 100, 70]); runtime.transformSystem(world);
    const zoomBox = model.targetBox(world, text), zoomPoint = { x: zoomBox.x + zoomBox.width * .1, y: zoomBox.y + zoomBox.height * .4 };
    if (pickVisualTarget(world, scene, zoomPoint)?.entity !== text) throw Error('Zoom broke layered picking');
    const rect = canvas.getBoundingClientRect();
    q.point = { x: rect.x + zoomPoint.x * rect.width / canvas.width, y: rect.y + zoomPoint.y * rect.height / canvas.height };
    q.textSource = text.get(runtime.Source)?.value;
    return { oldTarget: model.targetDetails(old), selectedTarget: model.targetDetails(text), text: text.get(runtime.Chars)?.value,
      textBounds: box, layoutWidth,
      checks: ['original sources preserved', 'actual project compiled and mounted', 'old bug reproduced', 'native text under transparent full-frame overlay', 'glyph-sized outline and capture', 'empty layout space ignored', 'opaque foreground root retained', 'opaque foreground container retained', 'preview zoom'] };
  });
  await page.evaluate(async () => { const { setVisualPickMode } = await import('/src/agent-chat/visual-target-state.ts'); setVisualPickMode('element'); });
  const point = await page.evaluate(() => window.__nativeQA.point);
  await page.mouse.move(point.x, point.y);
  await page.locator('.syka-visual-target-outline>span').filter({ hasText: 'HACÉ' }).waitFor();
  await page.mouse.click(point.x, point.y);
  const card = page.getByRole('dialog', { name: 'Referencia visual para el agente' });
  await card.waitFor();
  if (!(await card.locator('.syka-visual-target-heading strong').textContent()).includes('HACÉ')) throw Error('UI selected full brand overlay');
  await card.getByRole('checkbox', { name: 'Incluir captura' }).uncheck();
  await card.getByRole('textbox', { name: 'Qué mejorar de esta referencia' }).fill('Cambiar solamente HACÉ');
  await page.screenshot({ path: join(output, 'native-text-note.png') });
  await card.getByRole('button', { name: 'Añadir a revisión', exact: true }).click();
  await card.waitFor({ state: 'hidden' });
  const note = await page.evaluate(async () => {
    const { readVisualNotes } = await import('/src/agent-chat/visual-review-storage.ts');
    return (await readVisualNotes('new:native-text-overlay-qa'))[0];
  });
  if (note?.context?.elements?.[0]?.source !== evidence.selectedTarget.source || note.context.elements[0].type !== 'text') throw Error('Native text target lost from saved note');
  evidence.savedNote = { title: note.title, target: note.context.elements[0] };
  evidence.checks.push('real picker hover and click', 'native text persisted in review note');
  await writeFile(join(output, 'verification.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally { await browser.close(); }
