import { describe, it, expect, vi } from 'vitest';
import type { Entity, World } from 'koota';
const harness = vi.hoisted(() => ({ children: [] as unknown[], edits: [] as unknown[] }));
vi.mock('@diffusionstudio/reconciler', () => ({ authoredElement: (e: { authored: unknown }) => e.authored }));
vi.mock('@diffusionstudio/runtime', () => ({ Computed: 'computed', Source: 'source', getAsset: () => undefined, getEntityChildren: () => harness.children }));
vi.mock('../history', () => ({ getEditHistory: () => ({ command: (f: () => void) => f() }) }));
vi.mock('../editor', () => ({ getDocumentEditor: () => ({ editProperty: (e: { authored: { props: Record<string, unknown> } }, key: string, value: unknown) => { e.authored.props[key] = value; harness.edits.push([key, value]); } }) }));
import { adoptFirstMedia, sceneDecision } from './native';
import { FORMAT_PROP } from './model';
function fixture(mode = 'auto', hasDecision = true) {
  harness.children = []; harness.edits = [];
  const props: Record<string, unknown> = { width: 1920, height: 1080 };
  if (hasDecision) props[FORMAT_PROP] = JSON.stringify({ version: 1, mode, provenance: 'first-media', destination: 'none', revision: 0, awaitingFirstMedia: true, initialScene: { width: 1920, height: 1080 } });
  return { authored: { tag: 'scene', props }, get: () => undefined } as unknown as Entity;
}
const world = {} as World;
describe('first imported medium integration gate', () => {
  it('adopts real display metadata once and freezes mixed subsequent media', () => {
    const scene = fixture();
    expect(adoptFirstMedia(world, scene, { type: 'VIDEO', width: 1080, height: 1920, duration: 4, rotation: 90 })?.width).toBe(1080);
    expect(sceneDecision(scene)?.source).toMatchObject({ rotation: 90, width: 1080, height: 1920, duration: 4 });
    expect(adoptFirstMedia(world, scene, { type: 'IMAGE', width: 1920, height: 1080 })).toBeUndefined();
  });
  it('protects manual, legacy, occupied and dimension-overridden scenes', () => {
    for (const kind of ['manual', 'legacy', 'occupied', 'resized']) {
      const scene = fixture(kind === 'manual' ? 'manual' : 'auto', kind !== 'legacy');
      if (kind === 'occupied') harness.children = [{ authored: { tag: 'text', props: {} } }];
      if (kind === 'resized') (scene as unknown as { authored: { props: Record<string, unknown> } }).authored.props.width = 1000;
      expect(adoptFirstMedia(world, scene, { width: 1080, height: 1920 })).toBeUndefined();
      expect(harness.edits).toHaveLength(0);
    }
  });
  it('does not consume auto mode for audio or unavailable metadata', () => {
    const scene = fixture();
    expect(adoptFirstMedia(world, scene, { type: 'AUDIO', duration: 2 })).toBeUndefined();
    expect(adoptFirstMedia(world, scene, { width: 0, height: 0 })).toBeUndefined();
    expect(sceneDecision(scene)?.awaitingFirstMedia).toBe(true);
  });
});
