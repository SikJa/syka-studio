import { mkdtemp, mkdir, writeFile, appendFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { ChatStore, type ChatMeta } from '../src/host/store';
import { NativeUsageRecovery } from '../src/host/native-usage';
import { AgentHost } from '../src/host/host';

let dir: string, runtime: string, data: string, db: DatabaseSync, store: ChatStore;
const root = '11111111-1111-1111-1111-111111111111';
const child = '22222222-2222-2222-2222-222222222222';
const other = '33333333-3333-3333-3333-333333333333';
const meta = (id = root, projectId = 'p', cwd = dir): ChatMeta => ({ id, projectId, cwd, title: 'test', harness: 'codex', model: 'selected-does-not-prove-history', status: 'idle', createdAt: 0, updatedAt: 0, resume: { codex: { threadId: id } } });
const metric = (total: number) => JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: total, input_tokens: total - 10, output_tokens: 10 } } } }) + '\n';
async function session(id: string, total?: number, parent?: string, cwd = dir, file?: string) {
  const path = file ?? join(runtime, 'profile', 'sessions', `${id}.jsonl`);
  await writeFile(path, JSON.stringify({ type: 'session_meta', payload: { id, cwd, ...(parent ? { source: { subagent: { thread_spawn: { parent_thread_id: parent } } } } : {}) } }) + '\n' + (total === undefined ? '' : metric(total)));
  db.prepare('INSERT INTO threads VALUES (?, ?, ?)').run(id, path, cwd);
  if (parent) db.prepare('INSERT INTO thread_spawn_edges VALUES (?, ?)').run(parent, id);
  return path;
}
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'syka-native-usage-')); runtime = join(dir, 'runtime'); data = join(dir, 'data');
  await mkdir(join(runtime, 'isolated-state'), { recursive: true });
  await mkdir(join(runtime, 'profile', 'sessions'), { recursive: true });
  db = new DatabaseSync(join(runtime, 'isolated-state', 'state_5.sqlite'));
  db.exec('CREATE TABLE threads(id TEXT PRIMARY KEY, rollout_path TEXT, cwd TEXT); CREATE TABLE thread_spawn_edges(parent_thread_id TEXT, child_thread_id TEXT);');
  store = new ChatStore(data); await store.writeMeta(meta());
});
afterEach(async () => { await store.flush(); db.close(); await rm(dir, { recursive: true, force: true }); });

it('recovers only visible cursor-linked sessions and verified descendants; reimport/live/restart reconcile', async () => {
  const file = await session(root, 100); await session(child, 40, root);
  await session(other, 900); // Same cwd alone never establishes ownership.
  const recovery = new NativeUsageRecovery(runtime, store);
  await Promise.all([recovery.recover(['p']), recovery.recover(['p', 'p'])]);
  expect((await store.usage.list(['p']))[0]).toMatchObject({ tokens: { totalTokens: 140 }, models: [{ model: '', tokens: { totalTokens: 140 } }] });
  await store.usage.record('p', 'codex', 'new-model', { sessionId: root, kind: 'cumulative', tokens: { totalTokens: 130, inputTokens: 120, outputTokens: 10 } });
  await appendFile(file, metric(130) + '{broken');
  await recovery.recover(['p']);
  const restarted = new ChatStore(data);
  await new NativeUsageRecovery(runtime, restarted).recover(['p']);
  expect((await restarted.usage.list(['p']))[0].tokens.totalTokens).toBe(170);
  expect((await restarted.usage.list(['p']))[0].models.map(m => [m.model, m.tokens.totalTokens])).toEqual([['', 140], ['new-model', 30]]);
  await restarted.flush();
});
it('does not open foreign paths, conflicting ownership, unrelated projects or forged lineage', async () => {
  await session(root, 100); const file = await session(child, 500, root);
  await writeFile(file, JSON.stringify({ type: 'session_meta', payload: { id: child, cwd: dir, source: { subagent: { thread_spawn: { parent_thread_id: other } } } } }) + '\n' + metric(500));
  await session(other, 800, root, dir, join(dir, 'outside.jsonl'));
  const recovery = new NativeUsageRecovery(runtime, store);
  await recovery.recover(['missing']); expect((await store.usage.list(['p']))[0].models).toEqual([]);
  await recovery.recover(['p']); expect((await store.usage.list(['p']))[0].tokens.totalTokens).toBe(100);
  const second = { ...meta(root, 'conflict'), id: 'another-chat' }; await store.writeMeta(second);
  const fresh = new ChatStore(join(dir, 'fresh'));
  await fresh.writeMeta(meta()); await fresh.writeMeta(second);
  await new NativeUsageRecovery(runtime, fresh).recover(['p']); expect((await fresh.usage.list(['p']))[0].models).toEqual([]);
});
it('does not use SQLite default zero, context occupancy, last-turn usage or invalid counters', async () => {
  const file = await session(root);
  await appendFile(file, JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { total_tokens: 999 }, model_context_window: 5000 } } }) + '\n' + metric(-1));
  const recovery = new NativeUsageRecovery(runtime, store);
  await recovery.recover(['p']); expect((await store.usage.list(['p']))[0].models).toEqual([]);
  await appendFile(file, JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 0 } } } }) + '\n');
  await recovery.recover(['p']); expect((await store.usage.list(['p']))[0].models).toHaveLength(1);
});
it('deduplicates alias metas and coexists with other providers and model buckets', async () => {
  await session(root, 100);
  await store.writeMeta({ ...meta(), id: 'alias' });
  await store.usage.record('p', 'claude', 'sonnet', { sessionId: 'claude-session', kind: 'turn', measurementId: 'response:1', tokens: { totalTokens: 60 } });
  await new NativeUsageRecovery(runtime, store).recover(['p']);
  expect((await store.usage.list(['p']))[0].tokens.totalTokens).toBe(160);
});
it('dashboard batch recovers history without opening a chat or invoking a harness', async () => {
  await session(root, 100);
  const recovery = new NativeUsageRecovery(runtime, store);
  const host = new AgentHost({ store, harnesses: [], env: Promise.resolve({ env: {}, extraDirs: [] }),
    mcp: null, version: 'test', recoverUsage: ids => recovery.recover(ids) });
  const summaries = await host.handle({ send() {} }, 'projects.usage', { projectIds: ['p', 'missing', 'p'] });
  expect(summaries.map(s => [s.projectId, s.tokens.totalTokens, s.models.length])).toEqual([['p', 100, 1], ['missing', 0, 0]]);
});
