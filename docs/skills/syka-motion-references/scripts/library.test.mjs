import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm, symlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localFile, rankLibrary, retrieveLibrary } from './library.mjs';

const skillRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const catalog = JSON.parse(await readFile(resolve(skillRoot, 'references/collection-index.json'), 'utf8'));

test('cards search excludes games and retrieves installed knowledge without media', async () => {
  const rows = rankLibrary(catalog, { query: 'tarjetas tipografía continuidad', kind: 'video' });
  assert.ok(rows.length > 0);
  assert.ok(rows.every(x => x.row.category !== 'interactive'));
  const result = await retrieveLibrary({ query: 'tarjetas tipografía continuidad', kind: 'video', limit: 2 });
  assert.ok(result.results.length > 0);
  assert.equal(result.knowledgeAvailable, true);
  assert.equal(result.libraryAvailable, false);
  assert.ok(result.results.every(r => r.media.length === 0));
  assert.ok(result.results.every(r => !('sourceText' in r)));
});

test('premium placeholders stay distinct from public descriptions and licensed text', () => {
  const premium = catalog.entries.filter(e => e.promptStatus === 'premium_preview_only');
  assert.ok(premium.length > 0);
  assert.ok(premium.every(e => !e.sourceAccessible && !e.textPath));
  assert.equal(catalog.coverage.publicSkillDocuments, 42);
  assert.equal(catalog.entries.filter(e => e.bundledTextPath).length, 475);
});

test('reviewed filter is based on visual study, never automatic contact generation', () => {
  const reviewed = rankLibrary(catalog, { query: 'tipografía tarjetas', evidence: 'reviewed', limit: 8 });
  assert.ok(reviewed.every(r => r.row.reviewed && r.row.ownAnalysis));
  const automatic = structuredClone(catalog.entries.find(e => !e.reviewed));
  automatic.media = [{ contactPath: 'automatic.jpg', visualReview: 'automatic_samples_only' }];
  const fixture = { ...catalog, entries: [automatic] };
  assert.equal(rankLibrary(fixture, { id: automatic.id, evidence: 'reviewed' }).length, 0);
  assert.equal(rankLibrary(fixture, { id: automatic.id, evidence: 'automatic' }).length, 1);
  assert.ok(catalog.entries.every(e => e.media.length === 0));
});

test('missing research archive still provides the installed licensed source text', async () => {
  const result = await retrieveLibrary({ query: 'tipografía', limit: 1, includeText: true, library: resolve(tmpdir(), 'missing-syka-reference-20261007') });
  assert.equal(result.libraryAvailable, false);
  assert.equal(result.knowledgeAvailable, true);
  assert.equal(result.results[0].sourceAccessible, true);
  assert.equal(result.results[0].sourceStorage, 'bundled_MIT_text');
  assert.ok(result.results[0].sourceText.length > 0);
});

test('source text reads respect the actual JSON output budget', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'syka-library-budget-'));
  try {
    await writeFile(join(folder, 'prompt.txt'), 'An exact reference instruction.\n'.repeat(4000));
    const row = structuredClone(catalog.entries.find(e => e.bundledTextPath));
    row.textPath = 'prompt.txt';
    row.media = [];
    const result = await retrieveLibrary({ catalog: { ...catalog, entries: [row] }, id: row.id, library: folder, includeText: true, maxChars: 4500 });
    assert.ok(result.results[0].sourceTruncated);
    assert.ok(JSON.stringify(result, null, 2).length + 1 <= 4500);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('untrusted paths cannot read outside the selected library', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'syka-library-path-'));
  try { await assert.rejects(localFile(folder, '../outside.txt'), /escapes library/); }
  finally { await rm(folder, { recursive: true, force: true }); }
});

test('catalog preserves every publication identity and all skill identities once', () => {
  assert.equal(new Set(catalog.entries.map(e => e.id)).size, catalog.entries.length);
  assert.equal(catalog.entries.filter(e => e.kind === 'video').length, catalog.coverage.uniqueVideoPublications);
  assert.equal(catalog.entries.filter(e => e.kind === 'skill').length, 387);
});
