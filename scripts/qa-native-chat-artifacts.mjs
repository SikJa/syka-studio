// Read-only file previews in the existing native editor. Never sends a turn or edits its timeline.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const output = 'output/document-reader-20261010/evidence';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9365');
const page = browser.contexts().flatMap(context => context.pages()).find(page => page.url().startsWith('http://localhost:5188'));
assert.ok(page);
page.setDefaultTimeout(15000);
const result = { checks: [], realFiles: true, modelCalled: false, timelineChanged: false };
try {
  if (await page.locator('.agent-image-lightbox-backdrop').count()) {
    await page.keyboard.press('Escape');
    await page.locator('.agent-image-lightbox-backdrop').waitFor({ state: 'detached' });
  }
  if (await page.locator('dialog[data-document-reader][open]').count()) {
    await page.getByRole('button', { name: 'Cerrar documento', exact: true }).click();
    await page.locator('dialog[data-document-reader]').waitFor({ state: 'detached' });
  }
  const initialUrl = page.url();
  const doc = page.locator('[data-local-artifact="document"]').filter({ hasText: 'Borradores para revisión — VERDE' });
  await doc.getByRole('button').click();
  const dialog = page.locator('dialog[data-document-reader].is-open'); await dialog.waitFor();
  const titlebar = await page.evaluate(() => navigator.windowControlsOverlay?.getTitlebarAreaRect().height || 0);
  const bounds = await dialog.boundingBox();
  assert.ok(bounds.y >= titlebar + 16, 'reader top edge clears native controls');
  await page.screenshot({ path: output + '/native-document.png' });
  result.checks.push('actual existing descriptions open in native reader; rounded corner clears Windows controls');
  const youTube = dialog.getByRole('button', { name: 'Ir a YouTube', exact: true });
  await youTube.click(); await page.waitForFunction(() => document.querySelector('.syka-document-scroll').scrollTop > 100);
  assert.equal(page.url(), initialUrl);
  result.checks.push('native section navigation keeps active project route');
  await page.keyboard.press('Escape'); await page.locator('dialog[data-document-reader]').waitFor({ state: 'detached' });
  const photo = page.locator('[data-local-artifact="image"]').last();
  await photo.getByRole('button', { name: 'Abrir imagen en grande', exact: true }).click();
  const large = page.locator('.agent-image-lightbox-backdrop[data-open="true"]'); await large.waitFor();
  assert.equal(await large.locator(':scope > img').evaluate(image => image.naturalWidth), 1920);
  const close = await large.getByRole('button', { name: 'Cerrar previsualización', exact: true }).boundingBox();
  assert.ok(close.y > titlebar, 'image close button clears native controls');
  await page.screenshot({ path: output + '/native-image-expanded.png' });
  result.checks.push('click on actual cover photo opens full image; controls clear Windows titlebar');
  await page.keyboard.press('Escape'); await large.waitFor({ state: 'detached' });
  await photo.scrollIntoViewIfNeeded();
  await page.screenshot({ path: output + '/native-chat-cover.png' });
  const geometry = await photo.evaluate(node => {
    const image = node.querySelector('.syka-image-generation-preview').getBoundingClientRect();
    const dock = node.querySelector('.syka-image-generation-actions').getBoundingClientRect();
    return { below: dock.bottom - image.bottom, centered: Math.abs((dock.left + dock.width / 2) - (image.left + image.width / 2)), path: node.querySelector('.syka-image-generation-edge').getAttribute('d') };
  });
  assert.ok(geometry.below <= 30 && geometry.centered < 1);
  result.geometry = geometry; result.checks.push('approved short curved image dock retained');
  assert.equal(page.url(), initialUrl);
  result.pass = true; await writeFile(output + '/native-qa.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  result.pass = false; result.failure = String(error.message);
  await writeFile(output + '/native-qa.json', JSON.stringify(result, null, 2));
  throw error;
} finally { await browser.close(); }
