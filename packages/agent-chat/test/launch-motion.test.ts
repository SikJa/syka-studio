import { describe, it, expect } from 'vitest';
import { demoState, focusState, coverLight } from '../../../docs/skills/syka-product-launch/examples/launch-time';

describe('launch recipe clock', () => {
  it('has a composed first frame and a stable result, including a backwards seek', () => {
    expect(demoState(0)).toEqual({ before: 1, after: 0, progress: 0 });
    expect(demoState(2)).toEqual({ before: 0, after: 1, progress: 1 });
    const middle = demoState(1.4); demoState(9);
    expect(demoState(1.4)).toEqual(middle);
    expect(demoState(1.4).before + demoState(1.4).after).toBeCloseTo(1);
    expect(focusState(2).arrive).toBe(1);
    expect(focusState(2).pulse).toBeCloseTo(0);
  });
  it('uses a stable reduced-motion result and stops secondary motion', () => {
    expect(demoState(0, 1.2, true)).toEqual(demoState(8, 1.2, true));
    expect(focusState(0, .9, true)).toEqual({ arrive: 1, pulse: 0, cursorVisible: false });
    expect(coverLight(0, true, true)).toEqual(coverLight(7, true, true));
    expect(coverLight(1, false)).toEqual(coverLight(6, false));
    expect(coverLight(1)).not.toEqual(coverLight(6));
  });
});
