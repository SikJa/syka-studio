import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ selection: [] as any[], nodes: [] as any[], select: vi.fn() }));
vi.mock('@diffusionstudio/runtime', () => ({ AdjustmentLayer: 'adjustment', Geometry: 'geometry', Group: 'group', Selected: 'selected' }));
vi.mock('koota', () => ({ Or: () => 'nodes' }));
vi.mock('../../web/src/engine/editor', () => ({ getDocumentEditor: () => ({ select: state.select }) }));
vi.mock('@/utils', () => ({ assert: (value: unknown, message: string) => { if (!value) throw Error(message); } }));
import { createPointer } from '../../web/src/engine/timeline/pointer';
import { contextClip, selectContextClip } from '../../web/src/engine/timeline/context-target';

const entity = (id: number) => ({ id: () => id, isAlive: () => true });
const world = { query: (kind: string) => kind === 'selected' ? state.selection : state.nodes } as any;
beforeEach(() => {
  state.selection = []; state.nodes = []; state.select.mockReset();
  vi.stubGlobal('window', { devicePixelRatio: 2 });
  vi.stubGlobal('DOMPoint', class { constructor(public x: number, public y: number) {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('timeline clip context target', () => {
  it('hits the actually drawn clip with device scaling and scrolling before any left click', () => {
    const pointer = createPointer({
      canvas: { getBoundingClientRect: () => ({ left: 100, top: 200 }) } as any,
      ctx: { getTransform: () => ({ transformPoint: ({ x, y }: { x: number; y: number }) => ({ x: x * 2 + 40, y: y * 2 + 72 }) }) } as any,
    });
    pointer.scope('42').region(10, 5, 80, 40);
    pointer.reset();
    const target = entity(42); state.nodes = [target];
    expect(contextClip(world, pointer.hitAt(150, 250))).toBe(target);
    expect(pointer.position).toBeNull(); // Context targeting does not seek or generate a left click.
    expect(pointer.hitAt(400, 250)).toBeNull();
  });
  it('uses the frontmost region, excluding ruler and keyframe scopes as clip targets', () => {
    const pointer = createPointer({ canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } as any,
      ctx: { getTransform: () => ({ transformPoint: ({ x, y }: { x: number; y: number }) => ({ x, y }) }) } as any });
    pointer.scope('42').region(0, 0, 100, 100);
    pointer.scope('ruler').region(0, 0, 100, 36);
    pointer.reset();
    state.nodes = [entity(42)];
    expect(pointer.hitAt(10, 10)).toBe('ruler/0');
    expect(contextClip(world, pointer.hitAt(10, 10))).toBeUndefined();
    expect(contextClip(world, '999/0')).toBeUndefined();
  });
  it('targets an unselected clip instead of operating on the previous selection', () => {
    const previous = entity(1); const clicked = entity(2); state.nodes = [previous, clicked]; state.selection = [previous];
    expect(selectContextClip(world, contextClip(world, '2/1'))).toEqual([clicked]);
    expect(state.select).toHaveBeenCalledWith(clicked);
  });
  it('preserves multi-selection when right-clicking a selected member; empty space targets nothing', () => {
    const first = entity(1); const second = entity(2); state.selection = [first, second];
    expect(selectContextClip(world, second as any)).toEqual([first, second]);
    expect(state.select).not.toHaveBeenCalled();
    expect(selectContextClip(world, undefined)).toEqual([]);
    expect(state.select).not.toHaveBeenCalled();
  });
});
