import { describe, expect, it, vi } from 'vitest';

vi.mock('@diffusionstudio/runtime', () => ({
  Computed: 'computed', FrameRate: 'fps', Host: 'host',
  framesToSeconds: (frames: number, fps: number) => frames / fps,
  secondsToFrames: (seconds: number, fps: number) => Math.round(seconds * fps),
  getTimelineOrigin: (entity: any) => entity.parentOrigin,
  getSourceFrameAt: (entity: any, frame: number) => Math.round((frame - entity.computed.origin) * entity.computed.playbackRate),
  setPlayhead: () => {}, store: () => {},
}));
vi.mock('../../web/src/engine/editor', () => ({ getDocumentEditor: () => ({ editProperty: (entity: any, key: string, value: unknown) => { entity.props[key] = value; } }) }));
import { trimIn, trimOut } from '../../web/src/engine/timing';

describe('split source continuity', () => {
  it('preserves both sides of a trimmed 1.5x video under a parent offset', () => {
    const world = { get: () => ({ value: 30 }) } as any;
    const make = () => {
      const entity = { props: { start: 2, end: 6, sourceIn: 3, sourceOut: 9, playbackRate: 1.5 } as Record<string, unknown>, parentOrigin: 150,
        computed: { origin: 150, end: 330, playbackRate: 1.5 }, get: (trait: string): any => trait === 'host' ? { props: entity.props } : entity.computed };
      return entity;
    };
    // Scene frame 210 starts at source frame 90; splitting at 270 reaches source frame 180.
    const left = make(); const right = make();
    trimOut(world, left as any, 270); trimIn(world, right as any, 270);
    expect(left.props).toMatchObject({ start: 2, end: 4, sourceIn: 3, sourceOut: 6 });
    expect(right.props).toMatchObject({ start: 4, end: 6, sourceIn: 6, sourceOut: 9, playbackRate: 1.5 });
    expect(left.props.sourceOut).toBe(right.props.sourceIn);
    expect(left.props.end).toBe(right.props.start);
  });
});
