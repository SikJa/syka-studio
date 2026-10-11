import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { assertStagingDirectory } from './staging-path.mjs';

test('stage replacement rejects traversal, files and junctions without deleting their targets', () => {
  const root = mkdtempSync(join(tmpdir(), 'syka-stage-path-'));
  try {
    const desktop = join(root, 'desktop'), outside = join(root, 'outside');
    mkdirSync(desktop); mkdirSync(outside);
    writeFileSync(join(outside, 'keep.txt'), 'keep');
    assert.equal(assertStagingDirectory(desktop, join(desktop, 'runtime'), 'runtime'), join(desktop, 'runtime'));
    assert.throws(() => assertStagingDirectory(desktop, outside, 'outside'), /outside/);
    assert.throws(() => assertStagingDirectory(desktop, join(desktop, '..'), 'runtime'), /outside/);
    writeFileSync(join(desktop, 'runtime'), 'not a directory');
    assert.throws(() => assertStagingDirectory(desktop, join(desktop, 'runtime'), 'runtime'), /redirected/);
    rmSync(join(desktop, 'runtime'));
    symlinkSync(outside, join(desktop, 'runtime'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => assertStagingDirectory(desktop, join(desktop, 'runtime'), 'runtime'), /redirected/);
  } finally {
    const absolute = resolve(root);
    assert.equal(dirname(absolute), resolve(tmpdir()));
    assert.match(absolute, /syka-stage-path-/);
    rmSync(absolute, { recursive: true, force: true });
  }
});
