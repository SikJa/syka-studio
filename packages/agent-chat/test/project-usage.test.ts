import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChatStore } from '../src/host/store';
import { ProjectUsageStore } from '../src/host/project-usage';
import { tokenCounts } from '../src/host/token-usage';
import type { TokenUsageReport } from '../src/protocol';

let dir: string;
let store: ProjectUsageStore;
const cumulative = (total: number, sessionId = 's'): TokenUsageReport => ({ sessionId, kind: 'cumulative', tokens: { totalTokens: total, inputTokens: total - 10, outputTokens: 10, cachedInputTokens: 20, reasoningOutputTokens: 5 } });
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'syka-token-ledger-')); store = new ProjectUsageStore(dir); });
afterEach(async () => { await store.flush().catch(() => {}); await rm(dir, { recursive: true, force: true }); });

describe('persistent project token accounting', () => {
  it('deduplicates cumulative snapshots, late updates and resumed sessions', async () => {
    await store.record('p', 'codex', 'model-a', cumulative(100));
    await store.record('p', 'codex', 'model-a', cumulative(100));
    await store.record('p', 'codex', 'model-a', cumulative(70));
    const restarted = new ProjectUsageStore(dir);
    await restarted.record('p', 'codex', 'model-b', cumulative(130));
    const [usage] = await restarted.list(['p']);
    expect(usage.tokens.totalTokens).toBe(130);
    expect(usage.models.map(m => [m.model, m.tokens.totalTokens])).toEqual([['model-a', 100], ['model-b', 30]]);
    expect(usage.tokens.cachedInputTokens).toBe(20);
    expect(usage.tokens.reasoningOutputTokens).toBe(5); // Already included; not added to total.
    expect(usage).not.toHaveProperty('sources');
  });
  it('counts streamed steps and final session totals once, including imported history', async () => {
    const step: TokenUsageReport = { sessionId: 'agy', kind: 'turn', measurementId: 'step:7', tokens: { totalTokens: 30 } };
    await store.record('p', 'antigravity', 'gemini', step);
    await store.record('p', 'antigravity', 'gemini', step);
    await store.record('p', 'antigravity', 'gemini', { sessionId: 'agy', kind: 'cumulative', tokens: { totalTokens: 150 }, historical: true });
    const restarted = new ProjectUsageStore(dir);
    await restarted.record('p', 'antigravity', 'gemini', step);
    await restarted.record('p', 'antigravity', 'gemini', { ...step, measurementId: 'step:8', tokens: { totalTokens: 20 } });
    await restarted.record('p', 'antigravity', 'gemini', { sessionId: 'agy', kind: 'cumulative', tokens: { totalTokens: 170 }, historical: true });
    const [usage] = await restarted.list(['p']);
    expect(usage.tokens.totalTokens).toBe(170);
    expect(usage.models.map(m => [m.model, m.tokens.totalTokens])).toEqual([['gemini', 50], ['', 120]]);
  });
  it('aggregates many projects/providers/subagent sessions without lost parallel writes', async () => {
    await Promise.all([
      store.record('p1', 'codex', 'sol', cumulative(100, 'parent')),
      store.record('p1', 'codex', '', cumulative(40, 'child')),
      store.record('p1', 'antigravity', 'gemini', cumulative(60)),
      store.record('p2', 'codex', 'sol', cumulative(250)),
    ]);
    const values = await store.list(['p1', 'p2', 'p1']);
    expect(values.map(v => v.tokens.totalTokens)).toEqual([200, 250]);
    const recovered = await new ProjectUsageStore(dir).list(['p1', 'p2']);
    expect(recovered).toEqual(values);
  });
  it('persists a zero-delta first cumulative baseline before resuming', async () => {
    await store.record('p', 'antigravity', 'gemini', { sessionId: 's', kind: 'turn', measurementId: 'step:1', tokens: { totalTokens: 30 } });
    await store.record('p', 'antigravity', 'gemini', { sessionId: 's', kind: 'cumulative', tokens: { totalTokens: 30 } });
    const restarted = new ProjectUsageStore(dir);
    await restarted.record('p', 'antigravity', 'gemini', { sessionId: 's', kind: 'cumulative', tokens: { totalTokens: 40 }, historical: true });
    expect((await restarted.list(['p']))[0].models.map(m => [m.model, m.tokens.totalTokens])).toEqual([['gemini', 40]]);
  });
  it('distinguishes a native zero measurement from missing metrics', async () => {
    await store.record('zero', 'codex', 'sol', { sessionId: 's', kind: 'cumulative', tokens: { totalTokens: 0 } });
    const [zero, missing] = await store.list(['zero', 'missing']);
    expect(zero.models).toHaveLength(1);
    expect(zero.tokens.totalTokens).toBe(0);
    expect(missing.models).toHaveLength(0);
  });
  it('keeps project usage when a chat is removed and treats unmeasured projects as unknown', async () => {
    const chats = new ChatStore(dir);
    await chats.usage.record('p', 'codex', 'sol', cumulative(100));
    await chats.remove('some-chat');
    const values = await chats.usage.list(['p', 'new-project']);
    expect(values[0].tokens.totalTokens).toBe(100);
    expect(values[1]).toMatchObject({ models: [], coverage: 'partial' });
  });
  it('ignores malformed numbers and a per-turn report without a deduplication ID', async () => {
    for (const n of [-1, NaN, Infinity, 0.5]) expect(await store.record('p', 'codex', 'sol', { ...cumulative(100), tokens: { totalTokens: n } })).toBeNull();
    expect(await store.record('p', 'hermes', 'model', { ...cumulative(100), kind: 'turn' })).toBeNull();
    expect((await store.list(['p']))[0].models).toEqual([]);
  });
  it('handles arbitrary stable project IDs without prototype properties', async () => {
    await store.record('__proto__', 'codex', 'sol', cumulative(100));
    await store.record('constructor', 'codex', 'sol', cumulative(200));
    expect((await store.list(['__proto__', 'constructor'])).map(v => v.tokens.totalTokens)).toEqual([100, 200]);
    expect(JSON.parse(await readFile(join(dir, 'project-token-usage-v1.json'), 'utf8')).version).toBe(1);
  });
  it('normalizes native breakdowns without inventing missing fields', () => {
    expect(tokenCounts({ total_tokens: 100, input_tokens: 80, output_tokens: 20, thinking_tokens: 8, cache_read_tokens: 30 }, 'agy')).toEqual({ totalTokens: 100, inputTokens: 80, outputTokens: 20, reasoningOutputTokens: 8, cachedInputTokens: 30 });
    expect(tokenCounts({ totalTokens: 10, inputTokens: 8, outputTokens: 2, cachedReadTokens: 7, thoughtTokens: 1 }, 'acp')).toEqual({ totalTokens: 10, inputTokens: 8, outputTokens: 2, cachedInputTokens: 7, reasoningOutputTokens: 1 });
    expect(tokenCounts({}, 'codex')).toBeNull();
  });
});
