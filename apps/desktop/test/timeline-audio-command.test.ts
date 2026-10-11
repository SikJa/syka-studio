import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ selected: [] as any[], inserted: [] as any[], commands: 0, fail: false }));
vi.mock('@diffusionstudio/runtime', () => ({
  Selected: 'selected', Sequential: 'sequence', Source: 'source', Computed: 'computed', FrameRate: 'fps', Muted: 'muted', Hidden: 'hidden',
  framesToSeconds: (frame: number, fps: number) => frame / fps,
  getSourceWindow: (entity: any) => ({ in: entity.sourceIn, out: entity.sourceIn + Math.round((entity.computed.end - entity.computed.start) * entity.computed.playbackRate) }),
  findGeometryAsset: (_world: unknown, entity: any) => entity.asset,
  getEntityChildren: (_world: unknown, parent: any) => parent.children,
  getParentEntity: (entity: any) => entity.parent,
}));
vi.mock('@diffusionstudio/reconciler', () => ({ authoredTree: (_world: unknown, entity: any) => entity.tree, renderAuthored: (tree: any) => tree }));
vi.mock('../../web/src/engine/history', () => ({ getEditHistory: () => ({ command: (run: () => any) => { state.commands++; return run(); } }) }));
vi.mock('../../web/src/engine/editor', () => ({ getDocumentEditor: () => ({
  insertElement: (parent: any, render: () => any, anchor: any) => {
    if (state.fail) return [];
    const audio = { parent, tree: render(), anchor };
    parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, audio);
    state.inserted.push(audio); return [audio];
  },
  editProperty: (entity: any, key: string, value: unknown) => { entity.tree.props[key] = value; }, select: () => {},
}) }));
import { detachAudio } from '../../web/src/engine/audio-detach';

beforeEach(() => { state.selected = []; state.inserted = []; state.commands = 0; state.fail = false; });
function fixture() {
  const scene = { children: [] as any[], has: () => false, get: (kind: string) => kind === 'source' ? { value: 'scene' } : { origin: 150 } };
  const sequence = { parent: scene, children: [] as any[], has: (kind: string) => kind === 'sequence', get: () => ({ volume: 0 }) };
  const clip = { parent: sequence, sourceIn: 90, computed: { start: 210, end: 270, playbackRate: 1.5 }, get: (_kind: string): any => clip.computed,
    asset: { type: 'VIDEO', channels: 2 }, tree: { tag: 'video', props: { src: 'video.mp4', start: 2, end: 4, sourceIn: 3, sourceOut: 6, playbackRate: 1.5 } as Record<string, unknown>, children: [] } };
  scene.children.push(sequence); sequence.children.push(clip); state.selected = [clip];
  return { scene, sequence, clip, world: { query: () => state.selected, get: () => ({ value: 30 }) } as any };
}
describe('detach audio command', () => {
  it('places aligned audio beside the sequence and mutes the original in one command', () => {
    const { scene, sequence, clip, world } = fixture(); detachAudio(world);
    expect(state.commands).toBe(1); expect(state.inserted[0].parent).toBe(scene);
    expect(state.inserted[0].tree.props).toMatchObject({ src: 'video.mp4', start: 2, end: 4, sourceIn: 3, sourceOut: 6, playbackRate: 1.5 });
    expect(clip.tree.props.muted).toBe(true);
    expect(clip.tree.props.hidden).toBeUndefined();
    expect(state.inserted[0].anchor).toBe(sequence);
    expect([...scene.children].reverse()).toEqual([sequence, state.inserted[0]]);
  });
  it('never mutes the video if the audio could not be inserted', () => {
    const { clip, world } = fixture(); state.fail = true;
    expect(() => detachAudio(world)).toThrow(/No se pudo crear/);
    expect(clip.tree.props.muted).toBeUndefined();
  });
  it('preserves resolved offset of a later sequence clip even without an authored start', () => {
    const { clip, sequence, world } = fixture();
    sequence.children.unshift({ tree: { tag: 'video', props: { end: 2 } } });
    delete clip.tree.props.start;
    detachAudio(world);
    expect(state.inserted[0].tree.props).toMatchObject({ start: 2, end: 4, sourceIn: 3, sourceOut: 6, playbackRate: 1.5 });
  });
  it('reads Rect + VideoPaint timing from its geometry owner', () => {
    const { clip, world } = fixture();
    clip.tree.tag = 'rect';
    clip.tree.children = [{ tag: 'videoPaint', props: { src: 'video.mp4' }, children: [] }] as any;
    delete clip.tree.props.src;
    detachAudio(world);
    expect(state.inserted[0].tree.props).toMatchObject({ src: 'video.mp4', start: 2, end: 4, sourceIn: 3, sourceOut: 6, playbackRate: 1.5 });
  });
  it('places direct video audio immediately below its original, leaving other layers in order', () => {
    const { scene, clip, world } = fixture();
    const lower = { name: 'lower' }, upper = { name: 'upper' };
    clip.parent = scene as any;
    scene.children = [lower, clip, upper];
    detachAudio(world);
    expect([...scene.children].reverse()).toEqual([upper, clip, state.inserted[0], lower]);
    expect(clip.tree.props.hidden).toBeUndefined();
    expect(clip.tree.tag).toBe('video');
    expect(state.inserted[0].tree.tag).toBe('audio');
  });
});
