import { describe, expect, it } from 'vitest';
import { createWorld } from 'koota';
import { Animation, Cache, Computed, Geometry, Offset, Opacity } from '../traits';
import { AnimationPhase, AnimationType } from '../constants';
import { motionSystem } from './motion';

function fixture(phase: AnimationPhase, type = AnimationType.SOFT_RISE) {
  const world = createWorld();
  const animation = world.spawn(Animation({ type, phase, duration: 13, delay: 0 }));
  const node = world.spawn(Geometry, Offset({ x: 9, y: 7 }), Opacity({ value: .6 }),
    Computed({ start: 0, end: 120, duration: 120, visibility: 1 }), Cache({ animations: [animation] }));
  const sample = (frame: number) => {
    node.set(Computed, { localTime: frame }); motionSystem(world);
    const value = node.get(Computed)!;
    return { opacity: value.opacity, x: value.offsetX, y: value.offsetY, scale: value.scaleX };
  };
  return { world, sample };
}

describe('native softRise source-time preset', () => {
  it('arrives monotonically, preserves authored offsets/opacity, and never rescales glyphs', () => {
    const { world, sample } = fixture(AnimationPhase.IN);
    expect(sample(0)).toEqual({ opacity: 0, x: 9, y: 39, scale: 1 });
    expect(sample(6)).toEqual({ opacity: .5625, x: 9, y: 9, scale: 1 });
    expect(sample(12)).toEqual({ opacity: .6, x: 9, y: 7, scale: 1 });
    expect(sample(40)).toEqual(sample(12)); world.destroy();
  });
  it('exits on its own accelerated curve in the upward direction', () => {
    const { world, sample } = fixture(AnimationPhase.OUT);
    expect(sample(106).opacity).toBe(.6);
    expect(sample(113)).toEqual({ opacity: .525, x: 9, y: 5, scale: 1 });
    expect(sample(119)).toEqual({ opacity: 0, x: 9, y: -9, scale: 1 }); world.destroy();
  });
  it('returns to identical state after nonsequential seeks and repeated renders', () => {
    const { world, sample } = fixture(AnimationPhase.IN); const before = sample(6);
    sample(119); sample(0); sample(30); expect(sample(6)).toEqual(before); expect(sample(6)).toEqual(before);
    world.destroy();
  });
  it('appends its enum ID without changing persisted IDs of earlier presets', () => {
    expect(AnimationType.FADE).toBe(0); expect(AnimationType.SCRAMBLE).toBe(13);
    expect(AnimationType.SOFT_RISE).toBe(14);
  });
});
