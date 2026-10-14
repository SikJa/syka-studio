import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { backgroundServerEnvironment } from './lib/dev-server-env.mjs';

const viteUrl = pathToFileURL(resolve('node_modules/vite/dist/node/index.js')).href;
const fixture = `
  const { createServer } = await import(${JSON.stringify(viteUrl)});
  const server = await createServer({ configFile: false, logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, watch: null } });
  await server.listen();
  process.on('message', message => {
    if (message === 'stop') process.emit('SIGTERM');
  });
  process.send({ port: server.httpServer.address().port });
  process.stdin.resume();
`;

async function startServer(t, env) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', fixture], {
    env, stdio: ['pipe', 'ignore', 'pipe', 'ipc'], windowsHide: true,
  });
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  const ready = once(child, 'message');
  const ended = once(child, 'exit').then(([code]) => { throw new Error(`Vite exited early: ${code} ${errors}`); });
  const [message] = await Promise.race([ready, ended]);
  return { child, port: message.port };
}

test('reproduces Vite shutting down when an interactive input stream ends', { timeout: 15000 }, async t => {
  const { child } = await startServer(t, { ...process.env, CI: '' });
  const exited = once(child, 'exit');
  child.stdin.end();
  const [code] = await exited;
  assert.equal(code, 0);
});

test('background Vite survives stdin EOF and still honors explicit shutdown', { timeout: 15000 }, async t => {
  const { child, port } = await startServer(t, backgroundServerEnvironment(process.env));
  child.stdin.end();
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.equal(child.exitCode, null);
  const response = await fetch(`http://127.0.0.1:${port}/@vite/client`);
  assert.equal(response.status, 200);
  await response.text();
  const exited = once(child, 'exit');
  child.send('stop');
  const [code] = await exited;
  assert.equal(code, 0);
});
