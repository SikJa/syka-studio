import { describe, expect, it } from 'vitest';
import { clampTimelineScroll, fitTimeline, zoomTimeline } from '../../web/src/engine/timeline/navigation';

describe('timeline navigation recovery', () => {
  it('keeps the frame under a noncentral cursor anchored, then reverses the zoom', () => {
    const before = { resolution: 2, scrollX: 400 }, anchor = 137;
    const next = zoomTimeline(2, 400, 1.8, anchor, 820, 1800);
    expect(next.scrollX + anchor / next.resolution).toBeCloseTo(400 + anchor / 2);
    const back = zoomTimeline(next.resolution, next.scrollX, 1 / 1.8, anchor, 820, 1800);
    expect(back.resolution).toBeCloseTo(before.resolution);
    expect(back.scrollX).toBeCloseTo(before.scrollX);
  });
  it('recovers the recorded far-away view and fits both ends of a scene', () => {
    const stale = zoomTimeline(33, 25335, 1.2, 230, 820, 1800);
    expect(stale.scrollX).toBeLessThan(1800);
    const fit = fitTimeline(1800, 820);
    expect(-fit.scrollX * fit.resolution).toBeCloseTo(8);
    expect((1800 - fit.scrollX) * fit.resolution).toBeCloseTo(812);
  });
  it('cannot zoom out to hours of emptiness or pan past the entire project', () => {
    let view = fitTimeline(480, 820);
    for (let i = 0; i < 100; i++) view = zoomTimeline(view.resolution, view.scrollX, 0.6, 620, 820, 480);
    expect(view.resolution).toBeCloseTo(fitTimeline(480, 820).resolution / 4);
    expect(clampTimelineScroll(999999, 2, 480, 820)).toBe(111);
    expect(clampTimelineScroll(-999999, 2, 480, 820)).toBe(-4);
  });
  it('handles empty, short, long and resized scenes without changing their duration', () => {
    for (const end of [0, 1, 300, 216000, NaN]) for (const width of [0, 320, 820, 1920]) {
      const view = fitTimeline(end, width);
      expect(Number.isFinite(view.resolution)).toBe(true);
      expect(view.resolution).toBeGreaterThan(0);
      expect(Number.isFinite(view.scrollX)).toBe(true);
    }
  });
});
