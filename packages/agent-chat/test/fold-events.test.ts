import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { emptyTranscript, foldEvents, reduceAll } from '../src/reduce';
import { snapshotItems } from '../src/host/host';
import type { ChatEvent } from '../src/protocol';

const user = (id: string) => ({ id, kind: 'user' as const, text: id });
const tool = (id: string, status: 'running' | 'done') => ({ id, kind: 'tool' as const, name: 'x', title: 'x', status });
const fixture: ChatEvent[] = [
  { type: 'turn.started', turnId: 't1', model: 'm', user: user('u1') },
  { type: 'item.started', item: { id: 'a1', kind: 'assistant', text: 'Ho' } },
  { type: 'item.delta', itemId: 'a1', text: 'la' },
  { type: 'item.delta', itemId: 'missing', text: 'x' },
  { type: 'item.started', item: tool('k1', 'running') },
  { type: 'request.opened', request: { id: 'q', questions: [] } as never },
  { type: 'context.updated', usage: { used: 1, size: 2 } as never },
  { type: 'turn.completed', turnId: 't1', status: 'failed' },
  { type: 'turn.started', turnId: 't2', model: 'm', user: user('u2') },
  { type: 'item.completed', item: tool('k2', 'done') },
  { type: 'request.opened', request: { id: 'q2', questions: [] } as never },
  { type: 'request.resolved', requestId: 'other', outcome: 'answered' },
  { type: 'queue.updated', queue: { messages: [], paused: false } as never },
  { type: 'turn.completed', turnId: 't2', status: 'completed' },
  { type: 'item.completed', item: { id: 'a1', kind: 'assistant', text: 'Hola final' } },
];

describe('chat snapshot', () => {
  it('keeps every visible item and the whole latest turn, and drops hidden steps of finished turns', () => {
    const items = [user('u1'), tool('old', 'done'), { id: 'r1', kind: 'reasoning' as const, text: 'x' }, { ...tool('img', 'done'), name: 'imageGeneration' },
      { id: 'a1', kind: 'assistant' as const, text: 'listo' }, user('u2'), tool('now', 'running'), { id: 'r2', kind: 'reasoning' as const, text: 'y' }];
    expect(snapshotItems(items as never).map(item => item.id)).toEqual(['u1', 'img', 'a1', 'u2', 'now', 'r2']);
  });
  it('trims long finished tool output but never a generated image result', () => {
    const long = 'x'.repeat(5000);
    const [trimmed, image] = snapshotItems([{ ...tool('t', 'done'), output: long }, { ...tool('i', 'done'), name: 'imageGeneration', output: long }] as never) as { output: string }[];
    expect(trimmed!.output.length).toBeLessThan(1300);
    expect(image!.output).toBe(long);
  });
});

describe('foldEvents', () => {
  it('matches the pure reducer event by event semantics', () => {
    expect(foldEvents(fixture)).toEqual(reduceAll(emptyTranscript(), fixture));
  });
  it('does not mutate its initial transcript', () => {
    const initial = reduceAll(emptyTranscript(), fixture.slice(0, 5));
    const copy = JSON.parse(JSON.stringify(initial));
    foldEvents(fixture.slice(5), initial);
    expect(JSON.parse(JSON.stringify(initial))).toEqual(copy);
  });
  // Real local history, when present on this machine: the fast fold must be identical.
  const chats = 'E:\\Syka Studio\\Datos\\profile\\agent-chat\\chats';
  it.skipIf(!existsSync(chats))('matches the reducer on every real chat log', () => {
    for (const id of readdirSync(chats)) {
      const file = join(chats, id, 'events.jsonl');
      if (!existsSync(file)) continue;
      const events = readFileSync(file, 'utf8').split('\n').flatMap(line => { try { return line.trim() ? [JSON.parse(line) as ChatEvent] : []; } catch { return []; } });
      expect(JSON.parse(JSON.stringify(foldEvents(events)))).toEqual(JSON.parse(JSON.stringify(reduceAll(emptyTranscript(), events))));
    }
  }, 120_000);
});
