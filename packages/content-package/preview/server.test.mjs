import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createPreviewServer } from './server.mjs';
test('preview binds locally, rejects cross-origin writes and only serves explicit routes', async () => {
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const index = await fetch(base); assert.equal(index.status, 200);
    assert.match(index.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal((await fetch(base + '/api/save', { method: 'POST', headers: { Origin: 'https://outside.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(base + '/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    const hostStatus = await new Promise((resolve, reject) => {
      http.get(base, { headers: { Host: 'outside.example' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    assert.equal(hostStatus, 403);
    const secret = await fetch(base + '/.runtime/content-package/session.json');
    assert.notEqual(secret.status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
