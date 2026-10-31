import { chromium } from 'playwright-core';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const output = resolve('output/previews/image-generation');
const url = 'http://localhost:5188/@fs/' + resolve(output, 'preview.html').replaceAll('\\', '/');
const browser = await chromium.launch({ headless: true });
let context;
try {
  await mkdir(resolve(output, 'recordings'), { recursive: true });
  context = await browser.newContext({ viewport: { width: 420, height: 700 }, recordVideo: { dir: resolve(output, 'recordings'), size: { width: 420, height: 700 } } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  await page.goto(url);
  await page.locator('[data-slot="grid-reveal"]').waitFor();
  await page.screenshot({ path: resolve(output, 'generating.png') });
  await page.locator('.preview-generation[data-ready="true"]').waitFor({ timeout: 15000 });
  await page.locator('.preview-dock').evaluate(async node => { await Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished)); });
  const picture = await page.locator('.preview-picture').boundingBox();
  const buttons = await page.locator('.preview-dock-buttons').boundingBox();
  const surface = await page.locator('.preview-dock-surface').boundingBox();
  assert.ok(surface.y >= picture.y + picture.height - 1.5, 'The photo must not hide the curved shoulders');
  assert.ok(surface.y + surface.height - picture.y - picture.height <= 30, 'The base must end near the marked cut');
  assert.ok(buttons.y + buttons.height <= surface.y + surface.height, 'Keep the icon hit areas inside the shortened base');
  assert.ok(buttons.y >= picture.y + picture.height);
  assert.ok(buttons.y - picture.y - picture.height <= 8, 'Keep the buttons close without hiding the curve');
  assert.ok(Math.abs(buttons.x + buttons.width / 2 - picture.x - picture.width / 2) < 1);
  await page.screenshot({ path: resolve(output, 'ready.png') });
  await page.screenshot({ path: resolve(output, 'curve-restored.png'), clip: { x: picture.x, y: picture.y + picture.height - 16, width: picture.width, height: 72 } });
  await page.screenshot({ path: resolve(output, 'short-curved-base.png'), clip: { x: picture.x, y: picture.y + picture.height - 16, width: picture.width, height: 49 } });
  await page.waitForTimeout(2000); // Retain the finished design in the requested animation preview.
  const video = page.video();
  await page.close(); await context.close(); context = undefined;
  await video.saveAs(resolve(output, 'generacion-completa.webm'));

  const checkContext = await browser.newContext({ viewport: { width: 420, height: 700 } });
  const check = await checkContext.newPage(); check.on('pageerror', error => errors.push(String(error)));
  await check.goto(url);
  await check.locator('.preview-generation[data-ready="true"]').waitFor({ timeout: 15000 });
  const download = check.waitForEvent('download');
  await check.getByRole('link', { name: 'Descargar imagen' }).click();
  assert.equal((await download).suggestedFilename(), 'hermes-index.png');
  await check.getByRole('button', { name: 'Ampliar imagen' }).click();
  await check.getByRole('dialog', { name: 'Portada ampliada' }).waitFor();
  await check.keyboard.press('Escape');
  assert.equal(await check.getByRole('dialog').count(), 0);
  await check.getByRole('checkbox', { name: 'Mostrar el contorno' }).check();
  await check.screenshot({ path: resolve(output, 'contour.png') });
  await check.getByRole('button', { name: 'Repetir', exact: true }).click();
  await check.locator('[data-slot="grid-reveal"]').waitFor();
  assert.equal(await check.locator('.preview-generation[data-ready="true"]').count(), 0);
  await checkContext.close();
  assert.deepEqual(errors, []);
  const result = { checks: ['complete generation animation uses actual GridReveal', 'dock below photo with connected corner curves', 'buttons are centered in a straight row', 'download works', 'lightbox and Escape work', 'replay resets generation'], errors, realGeneration: false, url };
  await writeFile(resolve(output, 'verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await context?.close(); await browser.close(); }
