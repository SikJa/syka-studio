import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skillRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
async function allFiles(folder) {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    files.push(...(entry.isDirectory() ? await allFiles(path) : [path]));
  }
  return files;
}

test('relocated skill works offline with installed text and studies, without the archive', async () => {
  const target = await mkdtemp(join(tmpdir(), 'syka-installed-knowledge-'));
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = () => { networkCalls++; throw Error('Network disabled for this installation test.'); };
  try {
    const installed = join(target, 'resources/docs/skills/syka-motion-references');
    await cp(skillRoot, installed, { recursive: true });
    const { retrieveLibrary, localFile } = await import(pathToFileURL(join(installed, 'scripts/library.mjs')).href);
    const result = await retrieveLibrary({ query: 'tarjetas tipografía continuidad', kind: 'video', limit: 3, includeText: true, maxChars: 30000 });
    assert.equal(result.delivery, 'bundled_offline_knowledge');
    assert.equal(result.libraryAvailable, false);
    assert.equal(result.knowledgeAvailable, true);
    assert.equal(result.results.length, 3);
    assert.ok(result.results.some(r => r.ownAnalysis));
    assert.ok(result.results.some(r => r.sourceText?.length > 0));
    assert.ok(result.results.every(r => r.media.length === 0));
    assert.ok(result.results.filter(r => r.sourcePath).every(r => r.sourcePath.startsWith(installed)));
    assert.equal(networkCalls, 0);
    const catalog = JSON.parse(await readFile(join(installed, 'references/collection-index.json'), 'utf8'));
    assert.equal(catalog.delivery, 'bundled_offline_knowledge');
    assert.ok(catalog.entries.every(e => !e.textPath && !e.media.length));
    assert.equal(catalog.entries.filter(e => e.bundledTextPath).length, 475);
    for (const row of catalog.entries.filter(e => e.bundledTextPath)) assert.ok(await localFile(installed, row.bundledTextPath));
    const files = await allFiles(installed);
    assert.ok(files.every(file => !/\.(mp4|webm|mov|jpg|png|webp)$/i.test(file)));
    const bytes = (await Promise.all(files.map(file => stat(file)))).reduce((n, s) => n + s.size, 0);
    assert.ok(bytes < 8 * 1024 ** 2, `Knowledge package unexpectedly large: ${bytes} bytes`);
    const license = await readFile(join(installed, 'references/prompts/LICENSE.awesome-opus5-5-videos.txt'), 'utf8');
    assert.match(license, /MIT License/);
    assert.match(license, /Copyright \(c\) 2026 yihui-dev/);
  } finally { globalThis.fetch = originalFetch; await rm(target, { recursive: true, force: true }); }
});
