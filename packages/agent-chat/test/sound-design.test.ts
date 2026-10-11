import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { soundProfile } from '../src/host/audio-spectrum';
import { matchCue, audioBalance, audioReview } from '../src/host/sound-design';
import { analyzeAudio } from '../src/host/audio-analysis';
import { mediaProcess } from '../src/host/media-analysis';
import { resolveLocalTool } from '../src/host/local-tools';
import { WorkspaceTools, WORKSPACE_TOOLS } from '../src/host/workspace-tools';
import { resourceLibrary } from '../src/host/resource-library';

const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string'));
const ffmpeg = resolveLocalTool('ffmpeg', { env }).path, ffprobe = resolveLocalTool('ffprobe', { env }).path;
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
function signal(rate: number, duration: number, frequency: number, opposite = false) {
  const pcm = Buffer.alloc(Math.round(rate * duration) * 8);
  for (let i = 0; i < pcm.length / 8; i++) {
    const t = i / rate, value = .4 * Math.sin(2 * Math.PI * frequency * t);
    pcm.writeFloatLE(value, i * 8); pcm.writeFloatLE(opposite ? -value : value, i * 8 + 4);
  }
  return pcm;
}
describe('portable sound direction', () => {
  it('measures high-frequency SFX without stereo cancellation or downsampling alias', () => {
    const normal = soundProfile(signal(48000, .2, 6000)), opposite = soundProfile(signal(48000, .2, 6000, true));
    expect(normal.centroidHz).toBeCloseTo(6000, -1);
    expect(opposite.centroidHz).toBe(normal.centroidHz);
    expect(opposite.stereoCorrelation).toBe(-1);
    expect(opposite.peakOffsetSeconds).not.toBeNull();
    expect(normal.brightness).toBe('bright');
    expect(soundProfile(signal(48000, .2, 100)).brightness).toBe('dark');
    expect(soundProfile(Buffer.alloc(48000 * 8 / 10))).toMatchObject({ peakOffsetSeconds: null, centroidHz: null, brightness: null, flatness: null });
  });
  it('reports a known cue offset and refuses to approve a missing/short template', () => {
    const expected = Buffer.alloc(512 * 8);
    for (let i = 0; i < 512; i++) {
      const t = i / 8000, value = .6 * Math.sin(2 * Math.PI * (200 * t + 8000 * t * t)) * Math.sin(Math.PI * i / 512) ** 2;
      expected.writeFloatLE(value, i * 8); expected.writeFloatLE(-value, i * 8 + 4);
    }
    const actual = Buffer.alloc(8000 * 8); expected.copy(actual, (3000 + 160) * 8);
    expect(matchCue(actual, expected, 3000)).toMatchObject({ status: 'matched', correlation: 1, offsetMs: 20 });
    expect(matchCue(Buffer.alloc(actual.length), expected, 3000)).toMatchObject({ status: 'not-detected', offsetMs: null });
    expect(matchCue(Buffer.alloc(8), expected, 0)).toMatchObject({ status: 'inconclusive', offsetMs: null });
    expect(matchCue(actual, Buffer.alloc(8), 3000).status).toBe('inconclusive');
  });
  it('searches catalog brightness/attack and leaves unknown personal measurements unclassified', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-sound-search-'));
    try {
      const profile = soundProfile(signal(48000, .2, 6000));
      await writeFile(join(root, 'bright.wav'), 'fixture'); await writeFile(join(root, 'dark.wav'), 'fixture-dark');
      await writeFile(join(root, 'catalog.json'), JSON.stringify({ version: 1, entries: [
        { path: 'bright.wav', brand: 'Fixture', audioType: 'sfx', audioFamily: 'tap', soundProfile: profile },
        { path: 'dark.wav', brand: 'Fixture', audioType: 'sfx', audioFamily: 'tap' },
      ] }));
      const result = await resourceLibrary(join(root, 'none.json'), { action: 'list', kind: 'sounds', brightness: 'bright', attack: 'sharp' }, undefined, root);
      expect(result.total).toBe(1); expect(result.entries[0]?.name).toBe('bright.wav');
      expect(result.entries[0]?.soundProfile?.centroidHz).toBe(6000);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it.skipIf(!ffmpeg || !ffprobe)('analyzes 44.1 kHz input, balances against a bed and checks actual AAC cue timing through shared tools', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-sound-live-'));
    try {
      const rate = 44100, data = Buffer.alloc(Math.round(rate * .2) * 8);
      for (let i = 0; i < data.length / 8; i++) {
        const t = i / rate, value = .6 * Math.sin(2 * Math.PI * (200 * t + 8000 * t * t)) * Math.sin(Math.PI * t / .2) ** 4;
        data.writeFloatLE(value, i * 8); data.writeFloatLE(-value, i * 8 + 4);
      }
      await writeFile(join(root, 'effect.f32'), data);
      await mediaProcess(ffmpeg!, ['-v', 'error', '-f', 'f32le', '-ar', '44100', '-ac', '2', '-i', join(root, 'effect.f32'), join(root, 'effect.wav')], 100000);
      await mediaProcess(ffmpeg!, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=100:duration=2', '-af', 'volume=0.05', '-ac', '2', join(root, 'bed.wav')], 100000);
      await mediaProcess(ffmpeg!, ['-v', 'error', '-i', join(root, 'bed.wav'), '-i', join(root, 'effect.wav'), '-filter_complex', '[1:a]adelay=700|700[s];[0:a][s]amix=inputs=2:normalize=0', '-c:a', 'aac', '-b:a', '256k', join(root, 'mix.m4a')], 100000);
      const original = hash(await readFile(join(root, 'effect.wav')));
      const profile = await analyzeAudio(root, { source: 'effect.wav', detail: 'sfx' }, { env });
      expect(profile.soundProfile?.durationSeconds).toBeCloseTo(.2, 3);
      expect(profile.profileRate).toBe(48000);
      const tools = new WorkspaceTools(root, undefined, undefined, undefined, undefined, env);
      expect(WORKSPACE_TOOLS.map(t => t.name)).toEqual(expect.arrayContaining(['syka_audio_balance', 'syka_audio_review']));
      const balance = await tools.call('syka_audio_balance', { source: 'effect.wav', bed: 'bed.wav', bedCueSeconds: .8 }) as Awaited<ReturnType<typeof audioBalance>>;
      expect(Number.isFinite(balance.suggestedNativeVolumeDb)).toBe(true);
      expect(balance.requiresListening).toBe(true);
      // Float WAV can legitimately exceed 0 dBFS. The gain floor must not
      // override the promised individual sample-peak ceiling for a hot asset.
      await mediaProcess(ffmpeg!, ['-v', 'error', '-i', join(root, 'effect.wav'), '-af', 'volume=1000', '-c:a', 'pcm_f32le', join(root, 'hot.wav')], 100000);
      const hot = await audioBalance(root, { source: 'hot.wav', bed: 'bed.wav', bedCueSeconds: .8 }, { env });
      expect(hot.suggestedNativeVolumeDb).toBeLessThan(-36);
      const cuePoint = profile.measuredCuePointSeconds!;
      const result = await tools.call('syka_audio_review', { source: 'mix.m4a', cues: [{ id: 'hit', seconds: .7 + cuePoint, asset: 'effect.wav', assetCuePointSeconds: cuePoint, toleranceMs: 33 }] }) as Awaited<ReturnType<typeof audioReview>>;
      expect(result.cues[0]?.status).toBe('matched');
      expect(result.cues[0]?.withinTolerance).toBe(true);
      expect(result.integratedLufs).not.toBeNull();
      expect(result.requiresListening).toBe(true);
      expect(result.sourceSha256).toBe(hash(await readFile(join(root, 'mix.m4a'))));
      expect(result.cues[0]?.assetSha256).toBe(original);
      expect(hash(await readFile(join(root, 'effect.wav')))).toBe(original);
      await expect(audioReview(root, { source: 'mix.m4a', cues: [{ id: 'bad', seconds: .8, asset: '../escape.wav', assetCuePointSeconds: 0 }] }, { env })).rejects.toThrow('dentro');
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 30000);
});
