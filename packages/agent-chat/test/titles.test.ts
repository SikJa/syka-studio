import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cleanTitle, titleModel } from '../src/host/titles';
import { AgentHost } from '../src/host/host';
import { ChatStore } from '../src/host/store';
import type { HarnessInfo } from '../src/protocol';

const info = (id: HarnessInfo['id'], models: string[]): HarnessInfo => ({ id, label: id, status: 'ready', models: models.map(model => ({ id: model, label: model })) });

describe('project titles from the small model', () => {
  it('picks each provider small model from its own catalog', () => {
    expect(titleModel(info('codex', ['gpt-5.6-terra', 'gpt-6-luna']))).toBe('gpt-6-luna');
    expect(titleModel(info('claude', ['opus', 'sonnet', 'haiku']))).toBe('haiku');
    expect(titleModel(info('antigravity', ['gemini-3.8-flash-high', 'gemini-3.8-flash-low']))).toBe('gemini-3.8-flash-low');
    expect(titleModel(info('hermes', ['x']))).toBeUndefined();
    expect(titleModel({ ...info('codex', ['gpt-6-luna']), status: 'signed-out' })).toBeUndefined();
  });
  it('cleans the answer to a usable title', () => {
    expect(cleanTitle('"Clip de ingresos con IA".\n\nexplicación')).toBe('Clip de ingresos con IA');
    expect(cleanTitle('Título: **Lanzamiento de app**')).toBe('Lanzamiento de app');
    expect(cleanTitle('')).toBeNull();
    expect(cleanTitle('x'.repeat(120))).toBeNull();
  });
  it('runs one tool-less turn with the small model outside the project and closes it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-title-'));
    const close = vi.fn(async () => {});
    const open = vi.fn(async (_options: { cwd: string; mcp: unknown; model: string }) => ({
      resume: null, isClosed: false, respond() {}, interrupt: async () => {}, close,
      send: async (_text: string, _model: string, emit: (event: unknown) => void) => {
        emit({ type: 'item.completed', item: { id: 'a', kind: 'assistant', text: 'Ingresos con sistemas de IA' } });
        return { status: 'completed' as const };
      },
    }));
    const harness = { id: 'claude', probe: async () => info('claude', ['opus', 'haiku']), open };
    const host = new AgentHost({ version: 'fixture', store: new ChatStore(join(root, 'data')), harnesses: [harness as never], env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null });
    const connection = { send() {} };
    try {
      host.connect(connection as never); await host.start();
      await host.handle(connection as never, 'harnesses.list', { refresh: true });
      expect(await host.handle(connection as never, 'titles.suggest', { harness: 'claude', text: '¿Ya conseguís ingresos haciendo sistemas con IA?' })).toEqual({ title: 'Ingresos con sistemas de IA', model: 'haiku' });
      expect(open.mock.calls[0]![0]).toMatchObject({ model: 'haiku', mcp: null });
      expect(open.mock.calls[0]![0].cwd).toContain('syka-titles');
      await vi.waitFor(() => expect(close).toHaveBeenCalled());
    } finally { await host.stop(); await rm(root, { recursive: true, force: true }); }
  });
});
