/* Render the actual dashboard cards against recovered native records; no provider or turn. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { AgentHost } from '../packages/agent-chat/src/host/host';
import { ChatStore } from '../packages/agent-chat/src/host/store';
import { NativeUsageRecovery } from '../packages/agent-chat/src/host/native-usage';
import { startServer } from '../packages/agent-chat/src/host/server';

const inventoryPath = resolve('../.runtime/diffusion/reports/project-cleanup-20261011/remaining.json');
const records = JSON.parse(await readFile(inventoryPath, 'utf8'));
const projects = [...new Map<string, any>(records.map((p: any) => [p.id, p])).values()];
const output = resolve('output/playwright/native-project-usage');
const root = resolve('.runtime/native-project-usage-review');
await mkdir(root, { recursive: true }); await mkdir(output, { recursive: true });
await writeFile(join(root, 'index.html'), '<html data-kb-theme="dark"><head><meta charset="utf-8" /></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(join(root, 'qa.css'), '@import "../../apps/web/src/index.css";\n@source "../../apps/web/src";\n@source "./main.tsx";');
await writeFile(join(root, 'main.tsx'), `import { render } from 'solid-js/web';
import { For } from 'solid-js'; import './qa.css';
import { DashboardProjectCard } from '../../apps/web/src/components/dashboard/project-card';
const projects = ${JSON.stringify(projects)}; const noop = () => {};
render(() => <main class="min-h-screen bg-background p-6 text-foreground"><h1>Consumo histórico nativo recuperado</h1><div class="grid grid-cols-3 gap-4"><For each={projects}>{project => <div data-project={project.id}><DashboardProjectCard project={{...project, cover:null}} active={false} onSelect={noop} onDeselect={noop} onOpen={noop} onDelete={noop} onChanged={noop} /></div>}</For></div></main>, document.getElementById('root')!);`);
const productionData = resolve('../.runtime/diffusion/profile/agent-chat');
const store = new ChatStore(join(root, 'data'));
const productionStore = new ChatStore(productionData);
for (const meta of await productionStore.list()) if (projects.some(p => p.id === meta.projectId)) await store.writeMeta(meta);
await writeFile(join(root, 'data', 'project-token-usage-v1.json'), await readFile(join(productionData, 'project-token-usage-v1.json')));
const recovery = new NativeUsageRecovery(resolve('../.runtime/diffusion/codex-runtime'), store);
// No start/probe, harness, send or editor API. Only the usage request is available to these cards.
const host = new AgentHost({ store, harnesses: [], env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null,
  version: 'native-record-review', recoverUsage: ids => recovery.recover(ids) });
const socket = await startServer({ host: '127.0.0.1', port: 0, token: 'local-native-record-review', allowedOrigins: ['http://localhost:5392'], agentHost: host });
const vite = await createServer({ configFile: resolve('apps/web/vite.config.ts'), root, publicDir: resolve('apps/web/syka-public'),
  define: { 'import.meta.env.VITE_AGENT_CHAT_URL': JSON.stringify(socket.url) }, server: { port: 5392, strictPort: true, host: 'localhost' } });
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://localhost:5392', { waitUntil: 'networkidle' });
  const summaries = await store.usage.list(projects.map(p => p.id));
  for (const usage of summaries) {
    const card = page.locator(`[data-project="${usage.projectId}"]`);
    const label = card.locator('span[aria-label$="tokens"], span[aria-label="Tokens: sin datos"]');
    await label.waitFor();
    if (!usage.models.length) { assert.equal(await label.textContent(), 'Tokens: sin datos'); continue; }
    console.log(`Checking ${projects.find(p => p.id === usage.projectId).displayName}`);
    await label.hover();
    const exact = new Intl.NumberFormat('es-AR').format(usage.tokens.totalTokens);
    const tip = page.getByRole('tooltip').filter({ hasText: `${exact} tokens reportados` });
    await tip.waitFor().catch(async error => {
      await page.screenshot({ path: join(output, 'tooltip-diagnostic.png'), fullPage: true });
      await writeFile(join(output, 'tooltip-diagnostic.txt'), await page.locator('body').innerText());
      throw error;
    });
    await page.waitForFunction(expected => [...document.querySelectorAll('[role="tooltip"]')].some(t => t.textContent?.includes(expected)), `${new Intl.NumberFormat('es-AR').format(usage.tokens.totalTokens)} tokens reportados`);
    assert.match(await tip.innerText(), /Modelo sin desglosar/);
    await page.mouse.move(0, 0);
    await tip.waitFor({ state: 'hidden' });
  }
  await page.screenshot({ path: join(output, 'cards-native-records.png'), fullPage: true });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-project]').count(), 10); assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), JSON.stringify({ cards: 10, measured: summaries.filter(s => s.models.length).length,
    totalTokens: summaries.reduce((sum, s) => sum + s.tokens.totalTokens, 0), exactTooltips: true, reload: true, errors, liveEditorInspected: false }, null, 2));
  console.log(await readFile(join(output, 'result.json'), 'utf8'));
} finally {
  await browser?.close(); await socket.close(); await vite.close(); await store.flush();
}
