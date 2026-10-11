import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { globalThis.DOMMatrix = class {} as typeof DOMMatrix; });
import { Computed, FrameRate, Geometry, Scene, Source, Workarea, appendChild, createEntity, createRuntimeWorld, setActive } from '@diffusionstudio/runtime';
import { toolByName } from '@diffusionstudio/dapi';
import { motionEvents } from './motion-events';

describe('native motion event renderer tool', () => {
  it('returns scene-scoped native boundaries and the export workarea origin', async () => {
    const world = createRuntimeWorld('motion-tool-fixture'); world.set(FrameRate, { value: 24 });
    const scene = createEntity(world); scene.add(Scene, Geometry, Source, Workarea); scene.set(Source, { value: 'index.tsx:scene' }); scene.set(Workarea, { start: 48, end: 240 });
    const text = createEntity(world); text.add(Geometry, Source); text.set(Source, { value: 'index.tsx:title' }); appendChild(world, text, scene); text.set(Computed, { start: 72, end: 144 });
    setActive(world, scene);
    const ctx = { session: () => ({ world, project: { dir: () => 'isolated-project' } }) } as unknown as Parameters<typeof motionEvents>[1];
    try {
      const args = toolByName('motion_events').input.parse({ events: [{ id: 'title-out', element: 'title', edge: 'end' }] });
      const result = await motionEvents(args, ctx);
      expect(toolByName('motion_events').output.parse(result)).toMatchObject({ composition: 'index.tsx:scene', frameRate: 24, exportStartSeconds: 2, events: [{ id: 'title-out', seconds: 6 }] });
      text.set(Computed, { end: 168 });
      expect((await motionEvents(args, ctx)).events[0]?.seconds).toBe(7);
    } finally { world.destroy(); }
  });
});
