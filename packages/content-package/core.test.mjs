import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { captureContext, newPackage, freshness, editCopy, localVariants, PackageStore, PackageJob, generateCopy, reviewPackage, publicationDraft, imageRoute, rebase } from './core.mjs';
import { composeCover } from './cover.mjs';
async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'syka-package-'));
  const videoPath = path.join(root, 'video con espacios ñ.mp4'); await writeFile(videoPath, 'fixture video bytes');
  const input = { projectId: 'fixture', videoPath, videoRevision: '1', exportVerified: true, brief: { subject: 'Edición de prueba', objective: 'Mostrar la edición', format: 'Ensayo' } };
  return { root, input, captured: await captureContext(input) };
}
test('hash changed and brief changed invalidate review without deleting history', async () => {
  const { root, input, captured } = await setup(); const store = new PackageStore(path.join(root, 'portables'));
  let pkg = reviewPackage(editCopy(newPackage(captured), localVariants(input.brief)), captured, 'fixture');
  pkg = await store.save(pkg, captured); assert.equal(publicationDraft(pkg, captured).kind, 'publication-draft');
  await writeFile(input.videoPath, 'changed'); const changed = await captureContext(input);
  assert.equal(freshness(pkg, changed).current, false); assert.throws(() => publicationDraft(pkg, changed));
  const next = await store.save(rebase(pkg, changed), changed); assert.equal(next.copy.variants.length, 0);
  assert.equal((await store.load(pkg.id, 1)).state, 'reviewed'); assert.equal((await store.list(pkg.id)).length, 2);
  input.brief.objective = 'Otro objetivo'; assert.equal(freshness(next, await captureContext(input)).current, false);
});
test('missing context / unverified export / unexpected hash fail', async () => {
  const { input } = await setup();
  await assert.rejects(captureContext({ ...input, brief: {} }), /tema/);
  await assert.rejects(captureContext({ ...input, exportVerified: false }), /verificación/);
  await assert.rejects(captureContext({ ...input, expectedVideoHash: 'bad' }), /Cambió/);
});
test('missing images only block cover; unavailable image capability cannot claim generation', async () => {
  const { captured } = await setup(); assert.equal(newPackage(captured).cover, null);
  assert.throws(() => composeCover({ title: 'Texto' }), /fotograma/); assert.equal(imageRoute().enabled, false);
  assert.equal(imageRoute({ status: 'available', imageGeneration: true }).enabled, false);
});
test('cancellation rejects late provider output, retaining original draft', async () => {
  const { captured } = await setup(); const pkg = newPackage(captured); const job = new PackageJob(); let release;
  const provider = { id: 'explicit-fixture', status: 'configured', capability: 'text', generate: () => new Promise(r => { release = r; }) };
  const pending = job.run(signal => generateCopy(pkg, provider, { signal })); job.cancel();
  await assert.rejects(job.run(async () => 'overlapping'), /operación/);
  release({ variants: localVariants(captured.context.brief) }); await assert.rejects(pending); assert.equal(job.state, 'cancelled'); assert.deepEqual(pkg.copy.variants, []);
});
test('concurrent saves allow only one new revision', async () => {
  const { root, captured } = await setup(); const store = new PackageStore(path.join(root, 'packages')); const pkg = newPackage(captured);
  const results = await Promise.allSettled([store.save(pkg, captured), store.save(pkg, captured)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await store.list(pkg.id)).length, 1);
});
test('tampered context and path traversal are rejected before commit', async () => {
  const { root, captured } = await setup(); const store = new PackageStore(path.join(root, 'packages'));
  const pkg = newPackage(captured); pkg.context = structuredClone(pkg.context); pkg.context.brief.subject = 'tampered';
  await assert.rejects(store.save(pkg, captured), /Contexto/);
  await assert.rejects(store.save({ ...newPackage(captured), id: '../escape' }, captured), /ID/);
});
test('portable immutable writes, concurrent conflict, material bytes and cancellation', async () => {
  const { root, input } = await setup(); const transcript = path.join(root, 'texto ñ.txt'); await writeFile(transcript, 'Fuente literal');
  const captured = await captureContext({ ...input, materials: [{ kind: 'transcript', path: transcript, source: 'existing transcript' }] });
  const store = new PackageStore(path.join(root, 'destino con espacios ñ')); const pkg = newPackage(captured);
  const saved = await store.save(pkg, captured); assert.equal(saved.revision, 1);
  const json = JSON.stringify(saved); assert.equal(json.includes(root.replaceAll('\\', '\\\\')), false);
  assert.equal(await readFile(path.join(store.root, pkg.id, captured.materials[0].file), 'utf8'), 'Fuente literal');
  await assert.rejects(store.save(pkg, captured), /Conflicto/);
  const controller = new AbortController(); controller.abort(); await assert.rejects(store.save(saved, captured, { signal: controller.signal }));
  assert.equal((await store.list(pkg.id)).length, 1);
  assert.equal((await readdir(path.join(store.root, pkg.id))).includes('.write-lock'), false);
});
test('editing reviewed copy invalidates approval, including direct mutation', async () => {
  const { captured } = await setup(); const reviewed = reviewPackage(editCopy(newPackage(captured), localVariants(captured.context.brief)), captured, 'fixture');
  assert.throws(() => publicationDraft(editCopy(reviewed, localVariants(captured.context.brief)), captured));
  reviewed.copy.variants[0].title = 'Changed'; assert.throws(() => publicationDraft(reviewed, captured));
});
test('provider output validation and missing configuration', async () => {
  const { captured } = await setup(); const pkg = newPackage(captured);
  await assert.rejects(generateCopy(pkg));
  await assert.rejects(generateCopy(pkg, { capability: 'text', status: 'configured', generate: async () => ({ variants: [{ title: 'bad' }] }) }));
});
test('SVG active content is rejected and title markup is escaped', () => {
  const frame = { kind: 'frame', file: 'frame.svg', bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>') };
  assert.match(composeCover({ frame, title: '<hello>' }), /&lt;hello&gt;/);
  assert.throws(() => composeCover({ frame: { ...frame, bytes: Buffer.from('<svg><script>alert(1)</script></svg>') }, title: 'x' }));
});
