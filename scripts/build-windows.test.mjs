/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseAssetName, SETUP_ASSET, verifyAssetBundle } from './build-windows.mjs';

const VERSION = '0.208.0';
const ZIP_ASSET = `Syka-Studio-win32-x64-${VERSION}.zip`;
const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), '../.runtime/release-audit');
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');

function fixture(zipName = ZIP_ASSET) {
  mkdirSync(FIXTURES, { recursive: true });
  const directory = mkdtempSync(join(FIXTURES, 'windows-zip-name-fixture-'));
  const full = `SykaStudio-${VERSION}-full.nupkg`;
  const delta = `SykaStudio-${VERSION}-delta.nupkg`;
  const files = new Map([
    [SETUP_ASSET, Buffer.from('MZ installer fixture')],
    [full, Buffer.from('PK full package fixture')],
    [delta, Buffer.from('PK delta package fixture')],
    [zipName, Buffer.from('PK portable archive fixture')],
  ]);
  const releases = [full, delta].map(name => {
    const bytes = files.get(name);
    return `${digest(bytes, 'sha1')} ${name} ${bytes.length}`;
  }).join('\n') + '\n';
  files.set('RELEASES', Buffer.from(releases));
  files.set('SHA256SUMS', Buffer.from([...files].map(([name, bytes]) => `${digest(bytes)}  ${name}`).join('\n') + '\n'));
  for (const [name, bytes] of files) writeFileSync(join(directory, name), bytes);
  const clean = () => {
    assert.equal(dirname(resolve(directory)), FIXTURES);
    assert.ok(directory.startsWith(join(FIXTURES, 'windows-zip-name-fixture-')));
    rmSync(directory, { recursive: true, force: true });
  };
  return { directory, files, clean };
}

test('uses a public ZIP name without spaces while preserving Squirrel asset names', () => {
  assert.equal(releaseAssetName(`Syka Studio-win32-x64-${VERSION}.zip`, VERSION), ZIP_ASSET);
  assert.equal(releaseAssetName('Syka Studio-win32-x64-0.209.0.zip', '0.209.0'), 'Syka-Studio-win32-x64-0.209.0.zip');
  for (const name of [SETUP_ASSET, 'RELEASES', `SykaStudio-${VERSION}-full.nupkg`, `SykaStudio-${VERSION}-delta.nupkg`]) {
    assert.equal(releaseAssetName(name, VERSION), name);
  }
});

test('verifies canonical ZIP and checksums without changing RELEASES or nupkg names or bytes', async () => {
  const f = fixture();
  try {
    assert.deepEqual((await verifyAssetBundle(f.directory, VERSION)).sort(), [...f.files.keys()].sort());
    assert.deepEqual(readdirSync(f.directory).sort(), [...f.files.keys()].sort());
    for (const [name, bytes] of f.files) assert.deepEqual(readFileSync(join(f.directory, name)), bytes);
  } finally { f.clean(); }
});

for (const zipName of [`Syka Studio-win32-x64-${VERSION}.zip`, `Syka.Studio-win32-x64-${VERSION}.zip`, 'Syka-Studio-win32-x64-0.209.0.zip']) {
  test(`rejects a public ZIP name that would break the versioned download contract: ${zipName}`, async () => {
    const f = fixture(zipName);
    try { await assert.rejects(verifyAssetBundle(f.directory, VERSION), /Public ZIP asset must be named Syka-Studio-win32-x64-0\.208\.0\.zip/); }
    finally { f.clean(); }
  });
}
