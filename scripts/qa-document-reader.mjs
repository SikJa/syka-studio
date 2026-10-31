// Actual React reader + local browser fixtures. No provider calls or project writes.
import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const output = resolve('output/document-reader-20261010/evidence');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1200, height: 840 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [], checks = [];
page.on('pageerror', error => errors.push(String(error)));
page.setDefaultTimeout(15000);
const title = 'Una botella verde, la luz que recorre su vidrio y un título lo suficientemente largo como para leerlo completo sin que desaparezca fuera de la pantalla';
const sections = Array.from({ length: 18 }, (_, index) => `## Capítulo ${index + 1}\n\n${'La composición conserva el contraste, los reflejos y el ritmo de una pieza de vidrio premium. '.repeat(4)}\n\n**Detalle ${index + 1}:** texto completo para recorrer el documento y probar su navegación.`).join('\n\n');
const body = `# ${title}\n\nDescripción de la prueba, con **jerarquía visual** y el documento completo.\n\n${sections}\n\n## Formatos\n\n| Red | Formato |\n| --- | --- |\n| YouTube | Horizontal |\n\n> Cierre de la pieza.\n\n\`\`\`json\n{"duration":12}\n\`\`\`\n\nFIN DEL DOCUMENTO COMPLETO`;
try {
  await page.goto('http://localhost:5188');
  await page.evaluate(async ({ body, title }) => {
    const react = await import('/node_modules/.vite/deps/react.js');
    const reactDom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { createElement } = react.default || react;
    const { createRoot } = reactDom.default || reactDom;
    const { AgentDocumentReader } = await import('/src/mirel-chat/features/agents/agent-document-reader.tsx');
    const { AgentTextDocumentButton } = await import('/src/mirel-chat/features/agents/agent-local-artifact.tsx');
    await import('/src/mirel-chat/features/agents/agent-workspace.css');
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:101;background:#111;padding:30px'; document.body.append(host);
    const trigger = document.createElement('button'); trigger.textContent = 'Abrir prueba'; host.append(trigger);
    const root = createRoot(host.appendChild(document.createElement('div')));
    window.__openDocument = () => root.render(createElement(AgentDocumentReader, { body, title, fileName: 'documento-completo.md', onClose: () => { root.render(null); window.__closed = true; } }));
    trigger.onclick = window.__openDocument; trigger.focus();
    window.__testTextButton = () => root.render(createElement(AgentTextDocumentButton, { body }));
    window.__testBody = body;
  }, { body, title });
  const initialHash = await page.evaluate(() => location.hash);
  await page.getByRole('button', { name: 'Abrir prueba' }).click();
  const dialog = page.locator('dialog[data-document-reader].is-open');
  await dialog.waitFor();
  assert.equal(await dialog.locator('h1').textContent(), title);
  assert.equal(await dialog.getByText('FIN DEL DOCUMENTO COMPLETO', { exact: true }).count(), 1);
  assert.ok(await dialog.locator('table').count());
  checks.push('long title and full formatted document retained');
  await page.screenshot({ path: output + '/reader-desktop.png' });
  const rail = dialog.getByRole('navigation', { name: 'Secciones del documento' });
  const dash = rail.getByRole('button', { name: 'Ir a Capítulo 8', exact: true });
  const before = await dash.locator('span').evaluate(node => getComputedStyle(node).transform);
  await dash.hover(); await page.waitForFunction(({ before }) => {
    const node = document.querySelector('[aria-label="Ir a Capítulo 8"] span'); return node && getComputedStyle(node).transform !== before;
  }, { before });
  checks.push('original proximity dash responds to pointer');
  await dash.click();
  await page.waitForFunction(() => document.querySelector('.syka-document-scroll').scrollTop > 500);
  assert.equal(await page.evaluate(() => location.hash), initialHash);
  checks.push('section navigation scrolls internal reader and preserves editor route');
  await page.getByRole('button', { name: 'Copiar documento', exact: true }).click();
  // Windows clipboard canonicalizes LF to CRLF; the full text must survive.
  assert.ok((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n') === body, 'complete clipboard text');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descargar documento', exact: true }).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'documento-completo.md');
  assert.equal(await readFile(await download.path(), 'utf8'), body);
  checks.push('copy and download include complete original text');
  for (let index = 0; index < 85; index++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => !!document.activeElement.closest('dialog[data-document-reader]'))); }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__closed && !document.querySelector('dialog[data-document-reader]'));
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Abrir prueba');
  checks.push('native focus containment, Escape and focus restoration');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir prueba' }).click(); await dialog.waitFor();
  assert.ok(await dialog.evaluate(node => node.getBoundingClientRect().width <= innerWidth));
  assert.ok(await dialog.locator('.syka-document-content').evaluate(node => node.scrollWidth <= node.clientWidth));
  await page.screenshot({ path: output + '/reader-mobile.png' });
  checks.push('small screen retains readable title and no horizontal page overflow');
  await page.keyboard.press('Escape'); await page.locator('dialog[data-document-reader]').waitFor({ state: 'detached' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.__testTextButton());
  await page.getByRole('button', { name: 'Leer en pantalla completa' }).click(); await dialog.waitFor();
  assert.equal(await dialog.evaluate(node => getComputedStyle(node).transitionDuration), '0s');
  await dialog.getByRole('button', { name: 'Ir a Capítulo 18', exact: true }).click();
  assert.equal(await page.evaluate(() => location.hash), initialHash);
  await page.keyboard.press('Escape'); await page.locator('dialog[data-document-reader]').waitFor({ state: 'detached' });
  checks.push('long chat response opens same reader; reduced motion applies');
  assert.deepEqual(errors, []);
  await writeFile(output + '/reader-qa.json', JSON.stringify({ checks, errors, realGeneration: false }, null, 2));
  console.log(JSON.stringify({ checks, errors, realGeneration: false }));
} catch (error) {
  await page.screenshot({ path: output + '/reader-failure.png' });
  await writeFile(output + '/reader-qa.json', JSON.stringify({ checks, errors, failure: String(error.stack) }, null, 2));
  throw error;
} finally { await browser.close(); }
