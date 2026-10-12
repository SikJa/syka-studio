import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
const mode = process.argv[2];
if (mode === 'split') {
  process.stdout.write('Authorize: https://auth.openai.com/authorize?state=');
  process.stderr.write('Preparing browser connection\n');
  setTimeout(() => {
    process.stdout.write('fixture-complete\n');
    process.stdout.write('User code: ABCD-EFGH\n');
    setTimeout(() => process.exit(0), 80);
  }, 180);
} else if (mode === 'renew') {
  process.stdout.write('Authorize: https://auth.openai.com/authorize?state=old\nUser code: OLD1-CODE\n');
  setTimeout(() => {
    process.stdout.write('Authorize: https://auth.openai.com/authorize?state=new\nUser code: NEW1-CODE\n');
    setTimeout(() => process.exit(0), 80);
  }, 180);
} else if (mode === 'code') {
  process.stderr.write('https://claude.com/cai/oauth/authorize?state=fixture\n');
  process.stdout.write('Paste authorization code: ');
  createInterface({ input: process.stdin }).once('line', code => {
    writeFileSync(process.argv[3], code);
    process.exit(code ? 0 : 1);
  });
} else if (mode === 'failed') {
  process.stderr.write('Authentication failed: access_denied\n');
  setInterval(() => {}, 1000);
} else if (mode === 'nonzero') {
  process.exit(2);
} else if (mode === 'existing-account') {
  process.stdout.write('https://claude.ai/oauth/authorize?state=fixture\n');
  setTimeout(() => {
    writeFileSync(process.argv[3], 'new-login-completed');
    process.exit(0);
  }, 2900);
} else {
  setInterval(() => {}, 1000);
}
