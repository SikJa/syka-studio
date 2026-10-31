import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { rebaseGraphifyConfig, GRAPHIFY_PYTHON_DIRECTORY } from './graphify-paths.mjs';

test('rebases a moved managed Python from the current root, preserving unrelated config', () => {
  const config = `home = F:\\Old user\\repo\\.runtime\\python\\${GRAPHIFY_PYTHON_DIRECTORY}\r\nversion_info = 3.12.13\r\nrelocatable = true\r\n`;
  const root = resolve('temporary repo with spaces', '.runtime');
  const result = rebaseGraphifyConfig(config, root);
  assert.ok(result.includes(`home = ${resolve(root, 'python', GRAPHIFY_PYTHON_DIRECTORY)}`));
  assert.ok(result.includes('relocatable = true\r\n'));
  assert.equal(rebaseGraphifyConfig(result, root), result);
  assert.ok(!result.includes('F:\\Old user'));
});
test('does not rewrite user-owned external Python or unrecognized environments', () => {
  for (const config of ['', 'home = C:\\Python312\nversion_info = 3.12.13', 'home = /custom/python/cpython-3.11-linux']) {
    assert.equal(rebaseGraphifyConfig(config, '/new/.runtime'), config);
  }
});
