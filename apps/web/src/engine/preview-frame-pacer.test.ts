import { describe, expect, it } from 'vitest';
import { PreviewFramePacer } from './preview-frame-pacer';

describe('preview scheduling', () => {
  it('runs about 20 paused ticks instead of 60 per second', () => {
    const pacer = new PreviewFramePacer();
    const frames = Array.from({ length: 60 }, (_, n) => n * 1000 / 60).filter(t => pacer.shouldTick(t, false));
    expect(frames).toHaveLength(20);
  });
  it('preserves every frame for playback, offline mode or active tickers', () => {
    const pacer = new PreviewFramePacer();
    for (let n = 0; n < 144; n++) expect(pacer.shouldTick(n * 1000 / 144, true)).toBe(true);
  });
  it('wakes immediately on input and returns to idle after interactions settle', () => {
    const pacer = new PreviewFramePacer();
    expect(pacer.shouldTick(0, false)).toBe(true);
    expect(pacer.shouldTick(16, false)).toBe(false);
    pacer.wake(17);
    expect(pacer.shouldTick(18, false)).toBe(true);
    expect(pacer.shouldTick(32, false)).toBe(true);
    expect(pacer.shouldTick(832, false)).toBe(true);
    expect(pacer.shouldTick(848, false)).toBe(false);
  });
  it('does not carry scheduling history into a restarted engine', () => {
    const pacer = new PreviewFramePacer();
    pacer.shouldTick(4000, false); pacer.reset();
    expect(pacer.shouldTick(0, false)).toBe(true);
  });
});
