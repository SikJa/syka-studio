// Headless renderer regression. This does not emulate Win32 hit testing.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

const output = resolve('output/notification-hover-20261010');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 370, height: 320 } });
const result = { checks: [], errors: [], kind: 'headless React UI with a mocked native bridge', paidCalls: false };
page.on('pageerror', e => result.errors.push(e.message));
await page.addInitScript(() => {
  const listeners = new Map();
  const snapshot = { accent: '#520202', sound: false, notices: [{
    id: 'hover-question', kind: 'question', title: 'Syka tiene una pregunta',
    projectId: 'qa-hover', projectDir: 'qa-hover', projectName: 'QA hover', chatId: 'qa-chat',
    message: '¿Qué formato querés?', createdAt: Date.now(),
    request: { id: 'qa-request', questions: [{ id: 'format', question: '¿Qué formato querés?', options: [] }] },
  }] };
  window.qaInteractive = [];
  window.desktop = { platform: 'win32',
    on(channel, handler) { const handlers = listeners.get(channel) || new Set(); handlers.add(handler); listeners.set(channel, handlers); return () => handlers.delete(handler); },
    send(channel, request) {
      if (channel !== 'main:request') return;
      if (request.data?.action === 'interactive') window.qaInteractive.push(request.data.value);
      queueMicrotask(() => {
        const data = request.channel === 'syka:notifications' ? snapshot : { configured: false };
        for (const handler of listeners.get('main:response') || []) handler({ id: request.id, ok: true, data });
      });
    },
  };
});
try {
  await page.goto('http://localhost:5188/notifications.html', { waitUntil: 'domcontentloaded' });
  const bubble = page.locator('.quick-bubble');
  await bubble.waitFor();
  await page.waitForTimeout(450); // Finish the finite arrival transition.
  assert.equal(await bubble.getAttribute('data-expanded'), 'false');
  assert.equal((await page.evaluate(() => window.qaInteractive)).at(-1), false);
  await page.locator('.quick-head').evaluate(n => {
    const r = n.getBoundingClientRect();
    n.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.x + 20, clientY: r.y + 20 }));
  });
  await page.getByRole('textbox').waitFor({ state: 'visible' });
  assert.equal((await page.evaluate(() => window.qaInteractive)).at(-1), true);
  result.checks.push('legacy mousemove alone opens the composer and enables native interaction');
  await page.getByRole('textbox').press('Escape');
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(1, 1);
  await page.waitForFunction(() => document.querySelector('.quick-bubble').dataset.expanded === 'false');
  await page.locator('.floating-orb').hover();
  await page.getByRole('textbox').waitFor({ state: 'visible' });
  result.checks.push('orb hover opens the question and native voice composer');
  await bubble.hover();
  await page.waitForTimeout(350);
  assert.equal(await bubble.getAttribute('data-expanded'), 'true');
  result.checks.push('crossing from orb to message keeps the preview open');
  await page.mouse.move(1, 1);
  await page.waitForFunction(() => document.querySelector('.quick-bubble').dataset.expanded === 'false');
  assert.equal((await page.evaluate(() => window.qaInteractive)).at(-1), false);
  result.checks.push('leaving restores click-through and collapses an empty reply');
  await page.locator('.floating-orb').hover();
  const reply = page.getByRole('textbox');
  await reply.fill('Mi respuesta pendiente');
  await page.mouse.move(1, 1);
  await page.waitForTimeout(350);
  assert.equal(await reply.inputValue(), 'Mi respuesta pendiente');
  assert.equal(await bubble.getAttribute('data-expanded'), 'true');
  result.checks.push('leaving preserves an existing reply draft');
  const style = await bubble.evaluate(n => ({ background: getComputedStyle(n).backgroundColor, border: getComputedStyle(n).borderColor, width: n.offsetWidth }));
  assert.equal(style.background, 'rgba(8, 8, 8, 0.96)');
  assert.equal(style.border, 'rgba(0, 0, 0, 0)');
  assert.ok(style.width <= 284);
  result.checks.push('approved compact black design and neutral border are preserved');
  assert.deepEqual(result.errors, []);
} catch (error) { result.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile(join(output, 'headless-regression.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
