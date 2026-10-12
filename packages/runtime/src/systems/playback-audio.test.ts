import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorld } from 'koota';
import { Audio, AudioDecoderHandle, AudioEngine, AudioPlayback, ChildOf, Computed, FrameRate, Geometry, Group, Mode, Playback, Root, Time, Trim } from '../traits';

vi.mock('../media', () => ({
  resolveAudioDecoder: (_world: unknown, entity: any) => ({ decoder: entity.get(AudioDecoderHandle), initPromise: null }),
  resolveCaptionDecoder: () => null, resolveImageDecoder: () => null, resolveShaderHost: () => null, resolveVideoDecoder: () => null,
}));
import { playbackSystem } from './playback';
const worlds: ReturnType<typeof createWorld>[] = [];
afterEach(() => { for (const world of worlds.splice(0)) world.destroy(); });
function fixture(speed: number, clipRate = 1) {
  const world = createWorld(); worlds.push(world);
  const root = world.spawn(Group, Computed);
  const context = { currentTime: 12, destination: {}, createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }) };
  world.add(Root(root), Mode({ value: 'realtime' }), FrameRate({ value: 30 }), Time({ delta: 0 }), AudioEngine({ context: context as unknown as AudioContext }));
  const scene = world.spawn(Group, Computed({ localTime: 180, localTimeInSeconds: 6, duration: 900 }), Playback({ playing: true, speed }), ChildOf(root));
  const decoder = { ready: true, reset: vi.fn(), playTo: vi.fn() };
  const clip = world.spawn(Geometry, Audio, ChildOf(scene), Trim({ start: 60 }), Computed({ origin: 60, start: 120, end: 720, duration: 600, playbackRate: clipRate }), AudioDecoderHandle);
  clip.set(AudioDecoderHandle, decoder as any);
  return { world, scene, clip, decoder, context };
}
describe('audio at every preview speed', () => {
  it.each([.25, .5, 1, 1.5, 2, 4, 8, 16])('schedules audio at %sx with a stable clock and authored clip rate', speed => {
    const { world, scene, decoder } = fixture(speed, 1.5);
    playbackSystem(world);
    const options = decoder.playTo.mock.calls[0]![1];
    expect(options.playbackRate).toBe(speed * 1.5);
    expect(options.relativeDelay).toBeCloseTo(12 + (2 - 6) / speed);
    expect(options.relativeFrom).toBeCloseTo(6);
    expect(options.trimStart).toBe(2);
    expect(decoder.reset).toHaveBeenCalledOnce();
    const anchor = scene.get(AudioPlayback)!.contextOffsetInSeconds;
    playbackSystem(world);
    expect(decoder.reset).toHaveBeenCalledOnce();
    expect(scene.get(AudioPlayback)!.contextOffsetInSeconds).toBe(anchor);
  });
  it('re-anchors and cancels old buffers when changing speed, pausing and resuming', () => {
    const { world, scene, decoder, context } = fixture(1);
    playbackSystem(world); context.currentTime = 20;
    scene.set(Playback, { speed: 2 }); playbackSystem(world);
    expect(decoder.reset).toHaveBeenCalledTimes(2);
    expect(scene.get(AudioPlayback)!.contextOffsetInSeconds).toBe(20);
    scene.set(Playback, { playing: false }); playbackSystem(world);
    const calls = decoder.playTo.mock.calls.length;
    scene.set(Playback, { playing: true, speed: .5 }); playbackSystem(world);
    expect(decoder.playTo.mock.calls.length).toBe(calls + 1);
    expect(decoder.playTo.mock.calls.at(-1)![1].playbackRate).toBe(.5);
  });
});
