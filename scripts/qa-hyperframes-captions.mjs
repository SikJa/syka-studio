import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const output = resolve('../output/audits/captions-cinetic-earshot-20261022');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: 'C:/Users/CHAMP/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 820 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/qa-native-hf-captions', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
    <meta charset="utf-8"><style>body{margin:0;padding:28px;background:#101112;color:#f0f0ee;font:13px Inter,Arial}
    h1{font-size:22px;margin:0 0 6px}p{color:#a5a8aa;margin:0 0 24px}main{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
    article{background:#15171b;border-radius:10px;overflow:hidden}canvas{width:100%;height:240px;object-fit:contain;display:block}h2{font-size:13px;font-weight:500;padding:0 18px}</style>
    <h1>Subtítulos · HyperFrames adaptado a Syka</h1><p>Los ocho presets del renderer nativo · texto de demostración</p><main></main>` }));
  await page.goto('http://127.0.0.1:5188/qa-native-hf-captions');
  const result = await page.evaluate(async () => {
    const { createPresetPreview } = await import('/src/components/sidebar-right/preset-preview.tsx');
    const { EDITOR_RESOURCES } = await import('/src/components/sidebar-right/resources.tsx');
    const resources = EDITOR_RESOURCES.filter(r => r.kind === 'caption' && r.value.startsWith('hyperframes-'));
    const results = [];
    for (const resource of resources) {
      const article = document.createElement('article'), label = document.createElement('h2'), canvas = document.createElement('canvas');
      label.textContent = resource.label; article.append(canvas, label); document.querySelector('main').append(article);
      const preview = createPresetPreview(canvas, resource);
      try {
        await preview.ready();
        await document.fonts.ready;
        const poses = [];
        for (const time of [0.155, 0.24, 0.8, 0.155]) { preview.draw(time); poses.push(canvas.toDataURL()); }
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0;
        for (let p = 0; p < data.length; p += 4) if (Math.max(data[p],data[p+1],data[p+2]) > 80) ink++;
        results.push({ preset: resource.value, hasInk: ink > 100, ink, animated: poses[0] !== poses[1], repeatable: poses[0] === poses[3] });
        preview.draw(.24);
      } finally { preview.dispose(); }
    }
    const runtime = await import('/@fs/E:/Syka Studio/Desarrollo/diffusion-studio/packages/runtime/src/index.ts');
    const reconciler = await import('/@fs/E:/Syka Studio/Desarrollo/diffusion-studio/packages/reconciler/src/index.ts');
    const { captionPreviewLibrary } = await import('/src/components/sidebar-right/caption-preview-library.ts');
    const { getDocumentEditor } = await import('/src/engine/editor.ts');
    const { getEditHistory } = await import('/src/engine/history.ts');
    const world = runtime.createRuntimeWorld('caption-edit-roundtrip');
    world.set(runtime.Library, captionPreviewLibrary());
    const doc = reconciler.mount(`const x=require('@diffusionstudio/jsx');module.exports.default=()=>x.Stage({children:x.Scene({width:1080,height:1920,end:3,children:x.Captions({__source:'index.tsx:captions',src:'sample.json',preset:'bridgeclip-subtle',colors:['#C4F1FF'],start:0.2,end:2.8,sourceIn:0.2,fontFamily:'Urbanist',fontSize:90,x:42})})});`, world);
    try {
      const entity = world.query(runtime.Caption)[0];
      const editor = getDocumentEditor(world), history = getEditHistory(world);
      if (!entity.get(runtime.Source)?.value) throw Error('Fixture has no source stamp');
      const edits = []; editor.onEdit(edit=>edits.push(edit));
      const initial = reconciler.authoredElement(entity).props;
      for (const resource of resources) {
        history.reset();
        history.command(() => { editor.editProperty(entity, 'colors', false); editor.editProperty(entity, 'preset', resource.value); });
        if (!history.canUndo()) throw Error('Fixture history did not receive edits: '+JSON.stringify({source:entity.get(runtime.Source),edits}));
        const next = reconciler.authoredElement(entity).props;
        if (entity.get(runtime.Caption).type !== reconciler.CAPTION_PRESETS[resource.value]) throw Error('Unknown runtime preset '+resource.value);
        for (const key of ['src','start','end','sourceIn','fontFamily','fontSize','x']) if (next[key] !== initial[key]) throw Error('Preset changed authored '+key);
        history.undo();
        const canonical = props => JSON.stringify(Object.fromEntries(Object.entries(props).sort(([a],[b])=>a.localeCompare(b))));
        if (canonical(reconciler.authoredElement(entity).props) !== canonical(initial)) throw Error('Undo did not restore caption: '+JSON.stringify({preset:resource.value,initial,actual:reconciler.authoredElement(entity).props}));
        history.redo();
        if (entity.get(runtime.Caption).type !== reconciler.CAPTION_PRESETS[resource.value]) throw Error('Redo did not restore new preset');
        history.undo();
      }
      return { previews: results, editUndoRedo: true, preservedTimingAndFont: true };
    } finally { doc.dispose(); world.get(runtime.Library).dispose(); world.destroy(); }
  });
  await page.screenshot({ path: resolve(output, 'captions-native-gallery.png'), fullPage: true });
  writeFileSync(resolve(output, 'captions-native-gallery.json'), JSON.stringify({ result, errors }, null, 2));
  assert.equal(result.previews.length, 8);
  assert.deepEqual(errors, []);
  for (const row of result.previews) { assert.ok(row.hasInk, `${row.preset} is blank`); assert.ok(row.animated, `${row.preset} does not animate`); assert.ok(row.repeatable, `${row.preset} changes after a backwards seek`); }
  console.log(JSON.stringify({ result, errors }));
} finally { await browser.close(); }
