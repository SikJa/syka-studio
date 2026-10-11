import { describe, expect, it, vi } from 'vitest';
vi.mock('electron', () => ({ app: {}, protocol: {} }));
import { captureByteRange, physicalCaptureRegion } from './screen-capture';

describe('physical screen region', () => {
  const bounds = { x: -1920, y: -300, width: 1920, height: 1080 };
  it('keeps physical monitor coordinates, including negative origins', () => {
    expect(physicalCaptureRegion(bounds)).toEqual(bounds);
    expect(physicalCaptureRegion(bounds, { x: .25, y: .5, width: .5, height: .25 })).toEqual({ x: -1440, y: 240, width: 960, height: 270 });
  });
  it('rejects out-of-bounds, nonfinite and tiny crops', () => {
    for (const crop of [{ x: -.1, y: 0, width: .5, height: .5 }, { x: .9, y: 0, width: .5, height: .5 }, { x: NaN, y: 0, width: .5, height: .5 }, { x: 0, y: 0, width: .001, height: .5 }]) expect(() => physicalCaptureRegion(bounds, crop)).toThrow();
  });
});
describe('streamed MP4 ranges', () => {
  it('supports full, bounded, open-ended and suffix ranges', () => {
    expect(captureByteRange(null, 100)).toEqual({ start: 0, end: 99 });
    expect(captureByteRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(captureByteRange('bytes=80-', 100)).toEqual({ start: 80, end: 99 });
    expect(captureByteRange('bytes=-20', 100)).toEqual({ start: 80, end: 99 });
    expect(captureByteRange('bytes=80-150', 100)).toEqual({ start: 80, end: 99 });
  });
  it('rejects unsatisfiable, reversed and multipart ranges', () => {
    for (const range of ['bytes=100-', 'bytes=20-10', 'bytes=0-1,4-5', 'bytes=-', 'bytes=-0', 'bytes=9007199254740992-']) expect(captureByteRange(range, 100)).toBeNull();
  });
});
