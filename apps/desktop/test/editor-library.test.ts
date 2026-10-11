import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  flowInstructions,
  skillSlug,
} from '../../web/src/components/sidebar-right/library-model';
const state = vi.hoisted(() => ({
  commands: 0,
  edits: [] as unknown[],
  inserts: 0,
  failInsert: false,
}));
vi.mock('@diffusionstudio/runtime', () => ({
  getParentEntity: (e: any) => e.parent,
  isSequence: (e: any) => e.kind === 'sequence',
  isShape: (e: any) => e.kind === 'shape',
  isText: (e: any) => e.kind === 'text',
  isCaption: (e: any) => e.kind === 'caption',
  isGroup: (e: any) => e.kind === 'group',
  isScene: (e: any) => e.kind === 'scene',
  isClipPath: (e: any) => e.kind === 'clip-path',
  getActiveEntity: () => undefined,
  Computed: 'computed',
  Size: 'size',
  store: () => ({}),
}));
vi.mock('@diffusionstudio/reconciler', () => ({
  // These tests exercise effect/animation transactions, not caption rendering.
  CAPTION_PRESETS: new Proxy({}, { get: (_target, name) => name }),
  EFFECT_TYPES: {},
  ANIMATION_TYPES: {},
  TRANSITION_TYPES: {},
  Text: () => {},
  SolidPaint: () => {},
  Animation: () => {},
  Effect: () => {},
  Shadow: () => {},
  Stroke: () => {},
}));
vi.mock('../../web/src/engine/history', () => ({
  getEditHistory: () => ({
    command: (run: () => void) => {
      state.commands++;
      return run();
    },
  }),
}));
vi.mock('../../web/src/engine/editor', () => ({
  getDocumentEditor: () => ({
    editProperty: (target: any, key: string, value: unknown) =>
      state.edits.push({ target, key, value }),
    insertElement: () => {
      state.inserts++;
      return state.failInsert ? [] : [{}];
    },
    select: () => {},
  }),
}));
import {
  EDITOR_RESOURCES,
  resourceDisabledReason,
  applyEditorResource,
} from '../../web/src/components/sidebar-right/resources';
const entity = (kind: string, parent?: unknown) =>
  ({ kind, parent, isAlive: () => true }) as any;
const preset = (id: string) => EDITOR_RESOURCES.find((r) => r.id === id)!;
beforeEach(() => {
  state.commands = 0;
  state.edits = [];
  state.inserts = 0;
  state.failInsert = false;
});
describe('editor library operations', () => {
  it('requires a sequence clip for transitions and preserves its incoming cut', () => {
    const r = preset('transition-dissolve');
    expect(resourceDisabledReason(r, entity('text'))).toBeTruthy();
    expect(
      resourceDisabledReason(r, entity('shape', entity('scene'))),
    ).toBeTruthy();
    const target = entity('shape', entity('sequence'));
    applyEditorResource({} as any, r, target);
    expect(state.commands).toBe(1);
    expect(state.edits).toEqual([
      { target, key: 'transition', value: { type: 'dissolve', duration: 0.5 } },
    ]);
  });
  it('rejects an incompatible multi-selection before changing any element', () => {
    expect(() =>
      applyEditorResource({} as any, preset('effect-blur'), [
        entity('text'),
        entity('audio'),
      ]),
    ).toThrow(/visual/);
    expect(state.commands).toBe(0);
    expect(state.inserts).toBe(0);
  });
  it('groups a multi-selection preset application into one undo command', () => {
    applyEditorResource({} as any, preset('effect-blur'), [
      entity('text'),
      entity('shape'),
    ]);
    expect(state.commands).toBe(1);
    expect(state.inserts).toBe(2);
  });
  it('keeps glyph animations on text and allows general animation on clip paths', () => {
    expect(
      resourceDisabledReason(preset('animation-appearWord'), entity('shape')),
    ).toBeTruthy();
    expect(
      resourceDisabledReason(preset('animation-appearWord'), entity('caption')),
    ).toBeUndefined();
    expect(
      resourceDisabledReason(preset('animation-fade'), entity('clip-path')),
    ).toBeUndefined();
  });
  it('refuses an empty drop target rather than applying to another selection', () => {
    expect(() =>
      applyEditorResource({} as any, preset('effect-blur'), undefined),
    ).toThrow(/Seleccion/);
    expect(state.inserts).toBe(0);
  });
});
describe('library insertion failures', () => {
  it('reports a failed insertion and refuses an empty selection', () => {
    state.failInsert = true;
    expect(() =>
      applyEditorResource({} as any, preset('effect-blur'), entity('text')),
    ).toThrow(/insertar/);
    expect(() =>
      applyEditorResource({} as any, preset('effect-blur'), []),
    ).toThrow(/Seleccion/);
  });
});
describe('reusable editing flow', () => {
  it('serializes ordered steps, chosen preferences and the main composition scope', () => {
    const content = flowInstructions(
      'Subtítulos: mi estilo',
      ['  Transcribir.  ', '', 'Verificar tiempos.'],
      ['fontSize: 48'],
    );
    expect(skillSlug('Subtítulos: mi estilo')).toBe('subtitulos-mi-estilo');
    expect(content).toContain('1. Transcribir.\n2. Verificar tiempos.');
    expect(content).toContain('- fontSize: 48');
    expect(content).toContain('alcance indicado');
    expect(content).toContain('historial de deshacer');
    expect(content).toContain('No afirmes éxito sin verificarlo.');
  });
  it('does not create an unusable skill without a name or steps', () => {
    expect(() => flowInstructions('', ['Paso'], [])).toThrow();
    expect(() => flowInstructions('Flujo', ['  '], [])).toThrow();
  });
});
