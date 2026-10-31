import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
const root = resolve('../Pruebas Syka/17-recorte-personas-v2'), output = resolve('output/background-removal');
await mkdir(join(root, 'assets'), { recursive: true }); await mkdir(output, { recursive: true });
await writeFile(join(root, 'package.json'), JSON.stringify({ name: '17-recorte-personas-v2', displayName: 'Pruebas Syka · 17 · Quitar fondo', projectId: '3e4f81b0-77af-441f-a313-98e2ac3d1718', private: true, type: 'module', main: 'index.tsx' }, null, 2));
await copyFile('.runtime/background-qa/persona.mp4', join(root, 'assets/persona.mp4'));
await copyFile('.runtime/background-qa/original.png', join(root, 'assets/retrato.png'));
try { await readFile(join(root, 'index.tsx')); } catch { await writeFile(join(root, 'index.tsx'), `export default function Film(){return <stage><scene id="main" name="Recorte local · prueba real" width={360} height={640} fill="#377b64" active workarea={[0,2]} playhead={.6}><video id="persona" name="Tu video · original" src="assets/persona.mp4" width={360} height={640} start={0} end={2}/></scene></stage>;}`); }
const browser = await chromium.connectOverCDP('http://127.0.0.1:9367');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('http://127.0.0.1:5417'));
const errors = []; page.on('pageerror', e => errors.push(e.message));
try {
  const project = await page.evaluate(async dir => { const host = await import('/src/projects/host.ts'); return host.openProjectFolder(dir); }, root);
  await page.goto('http://127.0.0.1:5417/#/projects/' + project.id);
  await page.getByText('Tu video · original', { exact: true }).first().waitFor();
  if ((await readFile(join(root, 'index.tsx'), 'utf8')).includes('<audio')) { await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await page.waitForTimeout(1000); }
  await page.getByText('Tu video · original', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Quitar fondo', exact: true }).first().click();
  await page.getByRole('button', { name: 'Quitar fondo', exact: true }).last().click();
  await page.getByRole('button', { name: 'Aplicar recorte', exact: true }).waitFor({ timeout: 180000 });
  await page.screenshot({ path: join(output, 'preview.png') });
  await page.getByRole('button', { name: 'Aplicar recorte', exact: true }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(output, 'aplicado.png') });
  console.log(JSON.stringify({ root, errors, text: (await page.locator('body').innerText()).slice(-2300), source: await readFile(join(root, 'index.tsx'), 'utf8') }));
} finally { await browser.close(); }
