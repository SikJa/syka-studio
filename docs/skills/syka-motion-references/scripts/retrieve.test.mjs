import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { loadCatalog, rankReferences, retrieve } from './retrieve.mjs';

const catalog = await loadCatalog();
const shape = 'post-2103273003555402193';
const speech = 'post-2103458245213929495';
const spotify = 'post-2103801834930606193';

test('Spanish narrative typography retrieves the observed structural speech', () => {
  const rows = rankReferences(catalog, { query: 'tipografía discurso palabras arquitectura' });
  assert.equal(rows[0].entry.id, speech);
  assert.equal(rows[0].entry.visualReview, 'sampled_frames_reviewed');
});

test('UI state morph retrieves its analyzed reference; launch excludes games', () => {
  assert.equal(rankReferences(catalog, { query: 'shape morph UI states' })[0].entry.id, shape);
  const launch = rankReferences(catalog, { query: 'lanzamiento SaaS interfaz continuidad', limit: 3 });
  assert.equal(launch.length, 3);
  assert.ok(launch.every(r => r.entry.category !== 'interactive'));
  assert.ok(launch.some(r => r.entry.id === spotify));
});

test('portal search finds the actual portal/parallax brief rather than a bookkeeping panel', () => {
  const rows = rankReferences(catalog, { query: 'portal parallax infinite zoom' });
  assert.equal(rows[0].entry.id, 'post-2103129343253778767');
});

test('bounded retrieval diversifies identical prompt groups and never injects prompt bodies by default', async () => {
  const result = await retrieve({ query: 'showreel', limit: 8 });
  assert.ok(result.results.length <= 8);
  assert.equal(new Set(result.results.map(r => r.promptGroup)).size, result.results.length);
  assert.ok(result.results.every(r => !('promptText' in r)));
  assert.deepEqual(rankReferences(catalog, { query: 'zzzxqvnotarealword' }), []);
});

test('long licensed prompt is valid JSON within the rendered output budget', async () => {
  const result = await retrieve({ id: spotify, includePrompt: true, maxChars: 6000 });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].localPromptAvailable, true);
  assert.equal(result.results[0].promptTruncated, true);
  assert.ok(result.results[0].promptText.length > 0);
  assert.ok(JSON.stringify(result, null, 2).length + 1 <= 6000);
});

test('installed catalog without local private corpus returns evidence and explicit unavailability', async () => {
  const result = await retrieve({ id: shape, library: resolve(tmpdir(), 'nonexistent-syka-prompt-library-20261006'), includePrompt: true });
  assert.equal(result.results[0].localPromptAvailable, false);
  assert.equal(result.results[0].analysisFile.endsWith('shape-morph.md'), true);
  assert.equal(result.results[0].modelEvidence, 'curator_or_author_claim_only');
  assert.equal(result.results[0].rights.productionAsset, false);
});

test('conflicting provenance and website-only rights survive retrieval', async () => {
  const taxtello = await retrieve({ id: 'post-2104139720829636937' });
  assert.equal(taxtello.results[0].textVariantsDiffer, true);
  assert.equal(taxtello.results[0].promptStatus, 'post_text_only');
  const entry = catalog.entries.find(e => e.viewUrl === 'https://prompt-motion.com/notdwd-c2037d');
  const web = await retrieve({ id: entry.id, includePrompt: true });
  assert.equal(web.results[0].localPromptAvailable, false);
  assert.equal(web.results[0].promptStatus, 'website_only_not_retained');
  assert.ok(!('promptText' in web.results[0]));
});

test('untrusted catalog cannot read a prompt outside the selected library', async () => {
  const library = await mkdtemp(join(tmpdir(), 'syka-reference-path-'));
  try {
    const malicious = structuredClone(catalog.entries.find(e => e.id === shape));
    malicious.prompt.path = '../outside.txt';
    await assert.rejects(retrieve({ catalog: { ...catalog, entries: [malicious] }, id: shape, library }), /escapes library/);
  } finally { await rm(library, { recursive: true, force: true }); }
});

test('coverage preserves every original post and source; reviewed files are readable', async () => {
  assert.equal(catalog.entries.length, 528);
  assert.equal(new Set(catalog.entries.map(e => e.id)).size, 528);
  assert.equal(catalog.entries.reduce((n, e) => n + e.sources.length, 0), 705);
  const reviewed = catalog.entries.filter(e => e.visualReview === 'sampled_frames_reviewed');
  assert.equal(reviewed.length, 8);
  for (const entry of reviewed) {
    const result = await retrieve({ id: entry.id });
    assert.ok((await readFile(result.results[0].analysisFile, 'utf8')).length > 500);
  }
});
