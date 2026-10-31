import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AcpHarness } from '../src/host/acp';
import { grokAcpArgs } from '../src/host/browser-acp';
import type { HarnessSession } from '../src/host/harness';
import type { ChatEvent } from '../src/protocol';

const roots: string[] = [], sessions: HarnessSession[] = [];
afterEach(async () => {
  await Promise.all(sessions.splice(0).map(session => session.close()));
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});
describe('Grok owned ACP lifecycle', () => {
  it('completes two turns through exact native receipts without a prompt RPC response', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-grok-lifecycle-')); roots.push(root);
    const harness = new AcpHarness({ id: 'grok', command: process.execPath, args: [fileURLToPath(new URL('./fixtures/acp-agent.mjs', import.meta.url)), 'grok-complete', 'grok'], profileDir: root });
    const session = await harness.open({ cwd: root, model: 'model-one', mcp: null, env: { env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? 'C:\\Windows' }, extraDirs: [] }, emit() {} }); sessions.push(session);
    for (let turn = 0; turn < 2; turn++) {
      const events: ChatEvent[] = [];
      expect(await session.send('test', 'model-one', event => events.push(event))).toEqual({ status: 'completed' });
      expect(session.isClosed).toBe(false);
      expect(events.filter(event => event.type === 'usage.reported')).toHaveLength(1);
      expect(events.find(event => event.type === 'item.completed' && event.item.kind === 'assistant')).toMatchObject({ item: { text: 'Grok response' } });
    }
  });
  it('isolates the default and historical launch arguments without changing custom routes', () => {
    const expected = ['--no-auto-update', 'agent', '--no-leader', 'stdio'];
    expect(grokAcpArgs()).toEqual(expected);
    expect(grokAcpArgs(['agent', 'stdio'])).toEqual(expected);
    expect(grokAcpArgs(['custom', 'agent'])).toEqual(['custom', 'agent']);
  });
});
