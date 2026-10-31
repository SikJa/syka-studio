// Native Electron integration check. Only a synthetic video and a fake API key are used.
// The desktop build and the isolated Vite server (5298) must already be running.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { _electron } = require(process.env.SYKA_PLAYWRIGHT_PATH || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, '.runtime/publication/qa');
const fixture = join(output, 'syka-publication-fixture.mp4');
await readFile(fixture);
const runtime = await mkdtemp(join(root, '.runtime/publication-e2e-'));
const env = { ...process.env, SYKA_RUNTIME_ROOT: runtime, SYKA_MEDIA_ROOT: join(runtime, 'projects'), SYKA_DEV_URL: 'http://localhost:5298', SYKA_DEV_PORT: '5298', SYKA_MCP_PORT: '3300' };
delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS; delete env.SYKA_QA_CDP_PORT;
const key = `sk_${'e'.repeat(64)}`;
const errors = [];
let electronApp;
async function launch() {
  electronApp = await _electron.launch({ executablePath: require('electron'), args: [join(root, 'apps/desktop')], cwd: root, env });
  await electronApp.evaluate(({ dialog, BrowserWindow }, file) => {
    // Stub the native chooser, never the publication IPC handler or media inspector.
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    globalThis.__publicationQaRequests = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (/https:\/\/(?:mcp\.)?zernio\.com/.test(url)) {
        globalThis.__publicationQaRequests.push(url);
        throw Error('QA offline: las llamadas a Zernio están bloqueadas.');
      }
      return originalFetch(input, init);
    };
    for (const window of BrowserWindow.getAllWindows()) window.setSize(1200, 980);
  }, fixture);
  const page = await electronApp.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  return page;
}
try {
  let page = await launch();
  await page.goto('http://localhost:5298/#/?dashboard=zernio');
  await page.getByRole('button', { name: 'API key', exact: true }).click();
  await page.getByLabel('Nombre de la conexión').fill('QA sin conexión externa');
  await page.getByLabel('API key de Zernio', { exact: true }).fill(key);
  await page.getByRole('button', { name: 'Guardar conexión', exact: true }).click();
  await page.getByText('QA sin conexión externa', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('API key de Zernio', { exact: true }).inputValue(), '');
  const statePath = join(runtime, 'profile/providers/zernio/state.json');
  let state = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(state.connections.length, 1);
  const credential = await readFile(join(runtime, 'profile/providers/zernio', `${state.connections[0].id}.credential`));
  assert.equal(credential.includes(Buffer.from(key)), false);
  assert.equal(JSON.stringify(state).includes(key), false);
  await page.goto('http://localhost:5298/#/?dashboard=publication');
  await page.getByRole('button', { name: 'Elegir video exportado', exact: true }).click();
  await page.getByText('syka-publication-fixture.mp4', { exact: true }).waitFor();
  const caption = 'Prueba de persistencia local.\nNo se envía a ninguna plataforma.';
  await page.getByLabel('Texto de la publicación', { exact: true }).fill(caption);
  await page.getByRole('button', { name: 'Programar', exact: true }).click();
  const date = page.locator('input[type="datetime-local"]');
  await date.fill('');
  await page.getByText('Elegí una fecha y una hora antes de guardar.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Guardar borrador', exact: true }).isDisabled(), true);
  const future = new Date(Date.now() + 3600_000);
  future.setMinutes(future.getMinutes() - future.getTimezoneOffset());
  await date.fill(future.toISOString().slice(0, 16));
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await page.getByText('Guardá los cambios antes de revisar el envío.', { exact: true }).waitFor({ state: 'hidden' });
  state = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(state.drafts.length, 1);
  const draft = state.drafts[0];
  assert.equal(draft.text, caption); assert.equal(draft.phase, 'local_draft');
  assert.equal(draft.externalPostId, null); assert.equal(draft.attempt, null); assert.equal(draft.upload, null);
  assert.equal(draft.media.width, 360); assert.equal(draft.media.height, 640);
  assert.equal(draft.media.videoCodec, 'avc');
  assert.ok(draft.media.duration >= 4 && draft.media.duration < 4.2);
  assert.equal(draft.timing.mode, 'schedule');
  assert.deepEqual(await electronApp.evaluate(() => globalThis.__publicationQaRequests), []);
  await page.screenshot({ path: join(output, 'draft-offline.png') });
  await electronApp.close(); electronApp = null;
  page = await launch();
  await page.goto('http://localhost:5298/#/?dashboard=publication');
  await page.getByText('syka-publication-fixture.mp4', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Texto de la publicación', { exact: true }).inputValue(), caption);
  assert.ok(await page.locator('input[type="datetime-local"]').inputValue());
  assert.equal(await page.getByRole('button', { name: 'Guardar borrador', exact: true }).isDisabled(), true);
  await page.screenshot({ path: join(output, 'draft-after-restart.png') });
  await page.getByRole('button', { name: 'Conexiones Zernio', exact: true }).click();
  await page.getByText('QA sin conexión externa', { exact: true }).waitFor();
  await electronApp.evaluate(() => {
    const offlineFetch = globalThis.fetch;
    globalThis.__publicationQaFixtureRequests = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin === 'https://zernio.com' && url.pathname.startsWith('/api/v1/')) {
        if (init?.method !== 'GET') throw Error('QA: ninguna escritura remota está permitida.');
        globalThis.__publicationQaFixtureRequests.push(url.pathname);
        const data = url.pathname.endsWith('/auth/verify') ? { valid: true, userId: 'fixture-owner', name: 'Identidad simulada de QA' }
          : url.pathname.endsWith('/accounts/health') ? { accounts: [{ accountId: 'qa-youtube', status: 'healthy', canPost: true }, { accountId: 'qa-instagram', status: 'healthy', canPost: true }] }
          : url.pathname.endsWith('/accounts') ? { accounts: [{ _id: 'qa-youtube', platform: 'youtube', username: 'Canal simulado QA', isActive: true }, { _id: 'qa-instagram', platform: 'instagram', username: 'Reels simulados QA', isActive: true }] }
          : null;
        if (!data) throw Error('Endpoint fuera del fixture de QA.');
        return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
      }
      return offlineFetch(input, init);
    };
  });
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await page.getByText('Canal simulado QA', { exact: true }).waitFor();
  await page.goto('http://localhost:5298/#/?dashboard=publication');
  await page.getByLabel('Conexión de Zernio', { exact: true }).selectOption({ label: 'QA sin conexión externa' });
  await page.getByLabel('Cuenta de destino', { exact: true }).selectOption('qa-youtube');
  await page.getByLabel('Título de YouTube', { exact: true }).fill('Título de prueba local');
  await page.getByLabel('Visibilidad', { exact: true }).selectOption('unlisted');
  await page.getByText('Contenido creado para niños', { exact: true }).click();
  await page.getByText('Contiene contenido sintético que requiere declaración', { exact: true }).click();
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await page.getByText('Guardá los cambios antes de revisar el envío.', { exact: true }).waitFor({ state: 'hidden' });
  state = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(state.drafts[0].target.accountId, 'qa-youtube');
  assert.equal(state.drafts[0].visibility, 'unlisted');
  assert.equal(state.drafts[0].madeForKids, true); assert.equal(state.drafts[0].syntheticMedia, true);
  await page.getByRole('button', { name: 'Revisar publicación', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar programación', exact: true }).waitFor();
  await page.screenshot({ path: join(output, 'review-youtube-fixture.png') });
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByLabel('Cuenta de destino', { exact: true }).selectOption('qa-instagram');
  assert.equal(await page.getByLabel('Título de YouTube', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await page.getByText('Guardá los cambios antes de revisar el envío.', { exact: true }).waitFor({ state: 'hidden' });
  state = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(state.drafts[0].target.platform, 'instagram'); assert.equal(state.drafts[0].externalPostId, null); assert.equal(state.drafts[0].attempt, null);
  await page.getByRole('button', { name: 'Revisar publicación', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar programación', exact: true }).waitFor();
  await page.screenshot({ path: join(output, 'review-instagram-fixture.png') });
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  assert.equal((await electronApp.evaluate(() => globalThis.__publicationQaFixtureRequests)).length, 3);
  await page.getByRole('button', { name: 'Conexiones Zernio', exact: true }).click();
  await page.getByRole('button', { name: 'Quitar', exact: true }).click();
  await page.getByRole('button', { name: 'Quitar conexión', exact: true }).click();
  await page.getByText('Todavía no agregaste una conexión.').waitFor();
  assert.deepEqual(await electronApp.evaluate(() => globalThis.__publicationQaRequests), []);
  assert.deepEqual(errors, []);
  const report = { runtime, syntheticFixture: fixture, nativeMediaInspected: true, secureStorage: true, emptyDateBlocked: true, persistedAfterElectronRestart: true, youtubeAndInstagramReview: true, simulatedReads: 3, secretRemoved: true, providerRequests: 0, errors };
  await writeFile(join(output, 'offline-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await electronApp?.close(); }
