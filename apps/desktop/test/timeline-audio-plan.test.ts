import { describe, expect, it } from 'vitest';
import type { AuthoredTree } from '@diffusionstudio/reconciler';
import { planAudioDetach } from '../../web/src/engine/audio-detach-plan';

const clip = (): AuthoredTree => ({ tag: 'rect', props: { name: 'Entrevista', start: 5, end: 9, sourceIn: 10, sourceOut: 16, playbackRate: 1.5, volume: -6 }, children: [
  { tag: 'videoPaint', props: { src: 'assets/entrevista.mp4' }, children: [] },
  { tag: 'animation', props: { type: 'gain', duration: 0.5 }, children: [] },
  { tag: 'animation', props: { type: 'slide', duration: 0.5 }, children: [] },
  { tag: 'keyframeTrack', props: { property: 'volume' }, children: [{ tag: 'keyframe', props: { time: 1, value: -12 }, children: [] }] },
] });

describe('audio detach source plan', () => {
  it('keeps source, both trim endpoints, timeline timing and speed exactly, including gain automation', () => {
    const original = clip();
    const audio = planAudioDetach(original, 2).audio!;
    expect(audio.props).toEqual({ name: 'Entrevista · audio', src: 'assets/entrevista.mp4', start: 5, end: 9, sourceIn: 10, sourceOut: 16, playbackRate: 1.5, volume: -6 });
    expect(audio.children.map(child => child.tag)).toEqual(['animation', 'keyframeTrack']);
    audio.children[1].children[0].props.value = -20;
    expect(original.children[3].children[0].props.value).toBe(-12);
    expect(original.props.muted).toBeUndefined(); // Planning never mutates the source.
  });
  it('supports intrinsic Video and preserves an already muted clip', () => {
    const audio = planAudioDetach({ tag: 'video', props: { src: 'take.mp4', sourceIn: '00:00:10', muted: true }, children: [] }, 1).audio!;
    expect(audio.props.sourceIn).toBe('00:00:10');
    expect(audio.props.muted).toBe(true);
  });
  it('refuses silent sources, combined paints and nested sound rather than silently changing output', () => {
    expect(planAudioDetach(clip(), undefined).reason).toMatch(/audio/);
    const combined = clip(); combined.children.push(combined.children[0]);
    expect(planAudioDetach(combined, 2).audio).toBeUndefined();
    const nested = clip(); nested.children.push({ tag: 'audio', props: { src: 'music.wav' }, children: [] });
    expect(planAudioDetach(nested, 2).reason).toMatch(/otros elementos/);
    const synced = clip(); synced.props.syncTo = 'dialogue';
    expect(planAudioDetach(synced, 2).reason).toMatch(/sincronización/);
  });
});
