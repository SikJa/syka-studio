// Read-only UI verification on the already-running private QA editor.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const resources = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const record = JSON.parse(await readFile(join(resources, 'evidence/motion-review-integration.json'), 'utf8'));
const evidence = join(record.project, 'qa-evidence/live-playback'); await mkdir(evidence, { recursive: true });
const client = new Client({ name: 'motion-review-live-ui', version: '1' });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9417');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('http://127.0.0.1:5317'));
assert.ok(page);
const delay = ms => new Promise(ok => setTimeout(ok, ms));
const result = { playback: [], scope: 'Private QA, native 1x playback with samples. Silent brief.' };
async function context() { const r = await client.callTool({ name: 'context', arguments: {} }); return r.structuredContent || JSON.parse(r.content.filter(x => x.type === 'text').map(x => x.text).join('')); }
try {
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3317/mcp')));
  assert.equal(resolve((await context()).projectDir), resolve(record.project));
  await page.bringToFront();
  for (const b of await page.getByRole('button', { name: 'Ahora no', exact: true }).all()) if (await b.isVisible()) await b.click();
  await page.getByRole('button', { name: 'Ir al inicio · Inicio', exact: true }).click();
  await page.getByRole('button', { name: 'Reproducir · Espacio', exact: true }).click();
  for (let i = 0; i < 11; i++) {
    await delay(1000); const s = await context();
    result.playback.push({ seconds: s.currentTime, visibleComposition: s.visibleComposition });
    await page.screenshot({ path: join(evidence, `play-${i}.png`) });
  }
  const pause = page.getByRole('button', { name: 'Pausar · Espacio', exact: true }); if (await pause.count()) await pause.click();
  assert.ok(result.playback.some(p => p.seconds > 9));
  // Export can surface its existing post-export offer after the player closes a pending dialog.
  for (const b of await page.getByRole('button', { name: 'Ahora no', exact: true }).all()) if (await b.isVisible()) await b.click();
  await writeFile(join(evidence, 'ui-review.json'), JSON.stringify(result, null, 2) + '\n');
  await page.getByRole('tab', { name: 'Chat', exact: true }).click();
  await delay(700);
  result.chatButtons = await page.locator('button').evaluateAll(buttons => buttons.map(b => ({ text: b.textContent?.trim(), label: b.getAttribute('aria-label') })).filter(b => b.text || b.label));
  await page.screenshot({ path: join(evidence, 'chat.png') });
  await writeFile(join(evidence, 'ui-review.json'), JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ playback: result.playback.map(p => p.seconds), chatButtons: result.chatButtons }) + '\n');
} finally { await client.close(); await browser.close(); }
