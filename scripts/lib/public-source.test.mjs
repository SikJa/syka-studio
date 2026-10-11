/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { exportPublicSource, inside, inventoryPublicSource, scanText, sourcePolicy, validateSupport, writeAudit } from './public-source.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const auditRoot = resolve(repository, '.runtime/release-audit');
mkdirSync(auditRoot, { recursive: true });
function fixture(t) {
  const root = mkdtempSync(resolve(auditRoot, 'public-source-test-'));
  t.after(() => {
    // Delete only the fixture created by this test, after checking physical bounds.
    assert.equal(dirname(root), auditRoot);
    assert.ok(inside(realpathSync(auditRoot), realpathSync(root)));
    assert.equal(lstatSync(root).isSymbolicLink(), false);
    rmSync(root, { recursive: true, force: true });
  });
  function write(path, value = 'export const value = 1;\n') {
    const target = resolve(root, path);
    assert.ok(inside(root, target));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, value);
  }
  write('LICENSE', 'MPL fixture license\n');
  write('package.json', JSON.stringify({ type: 'module', scripts: {} }));
  return { root, write };
}

test('allowlist keeps source runtime packages but excludes only actual desktop stages', () => {
  for (const path of ['packages/runtime/src/index.ts', 'packages/jsx/LICENSE', 'apps/web/src/app.tsx', 'apps/web/src/projects/history.ts', 'apps/cli/src/index.ts', 'apps/desktop/syka-assets/icon.svg', 'docs/licenses/RARE_UI_LICENSE.txt', 'patches/koota.patch', 'apps/web/.env.example']) assert.equal(sourcePolicy(path).include, true, path);
  for (const path of ['.github/workflows/build-windows.yml', '.github/workflows/release.yml', 'docs/RELEASING.md']) assert.equal(sourcePolicy(path).include, true, path);
  for (const path of ['.github/workflows/bump-cask.yml', '.github/workflows/release-macos.yml', '.github/workflows/private-audit.yml']) assert.equal(sourcePolicy(path).include, false, path);
  for (const path of ['apps/desktop/runtime/bin/tool.exe', 'apps/desktop/web/index.html', 'apps/desktop/docs/INSTRUCTIONS.md', 'apps/desktop/cli/index.js', 'apps/desktop/assets/icon.png', 'node_modules/pkg/LICENSE', 'graphify-out/code-index.json', 'docs/QA_PRIVATE.md', 'docs/research/private.md', 'apps/web/.env', 'apps/web/.env.local', 'scripts/qa-screen-recording.mjs']) assert.equal(sourcePolicy(path).include, false, path);
});

test('secret findings contain only metadata and recognize multiple credential families', () => {
  const tokens = [
    ['github-token', 'gh' + 'p_' + 'aZ09bY18cX27dW36eV45fU54gT63hS72'],
    ['openai-or-provider-key', 'sk-' + 'proj-' + 'aZ09bY18cX27dW36eV45fU54gT63hS72'],
    ['google-api-key', 'AI' + 'za' + 'aZ09bY18cX27dW36eV45fU54gT63hS72mL0'],
    ['huggingface-token', 'hf' + '_' + 'aZ09bY18cX27dW36eV45fU54gT63hS72'],
    ['gitlab-token', 'gl' + 'pat-' + 'aZ09bY18cX27dW36eV45fU54gT63hS72'],
    ['npm-token', 'np' + 'm_' + 'aZ09bY18cX27dW36eV45fU54gT63hS72'],
    ['stripe-secret-key', 'sk_' + 'test_' + 'aZ09bY18cX27dW36eV45fU54gT63hS72'],
    ['supabase-secret-key', 'sb_' + 'secret_' + 'aZ09bY18cX27dW36eV45fU54gT63hS72'],
  ];
  for (const [expected, token] of tokens) {
    const findings = scanText('const value = "' + token + '";', 'apps/web/src/example.ts');
    assert.ok(findings.some(item => item.type === expected), expected);
    assert.ok(!JSON.stringify(findings).includes(token));
    for (const item of findings) assert.deepEqual(Object.keys(item).sort(), ['line', 'path', 'severity', 'type']);
  }
  assert.equal(scanText('apiKey: "your-example-key-placeholder"', 'apps/web/.env.example').length, 0);
  const disguised = 'gh' + 'p_' + 'example' + 'aZ09bY18cX27dW36eV45fU54gT63hS72';
  assert.ok(scanText(disguised,'apps/web/src/example.ts').some(item=>item.type==='github-token'));
});

