import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '@/i18n';
import { EDITOR_TOUR_KEY, EDITOR_TOUR_STEPS, EDITOR_TOUR_VERSION, placeTourCard, readTourProgress, resolveEditorTourTarget, saveTourProgress } from './editor-tour-model';
describe('editor tour progress and positioning', () => {
  it('remembers dismiss/completion, without overwriting other storage', () => {
    const data = new Map([['chat-draft', 'Conservá este pedido']]);
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    expect(readTourProgress(storage).status).toBe('new');
    saveTourProgress(storage, 'dismissed', 3);
    expect(readTourProgress(storage)).toMatchObject({ status: 'dismissed', step: 3 });
    saveTourProgress(storage, 'completed', 10);
    expect(readTourProgress(storage)).toMatchObject({ version: EDITOR_TOUR_VERSION, status: 'completed' });
    saveTourProgress(storage, 'dismissed', 1);
    expect(readTourProgress(storage).status).toBe('completed');
    expect(data.get('chat-draft')).toBe('Conservá este pedido');
    data.set(EDITOR_TOUR_KEY, JSON.stringify({ version: EDITOR_TOUR_VERSION - 1, status: 'completed', step: 1 }));
    expect(readTourProgress(storage).status).toBe('new');
  });
  it('survives unavailable or invalid storage', () => {
    expect(readTourProgress({ getItem: () => '{broken' }).status).toBe('new');
    const unavailable = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } };
    expect(readTourProgress(unavailable).status).toBe('new');
    expect(() => saveTourProgress(unavailable, 'dismissed', 1)).not.toThrow();
  });
  it('keeps cards on screen and out of the highlighted control when there is room', () => {
    for (const viewport of [{ width: 1200, height: 720 }, { width: 940, height: 700 }]) {
      for (const target of [{ x: 12, y: 12, width: 40, height: 28 }, { x: viewport.width - 35, y: viewport.height - 38, width: 24, height: 26 }]) {
        const card = { width: 312, height: 252 }, position = placeTourCard(target, viewport, card);
        expect(position.x).toBeGreaterThanOrEqual(12); expect(position.y).toBeGreaterThanOrEqual(44);
        expect(position.x + card.width).toBeLessThanOrEqual(viewport.width - 12); expect(position.y + card.height).toBeLessThanOrEqual(viewport.height - 12);
        const overlapX = Math.min(position.x + card.width, target.x + target.width) - Math.max(position.x, target.x);
        const overlapY = Math.min(position.y + card.height, target.y + target.height) - Math.max(position.y, target.y);
        expect(overlapX <= 0 || overlapY <= 0).toBe(true);
      }
    }
  });
});

type TargetElement = {
  id: string; tag: string; label: string; attrs: Record<string, string>;
  visible: boolean; clone: boolean; priority: number; inSidebar: boolean;
  getAttribute(name: string): string | null;
};
function target(id: string, binding: string, label = '', tag = 'button', inSidebar = false): TargetElement {
  return {
    id, tag, label, attrs: { 'data-tour-target': binding }, visible: true, clone: false, priority: 0, inSidebar,
    getAttribute(name) { return name === 'aria-label' ? t(this.label) : this.attrs[name] ?? null; },
  };
}
function queryElements(elements: TargetElement[], selector: string): TargetElement[] {
  const sidebarPrefix = '[data-right-sidebar] ';
  const inSidebar = selector.startsWith(sidebarPrefix);
  const own = inSidebar ? selector.slice(sidebarPrefix.length) : selector;
  return elements.filter(element => {
    if (inSidebar && !element.inSidebar) return false;
    if (own.startsWith('.')) return element.attrs.class?.split(' ').includes(own.slice(1)) ?? false;
    if (own.startsWith('#')) return element.attrs.id === own.slice(1);
    const tag = own.match(/^([a-z]+)/)?.[1];
    if (tag && tag !== element.tag) return false;
    const attributes = [...own.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];
    return attributes.length > 0 && attributes.every(([, name, value]) => value === undefined
      ? element.getAttribute(name) !== null : element.getAttribute(name) === value);
  });
}
function tourElements(): TargetElement[] {
  const preview = target('preview', 'unused-preview', '', 'div');
  preview.attrs.class = 'syka-preview-surface';
  const timeline = target('timeline', 'unused-timeline', '', 'canvas');
  timeline.attrs.id = 'timeline-canvas';
  const sidebar = target('right-sidebar', 'unused-sidebar', '', 'aside');
  sidebar.attrs['data-right-sidebar'] = '';
  return [
    target('project', 'project-menu', 'Menú del proyecto'),
    target('chat', 'chat-message', 'Mensaje al editor', 'textarea'),
    target('chat-fallback', 'left-tab-chat', 'Chat'),
    target('model', 'model-picker', 'Elegir modelo y esfuerzo'),
    target('voice', 'dictation', 'Iniciar voz'),
    target('assets', 'left-tab-assets', 'Assets'), preview,
    target('point', 'visual-select', 'Señalar componente editable'),
    target('capture', 'visual-capture', 'Capturar zona para el agente'), timeline,
    target('library', 'right-tab-library', 'Biblioteca', 'button', true),
    target('properties', 'right-tab-properties', 'Propiedades', 'button', true),
    target('undo', 'undo', 'Deshacer'), target('export', 'export', 'Exportar video'), sidebar,
  ];
}
const isVisible = (element: TargetElement) => element.visible && !element.clone;

