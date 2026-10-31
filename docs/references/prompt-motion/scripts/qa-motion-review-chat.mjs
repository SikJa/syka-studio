import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const resources = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const record = JSON.parse(await readFile(join(resources, 'evidence/motion-review-integration.json'), 'utf8'));
const evidence = join(record.project, 'qa-evidence/live-playback');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9417');
try {
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('http://127.0.0.1:5317')); assert.ok(page);
  await page.getByRole('tab', { name: 'Chat', exact: true }).click();
  // The QA conversation must already be selected. Its header is not a navigation button.
  await page.getByText('Apliqué dos correcciones:', { exact: false }).waitFor({ timeout: 10_000 });
  const tools = record.events.filter(e => e.name === 'syka_motion_review');
  assert.equal(tools.length, 2); assert.ok(tools.every(e => e.imageCount === 5 && e.status === 'done'));
  const links = await page.locator('[data-local-path]').evaluateAll(a => a.filter(i => ['Antes', 'Después'].includes(i.textContent.trim())).map(i => ({ title: i.textContent.trim(), path: i.getAttribute('data-local-path') })));
  assert.equal(links.length, 2);
  await page.screenshot({ path: join(evidence, 'native-review-chat.png') });
  const ui = JSON.parse(await readFile(join(evidence, 'ui-review.json'), 'utf8'));
  ui.nativeChatReview = { completedConversationVisible: true, exportLinks: links, providerToolCalls: 2, providerPreviewsPerCall: 5,
    note: 'Completed chat intentionally hides tool activity; previews were delivered to provider vision and retained in the transcript, not displayed here.', screenshot: join(evidence, 'native-review-chat.png') };
  await writeFile(join(evidence, 'ui-review.json'), JSON.stringify(ui, null, 2) + '\n');
  process.stdout.write(JSON.stringify(ui.nativeChatReview) + '\n');
} finally { await browser.close(); }
