import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AcpHarness } from '../src/host/acp';
import { ChatStore } from '../src/host/store';
import type { HarnessSession, OpenOptions } from '../src/host/harness';
import type { ChatEvent } from '../src/protocol';
import { emptyTranscript, isPersistedEvent, reduce } from '../src/reduce';

const first = 'fixture:model-a', second = 'fixture:model-b';
const roots: string[] = [], sessions: HarnessSession[] = [];
const env = { env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? 'C:\\Windows' }, extraDirs: [] };
async function setup(mode = 'response-first', provider: 'hermes' | 'opencode' = 'hermes', model = first) {
  const root = await mkdtemp(join(tmpdir(), 'syka-context-test-')); roots.push(root);
  const harness = new AcpHarness({ id: provider, command: process.execPath, args: [fileURLToPath(new URL('./fixtures/acp-context.mjs', import.meta.url)), mode, provider], profileDir: root });
  const events: ChatEvent[] = [];
  const options: OpenOptions = { cwd: root, model, mcp: null, env, emit: event => events.push(event) };
  const session = await harness.open(options); sessions.push(session);
  return { root, harness, options, session, events };
}
const contexts = (events: ChatEvent[]) => events.filter(event => event.type === 'context.updated').map(event => event.usage);
afterEach(async () => {
  for (const session of sessions.splice(0)) await session.close();
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !root.includes('syka-context-test-')) throw Error('Invalid cleanup');
    await rm(root, { recursive: true, force: true });
  }
});

describe('native ACP context-window updates', () => {
  it.each(['notification-first', 'response-first'])('keeps usage during session creation, even with a %s RPC race', async mode => {
    const { events } = await setup(mode);
    expect(contexts(events)).toEqual([{ usedTokens: 1200, maxTokens: 128000, approximate: true }]);
  });
  it('accepts window updates outside an active prompt', async () => {
    const { events } = await setup('idle');
    await expect.poll(() => contexts(events)).toEqual([{ usedTokens: 1200, maxTokens: 128000, approximate: true }]);
  });
  it('restores the context of a resumed native session', async () => {
    const { harness, options, session } = await setup('notification-first');
    const events: ChatEvent[] = [];
    const resumed = await harness.open({ ...options, resume: session.resume, emit: event => events.push(event) }); sessions.push(resumed);
    expect(contexts(events)).toEqual([{ usedTokens: 1200, maxTokens: 128000, approximate: true }]);
  });
  it.each(['response-first', 'legacy'])('uses the new model window for a %s model switch', async mode => {
    const { session } = await setup(mode), events: ChatEvent[] = [];
    expect((await session.send('Fixture', second, event => events.push(event))).status).toBe('completed');
    expect(contexts(events).length).toBeGreaterThan(0);
    expect(contexts(events).every(usage => usage.maxTokens === 256000)).toBe(true);
  });
  it('does not reuse the previous window when the new model has not reported one', async () => {
    const { session } = await setup('silent-switch'), events: ChatEvent[] = [];
    expect((await session.send('Fixture', second, event => events.push(event))).status).toBe('completed');
    expect(contexts(events)).toEqual([]);
  });
  it('does not show the runtime default window under a different selected model on creation', async () => {
    const { session, events } = await setup('response-first', 'hermes', second);
    expect(contexts(events)).toEqual([]);
    expect((await session.send('Fixture', second, event => events.push(event))).status).toBe('completed');
    expect(contexts(events).length).toBeGreaterThan(0);
    expect(contexts(events).every(usage => usage.maxTokens === 256000)).toBe(true);
  });
  it('keeps a real zero occupancy distinct from missing data', async () => {
    const { events } = await setup('zero');
    expect(contexts(events)).toEqual([{ usedTokens: 0, maxTokens: 128000, approximate: true }]);
  });
  it('rejects invalid counts, other sessions, totals and cost-only updates', async () => {
    const { session, events } = await setup('invalid');
    expect((await session.send('Fixture', first, event => events.push(event))).status).toBe('completed');
    expect(contexts(events)).toEqual([]);
    expect(events.some(event => event.type === 'usage.reported')).toBe(false);
  });
  it('accepts a final occupancy update after the prompt has completed', async () => {
    const { session, events } = await setup('late');
    expect((await session.send('Fixture', first, event => events.push(event))).status).toBe('completed');
    await expect.poll(() => contexts(events).at(-1)?.usedTokens).toBe(2400);
    expect(events.some(event => event.type === 'usage.reported')).toBe(false);
  });
  it('does not treat a context-window update as assistant output or billed usage', async () => {
    const { session } = await setup('window-only'), events: ChatEvent[] = [];
    expect(await session.send('Fixture', first, event => events.push(event))).toMatchObject({ status: 'failed', error: expect.stringContaining('sin devolver texto') });
    expect(contexts(events).at(-1)?.usedTokens).toBe(2000);
    expect(events.some(event => event.type === 'usage.reported')).toBe(false);
  });
  it('accepts native context on interruption without claiming a completed turn', async () => {
    const { session } = await setup('hold'), events: ChatEvent[] = [];
    const running = session.send('Fixture', first, event => events.push(event));
    await session.interrupt();
    expect((await running).status).toBe('interrupted');
    expect(contexts(events).at(-1)?.usedTokens).toBe(1800);
  });
  it('restores the same-model window after the transcript clears it for a new turn', async () => {
    const { session, events } = await setup();
    let state = events.reduce(reduce, emptyTranscript());
    state = reduce(state, { type: 'turn.started', turnId: 'fixture-turn', model: first, user: { id: 'user', kind: 'user', text: 'Fixture' } });
    expect(state.contextUsage).toBeUndefined();
    const updates: ChatEvent[] = [];
    expect((await session.send('Fixture', first, event => updates.push(event))).status).toBe('completed');
    expect(contexts(updates)[0]).toEqual({ usedTokens: 1200, maxTokens: 128000, approximate: true });
    state = updates.filter(isPersistedEvent).reduce(reduce, state);
    expect(state.contextUsage).toEqual({ usedTokens: 2400, maxTokens: 128000, approximate: true });
  });
  it('does not mark another ACP runtime as the Hermes estimator', async () => {
    const { events } = await setup('response-first', 'opencode');
    expect(contexts(events)).toEqual([{ usedTokens: 1200, maxTokens: 128000 }]);
  });
  it('preserves the native window and estimate qualifier when reopening a stored chat', async () => {
    const { root, events } = await setup();
    const store = new ChatStore(join(root, 'chat-store'));
    await store.writeMeta({ id: 'fixture-chat', projectId: 'fixture-project', title: 'Fixture', harness: 'hermes', model: first, status: 'idle', createdAt: 1, updatedAt: 1, cwd: root, resume: null });
    for (const event of events.filter(isPersistedEvent)) await store.append('fixture-chat', event);
    const reopened = await new ChatStore(join(root, 'chat-store')).readTranscript('fixture-chat');
    expect(reopened.contextUsage).toEqual({ usedTokens: 1200, maxTokens: 128000, approximate: true });
    await expect(stat(join(root, 'chat-store', 'project-token-usage-v1.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