test('personal paths are detected without exposing their value', () => {
  const privatePath = 'F:' + '\\' + 'Coding Proyects' + '\\' + 'private-fixture';
  const findings = scanText('const root = ' + JSON.stringify(privatePath), 'scripts/example.mjs');
  assert.ok(findings.some(item => item.type === 'personal-machine-path'));
  assert.ok(!JSON.stringify(findings).includes(privatePath));
  assert.equal(scanText('const root = process.env.USERPROFILE;', 'scripts/example.mjs').length, 0);
});

test('inventory excludes private trees without reading or copying their source', async t => {
  const { root, write } = fixture(t);
  write('apps/web/src/app.tsx');
  write('packages/runtime/src/index.ts');
  write('apps/web/.env', 'PRIVATE_VALUE_NOT_FOR_PUBLICATION');
  write('.runtime/private.json', 'PRIVATE_VALUE_NOT_FOR_PUBLICATION');
  write('docs/qa/private.md', 'PRIVATE_VALUE_NOT_FOR_PUBLICATION');
  const inventory = await inventoryPublicSource(root);
  assert.equal(inventory.summary.ready, true);
  assert.equal(inventory.manifest.files.some(item => item.path.includes('.env') || item.path.includes('private')), false);
  assert.ok(!JSON.stringify(inventory).includes('PRIVATE_VALUE_NOT_FOR_PUBLICATION'));
});

test('files exceeding the source threshold block export', async t => {
  const { root, write } = fixture(t);
  write('apps/web/src/large.ts', '0123456789');
  const tooLarge = await inventoryPublicSource(root, { maxFileBytes: 5 });
  assert.ok(tooLarge.findings.some(item => item.type === 'file-over-90-mib'));
});

test('allowed directory symlinks or Windows junctions are never traversed', async t => {
  const { root, write } = fixture(t);
  write('apps/web/src/original/private.ts');
  try { symlinkSync(resolve(root, 'apps/web/src/original'), resolve(root, 'apps/web/src/link'), process.platform === 'win32' ? 'junction' : 'dir'); } catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('This account cannot create test links.'); throw error; }
  const linked = await inventoryPublicSource(root);
  assert.ok(linked.findings.some(item => item.type === 'source-symlink'));
  assert.equal(linked.manifest.files.some(item => item.path.startsWith('apps/web/src/link/')), false);
});

test('binary payloads with misleading source extensions are rejected', async t => {
  const { root, write } = fixture(t);
  const bytes = Buffer.alloc(80);
  bytes.write('MZ');
  write('apps/web/src/hidden.ts', bytes);
  const inventory = await inventoryPublicSource(root);
  assert.ok(inventory.findings.some(item => item.type === 'executable-signature'));
  assert.equal(inventory.manifest.files.some(item => item.path.endsWith('hidden.ts')), false);
});

test('reviewed sentinel exceptions expire when their exact file changes', async t => {
  const { root, write } = fixture(t);
  const path = 'packages/agent-chat/test/codex-policy.test.ts';
  const body = readFileSync(resolve(repository, path), 'utf8');
  write(path, body);
  const reviewed = await inventoryPublicSource(root);
  assert.equal(reviewed.reviewed.length, 1);
  assert.equal(reviewed.findings.some(item => item.type === 'credential-like-assignment'), false);
  write(path, body + '\nconst added = "' + 'gh' + 'p_' + 'aZ09bY18cX27dW36eV45fU54gT63hS72' + '";\n');
  const changed = await inventoryPublicSource(root);
  assert.equal(changed.reviewed.length, 0);
  assert.ok(changed.findings.some(item => item.type === 'credential-like-assignment'));
  assert.ok(changed.findings.some(item => item.type === 'github-token'));
});

