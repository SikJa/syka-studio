import assert from 'node:assert/strict';
import test from 'node:test';
import { isManagedElectronDirectory } from './branded-electron.mjs';

const id = '78657901-6ab5-4f4a-aada-4d67700f28f6';
test('reuses our real generated folder with a dotted Electron version', () => {
  assert.equal(isManagedElectronDirectory(`43.1.1-${id}`, '43.1.1'), true);
});
test('supports a generated prerelease-version folder', () => {
  assert.equal(isManagedElectronDirectory(`44.0.0-beta.1-${id}`, '44.0.0-beta.1'), true);
});
for (const directory of [
  `42.1.1-${id}`,
  `../43.1.1-${id}`,
  `43.1.1-${id}/../outside`,
  `43.1.1-${id}\\..\\outside`,
  '43.1.1-arbitrary-folder',
]) test(`rejects an unowned or unsafe cache selector: ${directory}`, () => {
  assert.equal(isManagedElectronDirectory(directory, '43.1.1'), false);
});
