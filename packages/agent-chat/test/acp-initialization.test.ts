import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AcpHarness } from '../src/host/acp';
import type { HarnessSession } from '../src/host/harness';
import type { ChatEvent } from '../src/protocol';
const roots: string[] = [], sessions: HarnessSession[] = [];
const env = { env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? 'C:\\Windows' }, extraDirs: [] };
async function setup(mode: string) {
  const root = await mkdtemp(join(tmpdir(), 'syka-acp-init-')); roots.push(root);
  const harness = new AcpHarness({ id: 'cursor', command: process.execPath, args: [fileURLToPath(new URL('./fixtures/acp-agent.mjs', import.meta.url)), mode, 'cursor'], profileDir: root });
  return { harness, root };
}
afterEach(async () => {
  for (const session of sessions.splice(0)) await session.close();
  for (const root of roots.splice(0)) { if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !root.includes('syka-acp-init-')) throw Error('Invalid cleanup'); await rm(root, { recursive: true, force: true }); }
});
describe('ACP v1 optional implementation metadata', () => {
  it('does not forward private thought chunks into the chat or durable event stream', async () => {
    const { harness, root } = await setup('private-thought');
    const events: ChatEvent[] = [];
    const session = await harness.open({ cwd: root, model: 'model-one', mcp: null, env, emit: event => events.push(event) }); sessions.push(session);
    expect((await session.send('fixture', 'model-one', event => events.push(event))).status).toBe('completed');
    expect(JSON.stringify(events)).not.toContain('PRIVATE_REASONING_IN_ENGLISH');
    expect(JSON.stringify(events)).toContain('hello world');
    expect(events.filter(e => e.type === 'item.started' && e.item.kind === 'reasoning')).toHaveLength(1);
  });
  it('loads the catalog and opens a session when Cursor omits agentInfo', async () => {
    const { harness, root } = await setup('no-agent-info');
    expect(await harness.probe(env, new AbortController().signal)).toMatchObject({ status: 'ready', defaultModel: 'model-one', models: [{ id: 'model-one' }, { id: 'future-model' }] });
    const session = await harness.open({ cwd: root, model: 'model-one', mcp: null, env, emit: () => {} }); sessions.push(session);
    expect((await session.send('fixture', 'model-one', () => {})).status).toBe('completed');
  });
  it.each(['wrong-binary', 'malformed-agent-info', 'v2'])('rejects %s without declaring a missing login', async mode => {
    const { harness } = await setup(mode);
    expect(await harness.probe(env, new AbortController().signal)).toMatchObject({ status: 'error', models: [] });
  });
});
