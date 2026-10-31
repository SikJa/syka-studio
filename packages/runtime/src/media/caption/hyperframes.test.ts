import { describe, expect, it } from 'vitest';
import { HyperFramesCaptionDecoder, HYPERFRAMES_TYPES, hyperFramesCueAt, hyperFramesWordEffect } from './hyperframes';
import { createRuntimeWorld } from '../../world/create-world';
import { createEntity } from '../../actions/entities';
import { Chars, ChildOf, TextRange } from '../../traits';
import type { Asset } from '@diffusionstudio/assets';
import type { HyperFramesPreset } from './hyperframes';

const asset = { id: 'hyperframes-real-times', type: 'AUDIO', transcript: [{ text: 'Una prueba real. Otra.', words: [
  { text: 'Una', start: 0.1, end: 0.4 }, { text: 'prueba', start: 0.4, end: 0.8 },
  { text: 'real.', start: 0.8, end: 1.2 }, { text: 'Otra.', start: 2.6, end: 3 },
] }] } as Asset;

describe('HyperFrames native captions', () => {
  it.each(Object.keys(HYPERFRAMES_TYPES) as HyperFramesPreset[])('%s preserves word times, clears silence and repeats backwards seeks', async preset => {
    const decoder = new HyperFramesCaptionDecoder(asset, preset);
    const world = createRuntimeWorld('hf-caption-test');
    const entity = createEntity(world);
    await decoder.initPromise;
    try {
      entity.add(Chars({ value: 'text from the previous preset' }));
      decoder.seekTo(world, entity, -1);
      expect(entity.get(Chars)?.value).toBe('');
      expect(decoder.groups.flat()).toEqual(asset.transcript!.flatMap(s => s.words));
      const read = () => ({ text: entity.get(Chars)?.value, ranges: world.query(ChildOf(entity), TextRange).map(r => r.get(TextRange)) });
      decoder.seekTo(world, entity, 0.55);
      const before = read();
      expect(before.text).toContain('prueba');
      expect(before.ranges.length).toBe(preset === 'kinetic-slam' ? 1 : 3);
      decoder.seekTo(world, entity, 2);
      expect(read()).toEqual({ text: '', ranges: [] });
      decoder.seekTo(world, entity, 2.8);
      expect(read().text).toBe('Otra.');
      decoder.seekTo(world, entity, 0.55);
      expect(read()).toEqual(before);
      decoder.seekTo(world, entity, -1);
      expect(read()).toEqual({ text: '', ranges: [] });
    } finally { decoder.dispose(); world.destroy(); }
  });
  it('does not overlap cues or leave text hanging through a silence', () => {
    const groups = [[{ text: 'uno', start: 0, end: 1 }], [{ text: 'dos', start: 1.1, end: 2 }]];
    expect(hyperFramesCueAt(groups, 1.09)).toBe(0);
    expect(hyperFramesCueAt(groups, 1.1)).toBe(1);
    expect(hyperFramesCueAt(groups, 2.41)).toBe(-1);
  });
  it('reveals from real start time and settles all entry transforms', () => {
    expect(hyperFramesWordEffect('clip-wipe', -0.1, 0, 70)).toEqual({ reveal: 0, opacity: 0 });
    expect(hyperFramesWordEffect('clip-wipe', 1, 0, 70)).toEqual({ reveal: 1, opacity: 1 });
    for (const preset of Object.keys(HYPERFRAMES_TYPES) as HyperFramesPreset[]) {
      const pose = hyperFramesWordEffect(preset, 1, 3, 70);
      expect(pose.x ?? 0).toBe(0); expect(pose.y ?? 0).toBe(0); expect(pose.scale ?? 1).toBe(1);
      hyperFramesWordEffect(preset, -1, 3, 70);
      expect(hyperFramesWordEffect(preset, 1, 3, 70)).toEqual(pose);
    }
  });
});
