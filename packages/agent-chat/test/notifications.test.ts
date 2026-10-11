import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { NoticeStore, cleanNoticeText, isAuthenticationError, isNoticeEvent } from '../src/notifications';
import type { AgentNoticeEvent, StudioNotice } from '../src/notifications';
import { AgentHost } from '../src/host/host';
import { ChatStore } from '../src/host/store';
import { FakeHarness } from '../src/host/fake';
import { WorkspaceTools } from '../src/host/workspace-tools';
import type { PendingRequest } from '../src/protocol';

const fixtures: { root: string; host?: AgentHost }[] = [];
async function fixture() { const root = await mkdtemp(join(tmpdir(), 'syka-notices-')); const f = { root, host: undefined as AgentHost | undefined }; fixtures.push(f); return f; }
afterEach(async () => { for (const f of fixtures.splice(0)) { await f.host?.stop(); if (!f.root.startsWith(join(tmpdir(), 'syka-notices-'))) throw Error('Unsafe cleanup'); await rm(f.root, { recursive: true, force: true }); } });
const connection = { send: () => {} }, model = { harness: 'codex' as const, model: 'fake' };
const notice = (id: string): StudioNotice => ({ id, kind: 'question', title: 'Question', message: 'Question', projectName: id, createdAt: 1 });

