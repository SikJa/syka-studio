import { describe, expect, it } from 'vitest';
import type { Item } from '@diffusionstudio/agent-chat';
import { thinkingEntries, thinkingSeconds, toolVerb, turnTraces } from './thinking-entries';

const tool = (id: string, title: string, status: 'running' | 'done' | 'failed' = 'done', extra: Partial<Item> = {}): Item =>
  ({ id, kind: 'tool', name: 'syka_files', title, status, ...extra }) as Item;

describe('thinking entries', () => {
  it('shows tools with their verb and only public reasoning summaries', () => {
    const items: Item[] = [
      { id: 'r1', kind: 'reasoning', text: 'Pensamiento privado del modelo.' },
      { id: 'r2', kind: 'reasoning', text: 'Voy a revisar el proyecto. Después edito la escena.', summary: true },
      tool('t1', 'Leer index.tsx'),
      { id: 'img', kind: 'tool', name: 'imageGeneration', title: 'Imagen', status: 'done' },
    ];
    expect(thinkingEntries(items)).toEqual([
      { key: 'r2:0', verb: null, text: 'Voy a revisar el proyecto.' },
      { key: 'r2:1', verb: null, text: 'Después edito la escena.' },
      { key: 't1', verb: 'Leyó', text: 'Leer index.tsx' },
    ]);
  });

  it('uses the present tense while a tool runs and says when it failed', () => {
    expect(toolVerb(tool('a', 'Buscar en la web', 'running') as Extract<Item, { kind: 'tool' }>)).toBe('Buscando');
    expect(toolVerb(tool('b', 'Editar escena', 'failed') as Extract<Item, { kind: 'tool' }>)).toBe('Falló');
  });

  it('measures from the first start to the last end, at least one second', () => {
    expect(thinkingSeconds([tool('a', 'x', 'done', { createdAt: 1000, completedAt: 4000 }), tool('b', 'y', 'done', { createdAt: 2000, completedAt: 9000 })], 0)).toBe(8);
    expect(thinkingSeconds([tool('a', 'x')], 0)).toBe(1);
  });

  it('anchors each finished turn before its first visible answer, not the live one', () => {
    const items: Item[] = [
      { id: 'u1', kind: 'user', text: 'hola' }, tool('t1', 'Leer'), { id: 'a1', kind: 'assistant', text: 'listo', phase: 'final' },
      { id: 'u2', kind: 'user', text: 'otra' }, tool('t2', 'Leer', 'running'),
    ];
    const traces = turnTraces(items, new Set(['u1', 'a1', 'u2']), true);
    expect([...traces.keys()]).toEqual(['a1']);
    expect(traces.get('a1')?.map(item => item.id)).toEqual(['t1']);
  });
});

describe('tool subjects', () => {
  it('says what a tool worked on instead of its internal name', async () => {
    const { toolSubject } = await import('./thinking-entries');
    const t = (name: string, title: string, detail?: string) => ({ id: 'x', kind: 'tool', name, title, status: 'done', ...(detail ? { detail } : {}) }) as Extract<Item, { kind: 'tool' }>;
    expect(toolSubject(t('syka_resources', 'syka_resources'))).toBe('los recursos del proyecto');
    expect(toolSubject(t('mcp__syka__syka_read_reference', 'mcp__syka__syka_read_reference'))).toBe('una referencia');
    expect(toolSubject(t('Read', 'Read', 'E:/proyecto/index.tsx'))).toBe('E:/proyecto/index.tsx');
    expect(toolSubject(t('Bash', 'Revisar el render'))).toBe('Revisar el render');
    expect(toolSubject(t('mcp__syka__syka_resources', 'syka_resources', '{"action":"list"}'))).toBe('los recursos del proyecto');
  });
});
