import { chromium } from 'playwright-core';
import { transformSync } from '@babel/core';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const phase = process.argv.find(value => value.startsWith('--phase='))?.slice(8) ?? 'after';
const output = resolve(process.env.SYKA_PREVIEW_QA_OUTPUT || '../output/audits/preview-export-20261021');
mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url);
const project = `import { Stage, Scene, Rect } from '@diffusionstudio/jsx';
export default function Project() {
  return <Stage camera={[0.4,0,0,0.4,60,40]} background="#161616">
    <Scene id="film" name="Preview fit regression" width={1440} height={1440} fill="#efece3" active>
      <Rect id="top" x={0} y={0} width={1440} height={20} fill="#ce3456" />
      <Rect id="bottom" x={0} y={1420} width={1440} height={20} fill="#27ac83" />
    </Scene>
  </Stage>;
}`;
const transformed = transformSync(project, { filename: 'fixture.tsx', configFile: false, babelrc: false,
  presets: [[require('babel-preset-solid'), { generate: 'universal', moduleName: '@diffusionstudio/jsx' }]] });
const compiled = await build({ stdin: { contents: transformed.code, resolveDir: resolve('.') }, bundle: true,
  platform: 'browser', format: 'cjs', write: false, external: ['solid-js', 'solid-js/*', '@diffusionstudio/jsx'] });
const browser = await chromium.launch({ headless: true,
  executablePath: 'C:/Users/CHAMP/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe' });
try {
  const deviceScaleFactor = Number(process.env.SYKA_QA_DPR || 1);
  const page = await browser.newPage({ viewport: { width: 900, height: 650 }, deviceScaleFactor });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/syka-preview-fit-qa', route => route.fulfill({ contentType: 'text/html', body: `
    <html><head><meta charset="utf-8"><link rel="stylesheet" href="/src/components/canvas/transport.css"></head>
    <body style="margin:0;background:#161616;color:#ddd;font-family:Arial">
      <main class="syka-canvas-preview" style="position:relative;width:764px;height:456px;--syka-preview-dock-height:58px">
        <div class="syka-preview-caption">Vista previa · misma escena, cámara guardada</div>
        <div class="syka-preview-surface"><div style="position:relative;width:100%;height:100%"><canvas style="position:absolute;inset:0"></canvas></div></div>
        <div class="syka-canvas-dock" style="color:#eee">◀　▶　00:02 / 00:27　　Vista previa</div>
      </main>
    </body></html>` }));
  await page.goto(`${process.env.SYKA_QA_ORIGIN || 'http://127.0.0.1:5188'}/syka-preview-fit-qa`);
  await page.waitForLoadState('networkidle');
  const base = '/@fs/' + resolve('.').replaceAll('\\', '/');
  await page.evaluate(async ({ base, code }) => {
    const runtime = await import(base + '/packages/runtime/src/index.ts');
    const reconciler = await import(base + '/packages/reconciler/src/index.ts');
    const { createEngine } = await import('/src/engine/create-engine.ts');
    const { CameraNavigation } = await import('/src/engine/traits.ts');
    const engine = createEngine('qa-preview-fit', { silent: true });
    engine.mount(document.querySelector('canvas'));
    const qa = { engine, runtime, reconciler, code, CameraNavigation,
      mounted: reconciler.mount(code, engine.world) };
    const scene = engine.world.query(runtime.Scene)[0];
    if (!scene.has(runtime.Source)) scene.add(runtime.Source);
    scene.set(runtime.Source, { value: 'index.tsx:film' });
    window.previewFitQa = qa;
    engine.requestPreviewFit?.();
    engine.start();
  }, { base, code: compiled.outputFiles[0].text });
  await page.waitForTimeout(350);
  const sample = () => page.evaluate(() => {
    const { engine, runtime } = window.previewFitQa;
    const top = runtime.worldToScreen(engine.world, 0, 0);
    const bottom = runtime.worldToScreen(engine.world, 1440, 1440);
    const viewport = runtime.getViewport(engine.world);
    const expectedSize = Math.min(viewport.width - 56, viewport.height - 56, 1440);
    return { top, bottom, viewport, matrix: runtime.getCameraMatrix(engine.world),
      fills: Math.abs((bottom.y - top.y) - expectedSize) < 1 && Math.abs((top.x + bottom.x) / 2 - viewport.width / 2) < 1,
      fits: top.x >= 27 && top.y >= 27 && bottom.x <= viewport.width - 27 && bottom.y <= viewport.height - 27 };
  });
  const initial = await sample();
  await page.evaluate(() => {
    const qa = window.previewFitQa;
    qa.mounted.dispose();
    qa.mounted = qa.reconciler.mount(qa.code, qa.engine.world);
    const scene = qa.engine.world.query(qa.runtime.Scene)[0];
    if (!scene.has(qa.runtime.Source)) scene.add(qa.runtime.Source);
    scene.set(qa.runtime.Source, { value: 'index.tsx:film' });
    qa.engine.requestPreviewFit?.();
  });
  await page.waitForTimeout(350);
  const remounted = await sample();
  await page.screenshot({ path: output + '/preview-fit-' + phase + '.png' });
  await page.evaluate(() => { document.querySelector('main').style.height = '600px'; });
  await page.waitForTimeout(250);
  const resized = await sample();
  await page.evaluate(() => {
    const qa = window.previewFitQa;
    qa.mounted.dispose();
    qa.mounted = qa.reconciler.mount(qa.code, qa.engine.world);
    const scene = qa.engine.world.query(qa.runtime.Scene)[0];
    if (!scene.has(qa.runtime.Source)) scene.add(qa.runtime.Source);
    scene.set(qa.runtime.Source, { value: 'index.tsx:another-film' });
    qa.engine.requestPreviewFit?.();
  });
  await page.waitForTimeout(250);
  const changedScene = await sample();
  await page.screenshot({ path: output + '/preview-scene-change-' + phase + '.png' });
  await page.evaluate(() => {
    const qa = window.previewFitQa;
    qa.engine.world.set(qa.CameraNavigation, { locked: false });
    qa.mounted.dispose();
    qa.mounted = qa.reconciler.mount(qa.code, qa.engine.world);
    const scene = qa.engine.world.query(qa.runtime.Scene)[0];
    if (!scene.has(qa.runtime.Source)) scene.add(qa.runtime.Source);
    scene.set(qa.runtime.Source, { value: 'index.tsx:film' });
    qa.engine.requestPreviewFit?.();
  });
  await page.waitForTimeout(250);
  const unlocked = await sample();
  const result = { phase, deviceScaleFactor, initial, remounted, resized, changedScene, unlocked, errors };
  writeFileSync(output + '/preview-fit-' + phase + '.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (!initial.fits || !resized.fits || errors.length) throw Error('Preview fixture did not initialize cleanly');
  if (phase === 'before' && remounted.fits) throw Error('The reported remount regression was not reproduced');
  if (phase === 'after' && !remounted.fits) throw Error('The remounted preview is still cropped');
  if (phase === 'after' && (!initial.fills || !remounted.fills || !resized.fills)) throw Error('Preview is fitted too small or off center');
  if (phase === 'after' && !changedScene.fills) throw Error('Changing the scene fitted the preview too small or off center');
  if (unlocked.matrix.some((value, index) => Math.abs(value - [0.4,0,0,0.4,60,40][index]) > 0.001)) throw Error('Unlocked authored camera was changed');
} finally { await browser.close(); }
