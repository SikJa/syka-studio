// Isolated Vite server: changes the transformed test module in memory only.
// No source edits, Electron reloads, user projects or paid generation.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const card = resolve('apps/web/src/mirel-chat/features/agents/image-generation-card.tsx');
const output = resolve('output/playwright/image-generation-chat');
let revision = 1;
const server = await createServer({
  root: resolve('apps/web'), configFile: resolve('apps/web/vite.config.ts'),
  cacheDir: resolve('.runtime/qa-image-card-hmr-vite'),
  server: { port: 5193, strictPort: true },
  plugins: [{
    name: 'isolated-image-card-hmr-fixture', enforce: 'pre',
    transform(source, id) {
      if (id.split('?')[0].replaceAll('\\', '/') !== card.replaceAll('\\', '/')) return;
      return source.replace('data-image-generation={props.status}', `data-image-generation={props.status} data-qa-card-revision="${revision}"`);
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('http://localhost:5193');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/agent-chat/image-generation-item.tsx')).text();
    const imported = pattern => source.match(new RegExp('from ["\']([^"\']*' + pattern + '[^"\']*)["\']'))?.[1];
    const solid = await import(imported('/solid-js\\.js'));
    const web = await import(imported('/solid-js_web\\.js'));
    const { ImageGenerationItem, GeneratedImagesContext } = await import('/src/agent-chat/image-generation-item.tsx');
    const { ChatActionsContext } = await import(imported('/src/agent-chat/mirel-messages\\.tsx'));
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:100;background:#111;padding:32px';
    host.className = 'syka-agent-chat'; document.body.append(host);
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
    canvas.getContext('2d').fillRect(0, 0, 320, 180);
    const file = new File([await new Promise(done => canvas.toBlob(done))], 'fixture.png', { type: 'image/png' });
    const path = '03 Assets reutilizables/Generados/Codex/codex-9df30299-bbcf-4347-8091-093d55fa76cc.png';
    const asset = { id: 'hmr-fixture', source: path, width: 320, height: 180, handle: { getFile: async () => file } };
    const item = { id: 'image', kind: 'tool', name: 'imageGeneration', status: 'done', output: JSON.stringify({ provider: 'Codex subscription', path, absolutePath: 'D:/Fixture/' + path, bytes: file.size }) };
    window.__hmrPageMarker = crypto.randomUUID(); window.__hmrInserts = 0;
    web.render(() => solid.createComponent(GeneratedImagesContext.Provider, {
      value: { registration: () => ({ asset }), insert: () => window.__hmrInserts++ },
      get children() { return solid.createComponent(ChatActionsContext.Provider, {
        value: { running: () => false, isActiveItem: () => true },
        get children() { return solid.createComponent(ImageGenerationItem, { item }); },
      }); },
    }), host);
  });
  await page.locator('[data-qa-card-revision="1"] .syka-image-generation-preview>img').waitFor();
  const marker = await page.evaluate(() => window.__hmrPageMarker);
  revision = 2;
  server.watcher.emit('change', card);
  await page.locator('[data-qa-card-revision="2"] .syka-image-generation-preview>img').waitFor();
  assert.equal(await page.evaluate(() => window.__hmrPageMarker), marker);
  await page.getByRole('button', { name: 'Agregar al video' }).click();
  assert.equal(await page.evaluate(() => window.__hmrInserts), 1);
  assert.deepEqual(errors, []);
  const result = { checks: ['mounted React card updates through Solid bridge', 'existing page is not reloaded', 'asset actions still work after hot update'], errors };
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'hmr-verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser?.close(); await server.close();
}
