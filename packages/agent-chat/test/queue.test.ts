import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { AgentHost } from '../src/host/host';
import { ChatStore } from '../src/host/store';
import type { Harness, HarnessSession, TurnOutcome } from '../src/host/harness';
import type { ChatSnapshot, HostMsg } from '../src/protocol';

const model = { harness: 'codex' as const, model: 'test', effort: 'high' };
const connections = [{ send: (_message: HostMsg) => {} }, { send: (_message: HostMsg) => {} }];
const fixtures: { host: AgentHost; root: string }[] = [];
async function setup(supportsSteering = true) {
  const root = await mkdtemp(join(tmpdir(), 'syka-queue-test-'));
  const sent: string[] = [], inserted: string[] = [];
  let finish: ((outcome: TurnOutcome) => void) | undefined;
  const session: HarnessSession = {
    resume: { codex: { threadId: 'test' } },
    send: (text) => { sent.push(text); return new Promise(resolve => { finish = resolve; }); },
    ...(supportsSteering ? { steer: async (text: string) => { inserted.push(text); } } : {}),
    respond: () => {}, interrupt: async () => { finish?.({ status: 'interrupted' }); }, close: async () => {},
  };
  const harness: Harness = { id: 'codex', probe: async () => ({ id: 'codex', label: 'Test', status: 'ready', models: [{ id: 'test', label: 'Test' }] }), open: async () => session };
  const store = new ChatStore(root);
  const host = new AgentHost({ version: 'test', store, harnesses: [harness], env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null, log: () => {} });
  fixtures.push({ host, root }); await host.start();
  const { chatId } = await host.handle(connections[0]!, 'turn.send', { projectId: 'p', cwd: root, text: 'first', model });
  await vi.waitFor(() => expect(sent).toHaveLength(1));
  const snapshot = () => host.handle(connections[1]!, 'chats.open', { chatId });
  const add = (text: string, attachments: string[] = []) => host.handle(connections[0]!, 'queue.add', { chatId, text, attachments, model });
  return { host, store, harness, root, chatId, sent, inserted, snapshot, add, finish: (status: TurnOutcome['status'] = 'completed') => finish?.({ status }) };
}
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.host.stop();
    if (!resolve(fixture.root).startsWith(resolve(tmpdir()) + sep) || !fixture.root.includes('syka-queue-test-')) throw Error('Invalid cleanup');
    await rm(fixture.root, { recursive: true, force: true });
  }
});

it('keeps FIFO messages and attachments across clients, sending each only once', async () => {
  const f = await setup();
  await f.add('second', [join(f.root, 'image.png')]); await f.add('third');
  expect((await f.snapshot()).queue?.messages.map(message => message.text)).toEqual(['second', 'third']);
  f.finish(); await vi.waitFor(() => expect(f.sent).toHaveLength(2));
  expect(f.sent[1]).toContain('second'); expect(f.sent[1]).toContain('image.png');
  f.finish(); await vi.waitFor(() => expect(f.sent).toHaveLength(3));
  expect(f.sent[2]).toBe('third');
  f.finish(); await vi.waitFor(async () => expect((await f.snapshot()).chat.status).toBe('idle'));
  expect((await f.snapshot()).queue?.messages).toEqual([]);
});

it('removes only the chosen message for editing or deletion, retaining the attachment paths', async () => {
  const f = await setup();
  const queued = await f.add('edit me', [join(f.root, 'reference.png')]); await f.add('keep me');
  const message = queued.messages[0]!;
  expect(message.attachments).toHaveLength(1);
  await f.host.handle(connections[0]!, 'queue.remove', { chatId: f.chatId, messageId: message.id });
  expect((await f.snapshot()).queue?.messages.map(message => message.text)).toEqual(['keep me']);
  await expect(f.host.handle(connections[0]!, 'queue.remove', { chatId: f.chatId, messageId: message.id })).rejects.toThrow('ya salió');
});

it('redirects into the same active turn and records the user message after acknowledgement', async () => {
  const f = await setup();
  const queued = await f.add('correction', [join(f.root, 'logo.svg')]);
  await f.host.handle(connections[0]!, 'queue.redirect', { chatId: f.chatId, messageId: queued.messages[0]!.id });
  expect(f.sent).toHaveLength(1); expect(f.inserted[0]).toContain('correction'); expect(f.inserted[0]).toContain('logo.svg');
  const snapshot = await f.snapshot();
  expect(snapshot.queue?.messages).toEqual([]);
  expect(snapshot.items).toContainEqual(expect.objectContaining({ kind: 'user', text: 'correction' }));
  expect(snapshot.chat.status).toBe('running');
});

it('preserves the queue when insertion is unsupported or rejected', async () => {
  const f = await setup(false); const queued = await f.add('keep me');
  await expect(f.host.handle(connections[0]!, 'queue.redirect', { chatId: f.chatId, messageId: queued.messages[0]!.id })).rejects.toThrow('no permite');
  expect((await f.snapshot()).queue?.messages).toHaveLength(1);
  await expect(f.host.handle(connections[0]!, 'queue.add', { chatId: f.chatId, text: 'wrong harness', model: { harness: 'claude', model: 'x' } })).rejects.toThrow('conserva');
});

it('pauses on stop and resumes only by user action', async () => {
  const f = await setup(); await f.add('later');
  await f.host.handle(connections[0]!, 'turn.interrupt', { chatId: f.chatId });
  expect(f.sent).toHaveLength(1); expect((await f.snapshot()).queue?.paused).toBe(true);
  await f.host.handle(connections[0]!, 'queue.resume', { chatId: f.chatId });
  await vi.waitFor(() => expect(f.sent).toHaveLength(2));
});

it('pauses after a failed turn and persists messages across a host restart without auto-running', async () => {
  const f = await setup(); await f.add('recover me');
  f.finish('failed'); await vi.waitFor(async () => expect((await f.snapshot()).queue?.paused).toBe(true));
  await f.host.stop();
  const fresh = new AgentHost({ version: 'test', store: f.store, harnesses: [f.harness], env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null });
  fixtures[fixtures.length - 1]!.host = fresh; await fresh.start();
  const snapshot: ChatSnapshot = await fresh.handle(connections[1]!, 'chats.open', { chatId: f.chatId });
  expect(snapshot.queue?.paused).toBe(true); expect(snapshot.queue?.messages[0]?.text).toBe('recover me'); expect(f.sent).toHaveLength(1);
});
