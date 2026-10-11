import { describe, expect, it } from 'vitest';
import { notificationShape } from './notification-shape';

const contains = (rects: ReturnType<typeof notificationShape>, x: number, y: number) => rects.some(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
describe('native notification input region', () => {
  it('keeps the bubble and orb interactive while the desktop above and below the orb is excluded', () => {
    const rects = notificationShape([{ x: 60, y: 270, width: 240, height: 170, radius: 14 }, { x: 304, y: 377, width: 61, height: 61, radius: 0 }], 370, 460);
    expect(contains(rects, 170, 300)).toBe(true);
    expect(contains(rects, 335, 400)).toBe(true);
    expect(contains(rects, 335, 300)).toBe(false);
    expect(contains(rects, 170, 120)).toBe(false);
    expect(contains(rects, 60, 270)).toBe(false);
  });
  it('clips regions to the viewport and preserves integer pixel boundaries at scaled sizes', () => {
    const rects = notificationShape([{ x: -5.4, y: 438.2, width: 244.5, height: 80, radius: 14 }], 370, 460);
    expect(rects.length).toBeGreaterThan(0);
    for (const r of rects) {
      expect([r.x, r.y, r.width, r.height].every(Number.isInteger)).toBe(true);
      expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(370); expect(r.y + r.height).toBeLessThanOrEqual(460);
    }
  });
  it('does not turn an empty notification list into a desktop-sized input region', () => {
    expect(notificationShape([], 370, 460)).toEqual([]);
    expect(() => notificationShape([{ x: NaN, y: 0, width: 1, height: 1, radius: 0 }], 370, 460)).toThrow();
    expect(() => notificationShape(Array(302).fill({x:0,y:0,width:1,height:1,radius:0}), 370,460)).toThrow();
  });
});
