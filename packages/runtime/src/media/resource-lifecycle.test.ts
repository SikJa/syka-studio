import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioAsset, VideoAsset } from '@diffusionstudio/assets';

const state = vi.hoisted(() => ({
  file: vi.fn<() => Promise<Blob>>(),
  audio: vi.fn<() => Promise<unknown>>(), video: vi.fn<() => Promise<unknown>>(),
  sinkNext: vi.fn(), sinkReturn: vi.fn(async () => ({ done: true, value: undefined })),
  inputs: [] as Array<{ dispose: ReturnType<typeof vi.fn> }>,
  canvasSinks: 0,
}));
vi.mock('../actions/assets', () => ({ getAssetFile: state.file, getAsset: () => undefined, getSequenceFrameRate: () => 30 }));
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [], BlobSource: class {}, InputVideoTrack: class {}, EncodedPacket: class {},
  Input: class {
    dispose = vi.fn();
    constructor() { state.inputs.push(this); }
    getPrimaryAudioTrack = state.audio; getPrimaryVideoTrack = state.video;
  },
  AudioBufferSink: class { buffers() { return { next: state.sinkNext, return: state.sinkReturn }; } },
  CanvasSink: class { constructor() { state.canvasSinks++; } },
  EncodedPacketSink: class { async getFirstKeyPacket() { return null; } },
}));

import { AudioDecoder, clearAudioTrackCache, getAudioTrack } from './audio';
import { VideoBuffer, VideoExporter, clearVideoTrackCache, getVideoTrack } from './video';

const asset = () => ({ id: 'same-file', type: 'VIDEO', width: 1280, height: 720, duration: 2, frameRate: 30, channels: 1, sampleRate: 48000 }) as VideoAsset;
beforeEach(() => {
  vi.clearAllMocks(); clearAudioTrackCache(); clearVideoTrackCache();
  state.inputs = []; state.canvasSinks = 0;
  state.file.mockResolvedValue(new Blob()); state.audio.mockResolvedValue({});
  state.video.mockResolvedValue({ rotation: 0, getDecoderConfig: async () => ({}), getFirstTimestamp: async () => 0 });
});

describe('media lifetime when a project closes', () => {
  it('shares tracks in one library and reads a fresh handle in another project with the same file ID', async () => {
    const first = asset(), second = asset();
    const [one, two] = await Promise.all([getVideoTrack(first), getVideoTrack(first)]);
    expect(one).toBe(two); expect(state.inputs).toHaveLength(1);
    await getVideoTrack(second); expect(state.inputs).toHaveLength(2);
    await Promise.all([getAudioTrack(first), getAudioTrack(first)]);
    expect(state.inputs).toHaveLength(3);
  });

  it('closes failed/empty demuxers and permits retry after a disk error', async () => {
    const source = asset();
    state.video.mockRejectedValueOnce(Error('disk offline'));
    expect(await getVideoTrack(source)).toBeNull();
    expect(state.inputs[0]!.dispose).toHaveBeenCalledOnce();
    expect(await getVideoTrack(source)).not.toBeNull();
    state.audio.mockResolvedValueOnce(null);
    expect(await getAudioTrack(source)).toBeNull();
    expect(state.inputs[2]!.dispose).toHaveBeenCalledOnce();
  });

  it('does not create an export Input after its file finishes loading into a closed project', async () => {
    const file = Promise.withResolvers<Blob>(); state.file.mockReturnValue(file.promise);
    const decoder = new VideoExporter(asset());
    decoder.dispose(); file.resolve(new Blob()); await decoder.initialized;
    expect(state.inputs).toHaveLength(0); expect(state.canvasSinks).toBe(0);
    expect(decoder.toBitmap()).toBeNull();
  });

  it('does not revive an audio sink when initialization finishes after disposal', async () => {
    const track = Promise.withResolvers<unknown>(); state.audio.mockReturnValue(track.promise);
    const decoder = new AudioDecoder(asset() as AudioAsset | VideoAsset);
    const initialized = decoder.init(); decoder.dispose(); track.resolve({}); await initialized;
    expect(decoder.ready).toBe(false);
  });

  it('does not schedule decoded audio arriving after a pause/reset', async () => {
    const decoder = new AudioDecoder(asset()); await decoder.init();
    const pending = Promise.withResolvers<IteratorResult<unknown>>(); state.sinkNext.mockReturnValue(pending.promise);
    const createBufferSource = vi.fn();
    const play = decoder.playTo({ context: { createBufferSource }, input: {} } as any,
      { relativeFrom: 0, relativeTo: 1, trimStart: 0, trimEnd: 2, playbackRate: 1, currentTime: 0, relativeDelay: 0 });
    await vi.waitFor(() => expect(state.sinkNext).toHaveBeenCalledOnce());
    decoder.reset(); pending.resolve({ done: false, value: {} }); await play;
    expect(createBufferSource).not.toHaveBeenCalled(); expect(state.sinkReturn).toHaveBeenCalledOnce();
    decoder.dispose();
  });

  it('keeps a preview discarded if its track arrives after disposal', async () => {
    vi.stubGlobal('OffscreenCanvas', class { width = 0; height = 0; getContext() { return {}; } });
    try {
      const track = Promise.withResolvers<unknown>(); state.video.mockReturnValue(track.promise);
      const decoder = new VideoBuffer(asset()); decoder.dispose();
      track.resolve({}); await decoder.initialized;
      expect(decoder.packetSink).toBeNull(); expect(decoder.mode).toBe('discarded');
      expect(decoder.toBitmap()).toBeNull();
    } finally { vi.unstubAllGlobals(); }
  });
});
