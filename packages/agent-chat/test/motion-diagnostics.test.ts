import { describe, expect, it } from 'vitest';
import { inspectMotionFrames } from '../src/host/motion-diagnostics';
const frames = (values: number[], times?: number[]) => ({
  raw: Buffer.concat(values.map(value => Buffer.alloc(32 * 18, value))),
  stamps: values.map((_, index) => ({ index, seconds: times?.[index] ?? index / 30 })),
});
describe('temporal export diagnostics', () => {
  it('locates a single-frame flash and preserves the declared-cut context', () => {
    const f = frames([0, 0, 255, 0, 0]);
    const result = inspectMotionFrames(f.raw, f.stamps, false, [2 / 30]);
    expect(result.flashCandidates).toEqual([{ frame: 2, seconds: 2 / 30, change: 255, returnDifference: 0, nearDeclaredCut: true }]);
    expect(result.strongestChange.frame).toBe(2);
    expect(result.loopSeam).toBeNull();
  });
  it('does not call a persistent hard cut a one-frame flash', () => {
    const f = frames([0, 0, 255, 255, 255]);
    expect(inspectMotionFrames(f.raw, f.stamps).flashCandidates).toEqual([]);
  });
  it('screens both loop position and velocity, including uneven VFR intervals', () => {
    const continuous = frames([10, 20, 30, 0], [0, .1, .2, .3]);
    expect(inspectMotionFrames(continuous.raw, continuous.stamps, true).loopSeam?.needsInspection).toBe(true);
    const steady = frames([25, 25, 25], [0, .1, .4]);
    expect(inspectMotionFrames(steady.raw, steady.stamps, true).loopSeam).toMatchObject({ difference: 0, velocityDifference: 0, needsInspection: false });
    const vfr = frames([10, 20, 20, 10], [0, .1, .2, .4]);
    expect(inspectMotionFrames(vfr.raw, vfr.stamps, true).loopSeam?.velocityDifference).toBe(15);
  });
  it('refuses incomplete decoding instead of interpreting missing pixels as black', () => {
    const f = frames([0, 0, 0]);
    expect(() => inspectMotionFrames(f.raw.subarray(1), f.stamps)).toThrow('timestamps');
  });
});
