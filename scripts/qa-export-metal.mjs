// Runs against qa-export-metal-launch.mjs only. Real editor/rendered button;
// the native save picker is cancelled at its IPC boundary for the click check.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const output = resolve('output/playwright/export-metal');
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9367');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('http://127.0.0.1:5417'));
if (!page) throw Error('Isolated QA window missing.');
const button = page.getByRole('button', { name: 'Exportar video', exact: true });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await button.waitFor();
  assert.equal(await button.isEnabled(), true, 'Prepare an active fixture scene in the isolated editor first.');
  const theme = async value => { await page.evaluate(value => { document.documentElement.dataset.kbTheme = value; document.documentElement.style.colorScheme = value; }, value); await page.waitForTimeout(150); };
  const styles = () => button.evaluate(el => { const s = getComputedStyle(el), ring = getComputedStyle(el, '::after'), center = getComputedStyle(el, '::before'); return { width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, color: s.color, center: center.backgroundColor, animation: ring.animationName, transform: ring.transform, outline: s.outlineWidth, outlineStyle: s.outlineStyle, ring: ring.backgroundImage }; });
  await theme('dark');
  const start = await styles();
  await page.waitForTimeout(350);
  assert.notEqual((await styles()).transform, start.transform);
  assert.equal(start.height, 28); assert.ok(start.width < 115);
  checks.push('Real editor: compact 28px button; metal reflection moves only in the rim.');
  await page.screenshot({ path: resolve(output, 'dark-editor.png') });
  const rect = await button.boundingBox();
  const clip = { x: rect.x - 20, y: 0, width: rect.width + 40, height: 52 };
  await page.screenshot({ path: resolve(output, 'dark-detail.png'), clip });
  await button.hover(); await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(output, 'dark-hover.png'), clip });
  await button.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  assert.equal(await button.evaluate(el => el.matches(':focus-visible')), true);
  assert.equal((await styles()).outline, '2px');
  await page.screenshot({ path: resolve(output, 'keyboard-focus.png'), clip });
  checks.push('Keyboard focus visible, native button semantics and readable label retained.');
  await theme('light'); await page.mouse.move(400, 100); await button.evaluate(el => el.blur());
  await page.screenshot({ path: resolve(output, 'light-editor.png') });
  await page.screenshot({ path: resolve(output, 'light-detail.png'), clip });
  const light = await styles(); assert.notEqual(light.center, start.center);
  await page.evaluate(async () => { const appearance = await import('/src/lib/appearance/controller.ts'); appearance.previewAccent('#A78BFA'); });
  assert.notEqual((await styles()).ring, light.ring);
  await page.screenshot({ path: resolve(output, 'light-accent.png'), clip });
  checks.push('Actual light/dark theme tokens and custom accent alter the rim.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal((await styles()).animation, 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { document.documentElement.dataset.motion = 'reduced'; });
  assert.equal((await styles()).animation, 'none');
  await page.evaluate(() => { document.documentElement.dataset.motion = 'system'; document.documentElement.dataset.sykaMotion = 'reduced'; });
  assert.equal((await styles()).animation, 'none');
  await page.evaluate(() => { document.documentElement.dataset.sykaMotion = 'system'; });
  checks.push('OS reduced motion and both application reduced-motion attributes stop the animation.');
  // Exercise the unchanged click handler without opening a native modal or
  // starting an export. Only the save-picker reply is simulated (cancel).
  await page.evaluate(async () => {
    const { mainBridge } = await import('/src/lib/ipc.ts');
    const original = mainBridge.call.bind(mainBridge);
    window.__exportQa = { calls: 0, restore: () => { mainBridge.call = original; } };
    mainBridge.call = async (channel, payload) => {
      if (channel === 'file:pick-export') { window.__exportQa.calls++; return { path: null }; }
      return original(channel, payload);
    };
  });
  await button.click();
  await page.waitForFunction(() => window.__exportQa.calls === 1, null, { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('.syka-header-export').disabled);
  await page.evaluate(() => window.__exportQa.restore());
  checks.push('Real Exportar click reached its existing native picker command once; cancellation was simulated at IPC, no video exported.');
  await theme('dark');
  await page.evaluate(async () => { const appearance = await import('/src/lib/appearance/controller.ts'); appearance.previewAccent('#008CFF'); });
  await button.evaluate(el => el.blur());
  assert.deepEqual(errors, []);
  const evidence = { verifiedAt: new Date().toISOString(), url: page.url(), kind: 'real isolated Electron editor; fixture project', checks, errors, dimensions: { width: start.width, height: start.height }, clickBoundary: 'native picker cancellation simulated; rendering pipeline not changed or claimed as tested' };
  await writeFile(resolve(output, 'verification.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally { await browser.close(); }