describe('editor tour targets across interface languages', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { documentElement: { lang: 'es' } });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
  });
  afterEach(() => { setLocale('es'); vi.unstubAllGlobals(); });

  it.each(['es', 'en', 'pt-BR'] as const)('resolves every step with the actual %s UI translations', locale => {
    setLocale(locale);
    const elements = tourElements();
    const query = (selector: string) => queryElements(elements, selector);
    if (locale !== 'es') expect(query('[aria-label="Menú del proyecto"]')).toHaveLength(0);
    for (const step of EDITOR_TOUR_STEPS) {
      expect(resolveEditorTourTarget(step, query, isVisible)?.id, step.id).toBe(step.id);
    }
  });

  it('prefers the focused visible composer and excludes transition clones and hidden panels', () => {
    const step = EDITOR_TOUR_STEPS.find(step => step.id === 'chat')!;
    const docked = target('docked', 'chat-message');
    const focused = { ...target('focused', 'chat-message'), priority: 10 };
    const hidden = { ...target('hidden', 'chat-message'), visible: false, priority: 20 };
    const clone = { ...target('clone', 'chat-message'), clone: true, priority: 30 };
    const elements = [clone, hidden, docked, focused];
    expect(resolveEditorTourTarget(step, selector => queryElements(elements, selector), isVisible, element => element.priority)).toBe(focused);
  });

  it('uses stable tab/sidebar fallbacks when the main target is hidden and returns no target when both are absent', () => {
    setLocale('pt-BR');
    const elements = tourElements();
    elements.find(element => element.id === 'chat')!.visible = false;
    const chat = EDITOR_TOUR_STEPS.find(step => step.id === 'chat')!;
    expect(resolveEditorTourTarget(chat, selector => queryElements(elements, selector), isVisible)?.id).toBe('chat-fallback');
    for (const id of ['library', 'properties']) {
      elements.find(element => element.id === id)!.visible = false;
      const step = EDITOR_TOUR_STEPS.find(step => step.id === id)!;
      expect(resolveEditorTourTarget(step, selector => queryElements(elements, selector), isVisible)?.id).toBe('right-sidebar');
    }
    expect(resolveEditorTourTarget(chat, () => [], isVisible)).toBeUndefined();
  });

  it('binds the selector identifiers to actual controls while excluding the reference composer', () => {
    const bindings: [string, string[]][] = [
      ['../sidebar-left/project-menu/index.tsx', ['data-tour-target="project-menu"']],
      ['../../agent-chat/sidebar-tabs.tsx', ['data-tour-target={`left-tab-${tab.id}`}']],
      ['../../agent-chat/model-picker.tsx', ['data-tour-target="model-picker"']],
      ['../../agent-chat/composer.tsx', ['data-tour-target="chat-message"']],
      ['../../mirel-chat/features/agents/agent-composer.tsx', ["data-tour-target={variant === 'reference' ? undefined : 'chat-message'}", 'data-tour-target="model-picker"', 'data-tour-target="dictation"']],
      ['../canvas/toolbar.tsx', ['data-tour-target="visual-select"', 'data-tour-target="visual-capture"']],
      ['../sidebar-right/right-sidebar.tsx', ['data-tour-target={`right-tab-${item.id}`}']],
      ['../timeline/toolbar.tsx', ['data-tour-target={props.tourTarget}', 'tourTarget="undo"']],
      ['../sidebar-left/editor-export-button.tsx', ['data-tour-target="export"']],
    ];
    for (const [file, attributes] of bindings) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      for (const attribute of attributes) expect(source, file).toContain(attribute);
    }
  });
});