test('media approval is bound to exact path and hash', async t => {
  const { root, write } = fixture(t);
  write('docs/resources/motions/example.png', Buffer.from([137, 80, 78, 71]));
  const first = await inventoryPublicSource(root);
  assert.equal(first.summary.ready, false);
  const media = first.media[0];
  const approved = await inventoryPublicSource(root, { approvedMedia: [{ path: media.path, sha256: media.sha256 }] });
  assert.equal(approved.summary.ready, true);
  write(media.path, Buffer.from([137, 80, 78, 71, 1]));
  const changed = await inventoryPublicSource(root, { approvedMedia: [{ path: media.path, sha256: media.sha256 }] });
  assert.equal(changed.summary.ready, false);
});

test('support checks catch excluded README links and relative build imports', () => {
  const entries = [{ path: 'README.md' }, { path: 'scripts/build.mjs' }, { path: 'package.json' }];
  const texts = new Map([
    ['README.md', '[missing](docs/QA_PRIVATE.md)'],
    ['scripts/build.mjs', "import { value } from './lib/missing.mjs';"],
    ['package.json', JSON.stringify({ scripts: { build: 'node scripts/build.mjs', other: 'node scripts/missing.mjs' } })],
  ]);
  const findings = validateSupport(entries, texts);
  assert.ok(findings.some(item => item.type === 'missing-public-document-link'));
  assert.ok(findings.some(item => item.type === 'missing-relative-import'));
  assert.ok(findings.some(item => item.type === 'missing-script-support'));
});

test('support checks resolve existing relative files consistently on Windows', () => {
  const entries = ['README.md', 'docs/reference/tools/README.md', 'package.json', 'scripts/build.mjs', 'scripts/lib/value.mjs', 'apps/web/src/entry.ts', 'apps/web/src/value.ts'].map(path => ({ path }));
  const texts = new Map([
    ['README.md', '[tools](docs/reference/tools/README.md)'],
    ['scripts/build.mjs', "import { value } from './lib/value.mjs';"],
    ['apps/web/src/entry.ts', "import { value } from './value';"],
    ['package.json', JSON.stringify({ scripts: { build: 'node scripts/build.mjs' } })],
  ]);
  assert.deepEqual(validateSupport(entries, texts), []);
});

test('export preserves byte hashes and refuses a nonempty destination without deleting it', async t => {
  const { root, write } = fixture(t);
  write('apps/web/src/app.tsx');
  const inventory = await inventoryPublicSource(root);
  const result = await exportPublicSource(root, inventory);
  assert.equal(result.files, inventory.manifest.files.length);
  for (const entry of inventory.manifest.files) {
    const bytes = readFileSync(resolve(root, '.runtime/public-source', entry.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  }
  await assert.rejects(exportPublicSource(root, inventory), { code: 'DESTINATION_NOT_EMPTY' });
  assert.equal(readFileSync(resolve(root, '.runtime/public-source/LICENSE'), 'utf8'), 'MPL fixture license\n');
  assert.equal(existsSync(resolve(root, '.runtime/public-source/.git')), false);
});

test('export refuses source changes since audit before creating a snapshot', async t => {
  const { root, write } = fixture(t);
  write('apps/web/src/app.tsx');
  const inventory = await inventoryPublicSource(root);
  write('apps/web/src/app.tsx', 'changed since audit\n');
  await assert.rejects(exportPublicSource(root, inventory), { code: 'SOURCE_CHANGED' });
  assert.equal(existsSync(resolve(root, '.runtime/public-source')), false);
});

test('destination and report redirects are rejected', async t => {
  const { root } = fixture(t);
  const inventory = await inventoryPublicSource(root);
  await assert.rejects(exportPublicSource(root, inventory, resolve(root, 'apps')), { code: 'UNSAFE_DESTINATION' });
  await assert.rejects(writeAudit(root, inventory, resolve(root, 'apps')), { code: 'UNSAFE_REPORT_DIRECTORY' });
  await writeAudit(root, inventory);
  const report = readFileSync(resolve(root, '.runtime/release-audit/public-source-report.md'), 'utf8');
  assert.ok(report.includes(inventory.manifestSha256));
});
