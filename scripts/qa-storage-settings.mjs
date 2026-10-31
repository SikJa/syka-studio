// Hidden Electron + real native IPC. Tiny isolated files; no account/model calls.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { access, lstat, mkdir, mkdtemp, readFile, realpath, rm, unlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { build } from 'esbuild';
import { _electron as electron } from 'playwright-core';
import { createStorageJob, finishStorageJob, moveToStorageTrash } from '../packages/agent-chat/src/host/storage-ledger.ts';

if (process.argv.includes('--help')) { console.log('Usage: node scripts/qa-storage-settings.mjs\nRequires the existing web server on http://localhost:5188. Uses a hidden Electron fixture and removes its own temporary profile.'); process.exit(0); }
const root = resolve('.'), output = join(root, 'output', 'qa-storage');
const temporary = await realpath(await mkdtemp(join(tmpdir(), 'syka-storage-ui-'))), runtime = join(temporary, 'runtime'), profile = join(runtime, 'profile'), project = join(temporary, 'project');
await mkdir(output, { recursive: true }); await mkdir(profile, { recursive: true }); await mkdir(project);
const cache = join(profile, 'providers', 'groq-transcripts'); await mkdir(cache, { recursive: true });
const oldCache = join(cache, 'a'.repeat(64) + '.json'), recentCache = join(cache, 'b'.repeat(64) + '.json');
await writeFile(oldCache, 'old cache'); await writeFile(recentCache, 'recent cache');
const now = Date.now(); await utimes(oldCache, (now - 40 * 86400000) / 1000, (now - 40 * 86400000) / 1000);
const original = join(project, 'main.tsx'); await writeFile(original, 'protected project source');
const media = join(project, 'original.mp4'); await writeFile(media, 'protected video');
const id = randomUUID(), stage = join(runtime, 'video-imports', id); await mkdir(stage, { recursive: true }); await writeFile(join(stage, 'partial.mp4'), 'abandoned');
await createStorageJob(runtime, { id, kind: 'video-import', base: runtime, path: stage }); await finishStorageJob(runtime, id);
const ledgerPath = join(runtime, 'storage', 'jobs', `${id}.json`), ledger = JSON.parse(await readFile(ledgerPath, 'utf8')); ledger.createdAt = ledger.finishedAt = now - 2 * 86400000; await writeFile(ledgerPath, JSON.stringify(ledger));
const reference = join(project, '03 Assets reutilizables', 'Referencias', 'ref-' + randomUUID()); await mkdir(reference, { recursive: true }); await writeFile(join(reference, 'frame.jpg'), 'saved reference');
await moveToStorageTrash(runtime, project, reference, 'reference', 'Referencia para recuperar');
const html = join(output, 'fixture.html'), fixtureModule = join(output, 'fixture.ts');
const record = { id: 'qa-storage', dir: project, name: 'Proyecto de prueba', displayName: 'Proyecto de prueba', entry: 'main.tsx', modifiedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
await writeFile(fixtureModule, `
import {render} from 'solid-js/web';
import {createComponent} from 'solid-js';
import {Router} from '@solidjs/router';
import '/src/index.css';
import {SykaSettingsRoot} from '/src/components/settings/modal.tsx';
import {RecordingSettings} from '/src/components/settings/recording.tsx';
import {openSettings} from '/src/components/settings/state.ts';
import {addProjectRecords} from '/src/lib/db.ts';
window.qaLoaded='imported';await addProjectRecords([${JSON.stringify(record)}]);window.qaLoaded='database';
openSettings('storage');render(()=>createComponent(Router,{root:()=>createComponent(SykaSettingsRoot,{panes:{tools:RecordingSettings}})}),document.getElementById('root'));window.qaLoaded='rendered';
`);
await writeFile(html, `<!doctype html><html data-kb-theme="dark" data-platform="win32"><head><meta charset="utf-8"><style>body{margin:0;font-family:Inter,sans-serif;background:var(--background);color:var(--foreground)}#root{height:100vh}</style></head><body><div id="root"></div><textarea aria-label="Texto de prueba"></textarea><script type="module" src="/@fs/${fixtureModule.replaceAll('\\','/')}"></script></body></html>`);
const url = 'http://localhost:5188/@fs/' + html.replaceAll('\\', '/');
const main = join(output, 'main.cjs');
await build({ stdin: { contents: `import {app,BrowserWindow,session} from 'electron';import {mainBridge} from ${JSON.stringify(join(root, 'apps/desktop/src/main-manager.ts'))};import {MAIN_CHANNELS} from ${JSON.stringify(join(root, 'apps/desktop/src/main-channels.ts'))};import {registerStorage} from ${JSON.stringify(join(root, 'apps/desktop/src/storage/register.ts'))};import {registerStudioSettings} from ${JSON.stringify(join(root, 'apps/desktop/src/studio-settings.ts'))};
app.disableHardwareAcceleration();app.setPath('userData',${JSON.stringify(profile)});process.env.SYKA_RUNTIME_ROOT=${JSON.stringify(runtime)};let control;
app.whenReady().then(async()=>{session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('http://localhost:5188/')&&!details.url.startsWith('ws://localhost:5188/')&&!details.url.startsWith('data:')}));mainBridge.setRequestGuard(event=>event.sender===control?.webContents);registerStudioSettings(mainBridge);const storage=registerStorage(mainBridge,()=>false);await Promise.resolve();storage.stop();mainBridge.handle(MAIN_CHANNELS.SYKA_PERMISSIONS,()=>({clipboard:true,fonts:true,microphone:true,notifications:true}));control=new BrowserWindow({width:1100,height:820,show:false,webPreferences:{preload:${JSON.stringify(join(root,'apps/desktop/dist/preload.js'))},contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});await control.loadURL(${JSON.stringify(url)});});app.on('window-all-closed',()=>app.quit());`, resolveDir: root, sourcefile: 'storage-settings-qa.ts', loader: 'ts' }, outfile: main, bundle: true, platform: 'node', format: 'cjs', external: ['electron'] });
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
const require = createRequire(import.meta.url), application = await electron.launch({ executablePath: require('electron'), args: [main], env, timeout: 30000 });
let page; const diagnostics = { errors: [], console: [], failedRequests: [] };
try {
  page = await application.firstWindow(); page.setDefaultTimeout(12000); const errors = diagnostics.errors; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') diagnostics.console.push(message.text()); });
  page.on('requestfailed', request => diagnostics.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  await page.waitForURL(url); await page.waitForLoadState('networkidle'); await page.reload({waitUntil:'networkidle'});
  await page.getByText('Limpieza automática', { exact: true }).waitFor();
  assert.equal(await page.getByRole('checkbox', { name: 'Limpiar automáticamente', exact: true }).isChecked(), true);
  await page.getByRole('button', { name: /^Conservar caché sin uso/ }).click();
  await page.getByRole('option', { name: '7 días', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[aria-label="Conservar caché sin uso"]')?.textContent?.includes('7 días'));
  await page.reload({ waitUntil: 'networkidle' }); await page.getByRole('button', { name: /^Conservar caché sin uso/ }).waitFor();
  assert.ok((await page.getByRole('button', { name: /^Conservar caché sin uso/ }).innerText()).includes('7 días'));
  await page.screenshot({ path: join(output, 'storage-dark.png') });
  await page.getByRole('button', { name: 'Revisar limpieza', exact: true }).click();
  await page.getByRole('region', { name: 'Revisión de limpieza', exact: true }).waitFor(); await access(oldCache); await access(stage);
  await page.getByRole('button', { name: 'Confirmar limpieza', exact: true }).click();
  await page.getByRole('region', { name: 'Revisión de limpieza', exact: true }).waitFor({ state: 'hidden' });
  await assert.rejects(access(oldCache)); await assert.rejects(access(stage)); await access(recentCache);
  assert.equal(await readFile(media, 'utf8'), 'protected video'); assert.equal(await readFile(original, 'utf8'), 'protected project source');
  await page.getByRole('button', { name: 'Recuperar', exact: true }).click();
  await page.getByText('Referencia para recuperar', { exact: true }).waitFor({ state: 'hidden' }); assert.equal(await readFile(join(reference, 'frame.jpg'), 'utf8'), 'saved reference');
  await page.keyboard.press('Control+,'); await page.getByText('Accesos rápidos', { exact: true }).waitFor();
  await page.keyboard.press('F1'); await page.getByText('Accesos de Syka', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: /^Audio predeterminado de grabación/ }).click(); await page.getByRole('option', { name: 'Sólo micrófono', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Transcribir mi voz al terminar', exact: true }).uncheck();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('syka.recording.preferences.v1'))), { audio: 'microphone', transcribe: false });
  await page.keyboard.press('Control+Shift+,'); await page.getByText('Limpieza automática', { exact: true }).waitFor();
  await page.evaluate(() => { document.documentElement.dataset.kbTheme = 'light'; });
  await page.locator('.syka-settings-body').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: join(output, 'storage-light.png') });
  await page.setViewportSize({ width: 560, height: 780 }); await page.screenshot({ path: join(output, 'storage-narrow.png') });
  assert.equal(await page.locator('.syka-settings-content').evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
  const policyFile = join(runtime, 'storage-policy.json'), savedPolicy = await readFile(policyFile, 'utf8');
  await writeFile(policyFile, 'broken'); await page.reload({waitUntil:'networkidle'});
  await page.getByRole('alert').filter({hasText:'La limpieza se detuvo'}).waitFor();
  assert.equal(await page.getByRole('button', {name:'Revisar limpieza',exact:true}).isDisabled(),true);
  await writeFile(policyFile, savedPolicy); await page.getByRole('button', {name:'Volver a intentar',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Limpiar automáticamente"]')?.disabled===false);
  await page.getByRole('button', { name: 'Cerrar configuración', exact: true }).click();
  await page.getByRole('textbox', { name: 'Texto de prueba', exact: true }).focus(); await page.keyboard.press('Control+,');
  await page.getByText('Accesos rápidos', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  const result = { passed: true, nativeIPC: true, checks: ['persistent deadlines after reload', 'preview does not delete', 'confirmed cleanup', 'originals preserved', 'recent cache preserved', 'trash restored', 'settings and storage shortcuts', 'shortcuts from text input', 'recording preferences persisted', 'light and dark themes', 'narrow layout', 'broken preferences show recoverable error and block cleanup'], errors };
  await writeFile(join(output, 'verification.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} catch (error) { if (page) { await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {}); diagnostics.state=await page.evaluate(()=>({loaded:window.qaLoaded,body:document.body.innerText})).catch(String); } console.error(JSON.stringify({errors:diagnostics.errors,console:diagnostics.console,failedRequests:diagnostics.failedRequests})); await writeFile(join(output, 'failure.json'), JSON.stringify(diagnostics, null, 2)); throw error; }
finally {
  await application.close();
  for (const file of [main, html, fixtureModule]) {
    if (dirname(resolve(file)) !== resolve(output) || (await lstat(file)).isSymbolicLink()) throw Error('Unsafe QA artifact cleanup');
    await unlink(file);
  }
  const tempRoot = await realpath(tmpdir()); if (!resolve(temporary).startsWith(tempRoot + sep + 'syka-storage-ui-') || (await lstat(temporary)).isSymbolicLink()) throw Error('Unsafe QA cleanup');
  await rm(temporary, { recursive: true, force: true });
}
