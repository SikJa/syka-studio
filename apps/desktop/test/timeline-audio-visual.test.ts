import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  computed: { start: [0], end: [90] },
  waveform: vi.fn(), video: vi.fn(), still: vi.fn(),
}));
vi.mock('@diffusionstudio/runtime', () => ({
  AssetId: 'asset', Caption: 'caption', CaptionType: {}, Chars: 'chars', ClipDragOrigin: 'drag', Computed: 'computed',
  Hidden: 'hidden', Name: 'name', Selected: 'selected', TrimDragOrigin: 'trim',
  secondsToFrames: (n: number) => n * 30, store: () => state.computed,
  findGeometryAsset: (_world: unknown, entity: any) => entity.asset,
  fitsChildren: () => true, getGeneratingColor: () => '', getSourceFailure: () => undefined, isGenerating: () => false,
  isAudio: (entity: any) => entity.kind === 'audio', isRect: () => true,
  isAdjustmentLayer: () => false, isCaption: () => false, isGroup: () => false, isClipPath: () => false,
  isScene: () => false, isSequence: () => false, isText: () => false,
  hasHtmlPaint: () => false, hasSurfacePaint: () => false,
}));
vi.mock('../../web/src/engine/editor', () => ({ getDocumentEditor: () => ({}) }));
vi.mock('../../web/src/engine/timeline/drag', () => ({ applyClipDrag: vi.fn(), applyTrim: vi.fn(), beginClipDrag: vi.fn(), beginTrim: vi.fn() }));
vi.mock('../../web/src/engine/timeline/view', () => ({ framesToPixels: (n: number) => n, getResolution: () => 1, getViewport: () => [0, 640] }));
vi.mock('../../web/src/engine/timeline/text', () => ({ truncateText: (_ctx: unknown, label: string) => label }));
vi.mock('../../web/src/engine/timeline/render/group', () => ({ renderGroup: vi.fn() }));
vi.mock('../../web/src/engine/timeline/render/caption', () => ({ renderCaption: vi.fn() }));
vi.mock('../../web/src/engine/timeline/render/waveform', () => ({ renderWaveform: state.waveform }));
vi.mock('../../web/src/engine/timeline/render/thumbnails', () => ({ renderVideoThumbnails: state.video, renderStillThumbnails: state.still }));

import { COLORS } from '../../web/src/engine/timeline/constants';
import { getClipStyle, getClipFallbackName } from '../../web/src/engine/timeline/style';
import { renderClip } from '../../web/src/engine/timeline/render/clip';

const clip = (kind: string, type = 'VIDEO') => ({
  kind, asset: { type, channels: 2, sampleRate: 48000 }, id: () => 0,
  has: () => false, get: () => undefined,
}) as any;
function draw(entity: any) {
  const ctx = new Proxy({ fillText: vi.fn() } as any, { get: (object, key) => key in object ? object[key] : vi.fn() });
  const surface = { ctx, layout: { width: 640 }, colors: COLORS, pointer: { scope: vi.fn(), region: () => ({}) } } as any;
  renderClip({} as any, {} as any, surface, entity, { height: 80 } as any);
  return ctx;
}
beforeEach(() => vi.clearAllMocks());

describe('audio tracks sourced from a video container', () => {
  it('uses the same green style and audio label as an ordinary sound', () => {
    const audio = clip('audio');
    expect(getClipStyle(audio, audio.asset)).toEqual(COLORS.clip.audio);
    expect(getClipFallbackName({} as any, audio)).toBe('Audio');
    const sound = clip('audio', 'AUDIO');
    expect(getClipStyle(audio, audio.asset)).toEqual(getClipStyle(sound, sound.asset));
  });
  it('draws only its waveform, never video thumbnails, even on a tall row', () => {
    const audio = clip('audio'); const ctx = draw(audio);
    expect(state.waveform).toHaveBeenCalledOnce();
    expect(state.waveform.mock.calls[0][5]).toMatchObject({ asset: audio.asset, color: COLORS.clip.audio.primary });
    expect(state.video).not.toHaveBeenCalled(); expect(state.still).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('Audio', expect.any(Number), expect.any(Number));
  });
  it('keeps the original video blue with video content', () => {
    const video = clip('video');
    expect(getClipStyle(video, video.asset)).toEqual(COLORS.clip.video);
    draw(video);
    expect(state.video).toHaveBeenCalledOnce(); expect(state.waveform).not.toHaveBeenCalled();
  });
  it('does not draw a filmstrip while an audio source is still resolving', () => {
    const audio = clip('audio'); audio.asset = null;
    expect(getClipStyle(audio, null)).toEqual(COLORS.clip.audio);
    draw(audio); expect(state.video).not.toHaveBeenCalled();
  });
});
