import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { globalThis.DOMMatrix = class {} as typeof DOMMatrix; });
import { Computed, FrameRate, Geometry, Scene, Source, appendChild, createRuntimeWorld, createEntity } from '../index';
import { resolveMotionEvents } from './motion-events';

describe('shared native motion anchors', () => {
  it('reads updated trimmed clip boundaries at different native frame rates', () => {
    for (const fps of [24, 30, 60]) {
      const world = createRuntimeWorld('event-fixture'); world.set(FrameRate, { value: fps });
      const target = createEntity(world); target.add(Geometry, Source); target.set(Source, { value: 'index.tsx:title' });
      target.set(Computed, { start: 2 * fps, end: 8 * fps });
      const anchors = [{ id: 'title-impact', element: 'title', edge: 'start' as const, offsetSeconds: .1 }];
      expect(resolveMotionEvents(world, anchors)[0]).toMatchObject({ status: 'resolved', seconds: 2.1 });
      target.set(Computed, { start: 3 * fps });
      expect(resolveMotionEvents(world, anchors)[0]?.seconds).toBe(3.1);
      world.destroy();
    }
  });
  it('restricts anchors to their scene and refuses DOM children or missing/ambiguous stamps', () => {
    const world = createRuntimeWorld('scoped-events'), scene = createEntity(world), otherScene = createEntity(world);
    scene.add(Scene, Geometry); otherScene.add(Scene, Geometry);
    const node = (stamp: string, parent: typeof scene, native = true) => {
      const target = createEntity(world); target.add(Source); if (native) target.add(Geometry);
      target.set(Source, { value: stamp }); appendChild(world, target, parent); target.set(Computed, { start: 30, end: 60 }); return target;
    };
    node('one.tsx:label', scene); node('two.tsx:label', otherScene); node('one.tsx:inner', scene, false);
    const event = { id: 'label', element: 'label', edge: 'end' as const };
    expect(resolveMotionEvents(world, [event])[0]?.status).toBe('unresolved');
    expect(resolveMotionEvents(world, [event], scene)[0]).toMatchObject({ status: 'resolved', seconds: 2 });
    expect(resolveMotionEvents(world, [{ ...event, element: 'inner' }], scene)[0]?.seconds).toBeNull();
    expect(resolveMotionEvents(world, [{ ...event, element: 'missing' }], scene)[0]?.seconds).toBeNull();
    expect(() => resolveMotionEvents(world, [event, event], scene)).toThrow('duplicate');
    world.destroy();
  });
});
