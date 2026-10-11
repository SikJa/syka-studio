import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ waveform: vi.fn(), frames: vi.fn(), computed: { start: [0], end: [90], origin: [0], playbackRate: [1] } }));
vi.mock('@diffusionstudio/runtime', () => ({
  Computed: 'computed', Muted: 'muted', store: () => state.computed,
  getSourceWindow: () => ({ in: 0, out: 90 }),
}));
vi.mock('../../web/src/engine/timeline/media', () => ({ pickFrame: () => null, requestFrames: state.frames, resolveStill: () => null }));
vi.mock('../../web/src/engine/timeline/view', () => ({ framesToPixels: (n: number) => n, pixelsToFrames: (n: number) => n,
  getResolution: () => 1, getFrameRate: () => 30, getViewport: () => [0, 640] }));
vi.mock('../../web/src/engine/timeline/render/waveform', () => ({ renderWaveform: state.waveform }));
import { videoLayout, renderVideoThumbnails } from '../../web/src/engine/timeline/render/thumbnails';

describe('muted video thumbnail strip', () => {
  it('shows pictures at the default 40px height once sound has been separated', () => {
    expect(videoLayout(40, false).stripHeight).toBe(20);
    expect(videoLayout(40, true).stripHeight).toBe(20);
    expect(videoLayout(80, true).stripHeight).toBe(30);
    for (const height of [40, 64, 116]) {
      const layout = videoLayout(height, false);
      expect(layout.tile.height).toBeGreaterThanOrEqual(layout.stripHeight);
    }
  });
  it('requests video frames without drawing its detached waveform', () => {
    vi.clearAllMocks();
    const ctx = new Proxy({}, { get: () => vi.fn() });
    renderVideoThumbnails({} as any, {} as any, { ctx, layout: { width: 640 } } as any,
      { id: () => 0, has: (trait: string) => trait === 'muted' } as any, { type: 'VIDEO', channels: 2 } as any,
      { height: 40 } as any, '#fff');
    expect(state.frames).toHaveBeenCalledOnce(); expect(state.waveform).not.toHaveBeenCalled();
  });
});
