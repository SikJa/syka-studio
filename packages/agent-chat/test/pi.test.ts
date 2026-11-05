import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChatEvent } from '../src/protocol';
import { PiHarness, piProviderEnv, splitPiModel } from '../src/host/pi';
import { setProviders } from '../src/host/providers';

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); setProviders([]); });

/** A stand-in for `pi --mode rpc`: models from FAKE_MODELS, a turn with thinking, a tool and text. */
const FAKE_PI = `
const rl = require('node:readline').createInterface({ input: process.stdin });
const out = frame => process.stdout.write(JSON.stringify(frame) + '\\n');
const models = JSON.parse(process.env.FAKE_MODELS || '[]');
rl.on('line', line => {
  const f = JSON.parse(line);
  const ok = data => out({ type: 'response', id: f.id, command: f.type, success: true, data });
  if (f.type === 'get_available_models') return ok({ models });
  if (f.type === 'get_state') return ok({ sessionFile: process.env.FAKE_SESSION || null });
  if (f.type === 'set_model') { process.env.LAST_MODEL = f.provider + '/' + f.modelId; return ok({}); }
  if (f.type === 'abort') return ok({});
  if (f.type === 'prompt') {
    ok({});
    const said = f.message.includes('---') ? 'con instrucciones' : 'sin instrucciones';
    out({ type: 'message_update', assistantMessageEvent: { type: 'thinking_delta', delta: 'pienso' } });
    out({ type: 'tool_execution_start', toolCallId: 'c1', toolName: 'read', args: { path: 'a.txt' } });
    out({ type: 'extension_ui_request', id: 'u1', method: 'confirm', title: '¿Seguro?' });
    out({ type: 'tool_execution_end', toolCallId: 'c1', result: { content: [{ type: 'text', text: 'contenido' }] } });
    out({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'Hola ' } });
    out({ type: 'message_end', message: { role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: 'Hola ' + said + ' (' + process.env.LAST_MODEL + ')' }] } });
    out({ type: 'agent_settled' });
  }
  if (f.type === 'extension_ui_response') process.stderr.write('dialog ' + (f.cancelled ? 'cancelled' : 'answered') + '\\n');
});`;

async function harness(env: Record<string, string> = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'syka-pi-')); dirs.push(dir);
  const script = join(dir, 'fake-pi.cjs');
  await writeFile(script, FAKE_PI);
  const seen: Record<string, string>[] = [];
  const pi = new PiHarness((_command, _args, _cwd, childEnv) => { seen.push(childEnv); return spawn(process.execPath, [script], { env: { ...childEnv, ...env }, stdio: ['pipe', 'pipe', 'pipe'] }); });
  const host = { env: { ...process.env, SYKA_PI_PATH: script } as Record<string, string>, extraDirs: [] };
  return { pi, host, seen, dir };
}

describe('Pi harness', () => {
  it('lists the models Pi has, or asks to sign in when it has none', async () => {
    const empty = await harness();
    expect(await empty.pi.probe(empty.host, new AbortController().signal)).toMatchObject({ id: 'pi', status: 'signed-out', models: [] });
    const ready = await harness({ FAKE_MODELS: JSON.stringify([{ provider: 'openrouter', id: 'qwen/qwen3-coder', name: 'Qwen3 Coder' }]) });
    expect(await ready.pi.probe(ready.host, new AbortController().signal)).toMatchObject({ status: 'ready', defaultModel: 'openrouter/qwen/qwen3-coder', models: [{ id: 'openrouter/qwen/qwen3-coder', label: 'Qwen3 Coder · openrouter' }] });
  });

  it('runs a turn: thinking, a tool and the final text, with Syka\'s instructions only first', async () => {
    const { pi, host } = await harness({ FAKE_SESSION: 'C:/pi/session.jsonl' });
    const session = await pi.open({ cwd: process.cwd(), model: 'openrouter/qwen/qwen3-coder', mcp: null, instructions: 'Sos el editor de Syka.', env: host, emit: () => {} });
    const events: ChatEvent[] = [];
    expect(await session.send('hola', 'openrouter/qwen/qwen3-coder', event => events.push(event))).toEqual({ status: 'completed' });
    const completed = events.filter(event => event.type === 'item.completed').map(event => (event as { item: { kind: string; text?: string; status?: string; output?: string } }).item);
    expect(completed.find(item => item.kind === 'reasoning')?.text).toBe('pienso');
    expect(completed.find(item => item.kind === 'tool')).toMatchObject({ status: 'done', output: 'contenido' });
    expect(completed.find(item => item.kind === 'assistant')?.text).toBe('Hola con instrucciones (openrouter/qwen/qwen3-coder)');
    const second: ChatEvent[] = [];
    await session.send('otra', 'openrouter/qwen/qwen3-coder', event => second.push(event));
    expect(second.some(event => event.type === 'item.completed' && (event.item as { text?: string }).text?.includes('sin instrucciones'))).toBe(true);
    expect(session.resume).toEqual({ pi: { sessionFile: 'C:/pi/session.jsonl' } });
    await session.close();
  });

  it('hands Pi the keys saved in Proveedores, in memory', async () => {
    setProviders([{ id: 'or-1', kind: 'openrouter', name: 'OR', enabled: true, models: [], apiKey: 'sk-or' }, { id: 'oa-1', kind: 'openai', name: 'OA', enabled: true, models: [], apiKey: 'sk-oa' }]);
    expect(piProviderEnv()).toEqual({ OPENROUTER_API_KEY: 'sk-or', OPENAI_API_KEY: 'sk-oa' });
    expect(splitPiModel('openrouter/qwen/qwen3-coder')).toEqual({ provider: 'openrouter', modelId: 'qwen/qwen3-coder' });
  });
});
