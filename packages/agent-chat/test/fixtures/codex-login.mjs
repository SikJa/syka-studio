import { createInterface } from 'node:readline';
const mode = process.argv[2];
let authenticated = false;
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
createInterface({ input: process.stdin }).on('line', line => {
  const message = JSON.parse(line);
  if (!message.id) return;
  let result = {};
  if (message.method === 'initialize') result = { userAgent: 'codex/0.207.0' };
  if (message.method === 'account/read') result = { account: authenticated ? { type: 'chatgpt' } : null };
  if (message.method === 'account/login/start') {
    result = message.params.type === 'chatgptDeviceCode'
      ? { type: 'chatgptDeviceCode', loginId: 'fixture-login', verificationUrl: 'https://auth.openai.com/codex/device', userCode: mode === 'bad-code' ? 'not valid code' : 'ABCD-EFGH' }
      : { type: 'chatgpt', loginId: 'fixture-login', authUrl: mode === 'evil-url' ? 'https://evil.invalid/login' : 'https://auth.openai.com/authorize?state=fixture' };
    if (mode !== 'wait') setTimeout(() => {
      authenticated = mode !== 'failed';
      send({ method: 'account/login/completed', params: { loginId: 'fixture-login', success: authenticated } });
    }, 20);
  }
  send({ id: message.id, result });
});
