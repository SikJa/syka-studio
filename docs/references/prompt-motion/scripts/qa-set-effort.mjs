// Interrupt only the recorded QA chat. The runner can then restart at the new effort.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const WebSocket = require('ws');
const resourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recorded = JSON.parse(await readFile(resolve(resourceRoot, 'evidence/native-integration.json'), 'utf8'));
const browser = await chromium.connectOverCDP('http://127.0.0.1:9417');
let socket;
try {
  const page = browser.contexts().flatMap(x => x.pages()).find(x => x.url().startsWith('http://127.0.0.1:5317'));
  if (!page) throw Error('Isolated QA window was not found');
  const endpoint = await page.evaluate(() => new Promise((ok, fail) => {
    const id = crypto.randomUUID();
    const remove = window.desktop.on('main:response', reply => { if (reply.id !== id) return; remove(); reply.ok ? ok(reply.data) : fail(Error(reply.error)); });
    window.desktop.send('main:request', { id, channel: 'agent-chat:endpoint' });
  }));
  socket = new WebSocket(endpoint.url, { origin: 'http://127.0.0.1:5317' });
  await new Promise((ok, fail) => { socket.once('open', ok); socket.once('error', fail); });
  const id = randomUUID();
  const replied = new Promise((ok, fail) => {
    const timeout = setTimeout(() => fail(Error('QA interruption timeout')), 30_000);
    socket.on('message', bytes => { const message = JSON.parse(String(bytes)); if (message.t !== 'res' || message.id !== id) return;
      clearTimeout(timeout); message.ok ? ok(message.data) : fail(Error(JSON.stringify(message.error))); });
  });
  socket.send(JSON.stringify({ t: 'req', id, method: 'turn.interrupt', params: { chatId: recorded.chatId } }));
  await replied;
  process.stdout.write('Interrupted only the isolated QA turn; project sources preserved.\n');
} finally { socket?.close(); await browser.close().catch(() => {}); }
