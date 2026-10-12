import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';

const mode = process.env.SYKA_FAKE_MODE;
const event = value => appendFileSync(process.env.SYKA_FAKE_EVENTS, JSON.stringify(value) + '\n');
event({ type: 'start', pid: process.pid, args: process.argv.slice(2) });
const methods = {
  openai: [
    { type: 'api', label: 'API key' },
    { type: 'oauth', label: 'ChatGPT subscription' },
    null,
    { type: 'oauth', label: 'Custom inputs', prompts: [{ type: 'text', key: 'tenant', message: 'Tenant' }] },
    { type: 'oauth', label: 'x'.repeat(150) + '\n', prompts: [] },
  ],
  anthropic: [{ type: 'oauth', label: 'Claude subscription' }],
  'invalid/provider': [{ type: 'oauth', label: 'Invalid path' }],
  missing: [{ type: 'oauth' }],
  empty: [{ type: 'oauth', label: ' ' }],
};
const server = createServer(async (request, response) => {
  const expected = 'Basic ' + Buffer.from(process.env.OPENCODE_SERVER_USERNAME + ':' + process.env.OPENCODE_SERVER_PASSWORD).toString('base64');
  if (request.headers.authorization !== expected) { response.writeHead(401).end(); return; }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  let body;
  try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined; }
  catch { response.writeHead(400).end(); return; }
  event({ type: 'request', path: request.url, method: request.method, body, authenticated: true });
  const json = value => { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
  if (request.url === '/provider/auth') {
    if (mode === 'methods-hang') return;
    if (mode === 'methods-body-hang') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.write('{"openai":'); return; }
    if (mode === 'methods-oversized-length') { response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': 1024 * 1024 }); response.write('{'); return; }
    if (mode === 'methods-oversized-stream') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ filler: 'x'.repeat(600 * 1024) })); return; }
    if (mode === 'methods-invalid-json') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end('not JSON'); return; }
    if (mode === 'methods-array') { json([]); return; }
    if (mode === 'methods-null') { json(null); return; }
    if (mode === 'methods-redirect') { response.writeHead(302, { Location: 'https://unofficial.example.test' }); response.end(); return; }
    if (mode === 'server-exit') { process.exit(1); }
    json(methods); return;
  }
  const route = /^\/provider\/(openai|anthropic)\/oauth\/(authorize|callback)$/.exec(request.url ?? '');
  if (route) {
    const [, provider, action] = route;
    if (action === 'authorize') {
      if (mode === 'authorize-hang') return;
      if (mode === 'invalid-authorization') { json({ url: 'https://auth.openai.com/authorize', method: 'invalid', instructions: '' }); return; }
      if (mode === 'invalid-authorization-array') { json({ url: 'https://auth.openai.com/authorize', method: ['auto'], instructions: '' }); return; }
      if (mode === 'invalid-authorization-instructions') { json({ url: 'https://auth.openai.com/authorize', method: 'auto', instructions: {} }); return; }
      json({
        url: process.env.SYKA_FAKE_URL ?? (provider === 'anthropic' ? 'https://claude.ai/oauth/authorize' : 'https://auth.openai.com/codex/device'),
        method: provider === 'anthropic' || mode === 'code' ? 'code' : 'auto',
        instructions: 'Enter this code: ABCD-EFGH',
      }); return;
    }
    if (mode === 'callback-hang') return;
    if (mode === 'callback-false') { json(false); return; }
    json(true); return;
  }
  if (request.url === '/provider') {
    if (mode === 'connected-missing') { json({ all: [], default: {}, connected: ['another-provider'] }); return; }
    if (mode === 'connected-invalid') { json({ all: [], default: {}, connected: ['openai', 10] }); return; }
    if (mode === 'connected-null') { json(null); return; }
    json({ all: [], default: {}, connected: ['openai', 'anthropic'] }); return;
  }
  response.writeHead(404).end();
});
server.listen(0, '127.0.0.1', () => {
  if (mode === 'startup-split-url') {
    const port = String(server.address().port);
    process.stdout.write('opencode server listening on http://127.0.0.1:' + port.slice(0, 2));
    setTimeout(() => process.stdout.write(port.slice(2)), 50);
    setTimeout(() => process.stdout.write('\n'), 100);
  } else if (mode !== 'startup-hang') process.stdout.write('opencode server listening on http://127.0.0.1:' + server.address().port + '\n');
});