it('keeps project notices separate, deduplicates replay and does not cancel a dismissed question', () => {
  const store = new NoticeStore();
  expect(store.upsert(notice('a'))).toBe(true); expect(store.upsert(notice('a'))).toBe(false);
  store.upsert(notice('b')); store.dismiss('a');
  expect(store.visible().map(n => n.id)).toEqual(['b']); expect(store.get('a')).toBeDefined();
  store.upsert(notice('a')); expect(store.visible().map(n => n.id)).toEqual(['b']);
  store.remove('a'); store.upsert(notice('a')); expect(store.visible().map(n => n.id)).toEqual(['b', 'a']);
});
it('keeps reasoning and ordinary completed turns out of delivery notices', () => {
  expect(isNoticeEvent({ type: 'item.completed', item: { id: 'r', kind: 'reasoning', text: 'private' } })).toBe(false);
  expect(isNoticeEvent({ type: 'turn.completed', turnId: 't', status: 'completed' })).toBe(false);
  expect(isNoticeEvent({ type: 'turn.completed', turnId: 't', status: 'failed', error: 'missing' })).toBe(true);
  expect(isAuthenticationError('401 Unauthorized')).toBe(true); expect(isAuthenticationError('ENOENT logo.png')).toBe(false);
  expect(isAuthenticationError('Groq rechazó la clave. Revisala en Proveedores.')).toBe(true);
  expect(cleanNoticeText('Bearer secret-value https://example.org/?token=secret')).not.toContain('secret');
});
it('answers a host question from another connection, correlates the project, and rejects stale replies', async () => {
  const f = await fixture(), events: AgentNoticeEvent[] = [];
  const host = f.host = new AgentHost({ version: 'test', store: new ChatStore(f.root), harnesses: [new FakeHarness()], env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null, onNotice: event => events.push(event) });
  await host.start();
  const { chatId } = await host.handle(connection, 'turn.send', { projectId: 'project-a', cwd: f.root, text: 'ask workspace', model });
  await vi.waitFor(() => expect(events.some(e => e.event.type === 'request.opened')).toBe(true));
  const event = events.find(e => e.event.type === 'request.opened')!;
  expect(event.chat.id).toBe(chatId); expect(event.chat.projectId).toBe('project-a'); expect(event.cwd).toBe(f.root);
  const request = (event.event as { request: PendingRequest }).request;
  await host.handle({ send: () => {} }, 'request.respond', { chatId, requestId: request.id, response: { answers: { [request.questions[0]!.id]: ['9:16'] } } });
  await vi.waitFor(() => expect(events.some(e => e.event.type === 'request.resolved')).toBe(true));
  await expect(host.handle(connection, 'request.respond', { chatId, requestId: request.id, response: { answers: { x: ['wrong'] } } })).rejects.toThrow('No question');
  expect(events.every(e => isNoticeEvent(e.event))).toBe(true);
});
it('restores an unanswered question after host restart without needing an open chat view', async () => {
  const f = await fixture(), store = new ChatStore(f.root), events: AgentNoticeEvent[] = [];
  const config = { version: 'test', store, harnesses: [new FakeHarness()], env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null };
  f.host = new AgentHost(config); await f.host.start();
  const { chatId } = await f.host.handle(connection, 'turn.send', { projectId: 'p', cwd: f.root, text: 'ask detached', model });
  await vi.waitFor(async () => expect((await f.host!.handle(connection, 'chats.open', { chatId })).pending).toBeDefined());
  await f.host.stop();
  f.host = new AgentHost({ ...config, store: new ChatStore(f.root), onNotice: e => events.push(e) }); await f.host.start();
  expect(events.some(e => e.chat.id === chatId && e.event.type === 'request.opened')).toBe(true);
});
it('delivers photo references to the original running question and records them only in that chat', async () => {
  const f = await fixture(), host = f.host = new AgentHost({ version: 'test', store: new ChatStore(f.root), harnesses: [new FakeHarness()], env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null });
  await host.start();
  const first = await host.handle(connection, 'turn.send', { projectId: 'photo-project', cwd: f.root, text: 'ask workspace', model });
  const other = await host.handle(connection, 'turn.send', { projectId: 'other-project', cwd: f.root, text: 'ask workspace', model });
  let request: PendingRequest;
  await vi.waitFor(async () => { const s = await host.handle(connection, 'chats.open', first); expect(s.pending).toBeTruthy(); request = s.pending!; });
  const path = join(f.root, 'referencia.png'); await writeFile(path, 'photo fixture');
  await host.handle(connection, 'request.respond', { ...first, requestId: request!.id, response: { answers: { [request!.questions[0]!.id]: ['9:16'] }, attachments: [path] } });
  await vi.waitFor(async () => expect((await host.handle(connection, 'chats.open', first)).chat.status).toBe('idle'));
  const done = await host.handle(connection, 'chats.open', first);
  expect(done.items.some(i => i.kind === 'assistant' && i.text.includes(path))).toBe(true);
  expect(done.items.find(i => i.kind === 'user' && i.attachments?.includes(path))).toMatchObject({ attachments: [path] });
  expect(done.items.find(i => i.kind === 'question')).toMatchObject({ answers: { [request!.questions[0]!.id]: ['9:16'] } });
  const unrelated = await host.handle(connection, 'chats.open', other);
  expect(unrelated.pending).toBeTruthy(); expect(unrelated.items.some(i => i.kind === 'user' && i.attachments?.length)).toBe(false);
});
it('keeps attached photos on a continued answer after the original turn ended', async () => {
  const f = await fixture(), host = f.host = new AgentHost({ version: 'test', store: new ChatStore(f.root), harnesses: [new FakeHarness()], env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null });
  await host.start();
  const chat = await host.handle(connection, 'turn.send', { projectId: 'p', cwd: f.root, text: 'ask detached', model });
  let request: PendingRequest;
  await vi.waitFor(async () => { const s = await host.handle(connection, 'chats.open', chat); expect(s.chat.status).toBe('waiting'); expect(s.pending).toBeTruthy(); request = s.pending!; });
  const path = join(f.root, 'foto.png'); await writeFile(path, 'photo fixture');
  await host.handle(connection, 'request.respond', { ...chat, requestId: request!.id, response: { answers: { [request!.questions[0]!.id]: ['Usá esta referencia'] }, attachments: [path] } });
  await vi.waitFor(async () => expect((await host.handle(connection, 'chats.open', chat)).chat.status).toBe('idle'), { timeout: 5000 });
  const done = await host.handle(connection, 'chats.open', chat);
  expect(done.items.some(i => i.kind === 'assistant' && i.text.includes(path))).toBe(true);
  expect(done.items.some(i => i.kind === 'user' && i.attachments?.includes(path))).toBe(true);
});
it('only publishes delivery from real nonempty project files and invokes the cross-provider callback', async () => {
  const f = await fixture(), published: unknown[] = [], tools = new WorkspaceTools(f.root, undefined, undefined, undefined, undefined, undefined, notice => published.push(notice));
  await expect(tools.call('syka_delivery', { status: 'review', message: 'Listo', artifact: 'missing.tsx' })).rejects.toThrow();
  await writeFile(join(f.root, 'scene.tsx'), 'export default function Scene() {}');
  await expect(tools.call('syka_delivery', { status: 'ready', message: 'Listo', artifact: 'scene.tsx' })).rejects.toThrow('evidencia');
  expect(published).toHaveLength(0);
  await tools.call('syka_delivery', { status: 'review', message: 'Falta escuchar el audio', artifact: 'scene.tsx' });
  expect(published).toHaveLength(1); expect(published[0]).toMatchObject({ kind: 'review', artifact: join(f.root, 'scene.tsx') });
  await tools.close();
});
