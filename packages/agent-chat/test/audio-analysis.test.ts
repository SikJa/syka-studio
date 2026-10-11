import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { analyzeAudio, analyzeAudioPcm, measuredLoudness } from '../src/host/audio-analysis';
import { analysisSource, mediaProcess } from '../src/host/media-analysis';
import { resolveLocalTool } from '../src/host/local-tools';
import { WorkspaceTools, WORKSPACE_TOOLS } from '../src/host/workspace-tools';

const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string'));
const ffmpeg = resolveLocalTool('ffmpeg', { env }).path;
const ffprobe = resolveLocalTool('ffprobe', { env }).path;
let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'syka-audio-analysis-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

function pulses(duration = 8, oppositePhase = false) {
  const pcm = Buffer.alloc(8000 * duration * 8);
  for (let i = 0; i < 8000 * duration; i++) {
    const phase = (i / 8000 - .2 + .5) % .5;
    const value = phase < .04 ? .6 * Math.cos(2 * Math.PI * 600 * i / 8000) * Math.exp(-phase * 60) : 0;
    pcm.writeFloatLE(value, i * 8); pcm.writeFloatLE(oppositePhase ? -value : value, i * 8 + 4);
  }
  return pcm;
}
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');

describe('local audio measurements', () => {
  it('detects repeated 120 BPM attacks without canceling opposite-phase stereo', () => {
    const normal = analyzeAudioPcm(pulses()), stereo = analyzeAudioPcm(pulses(8, true));
    expect(normal.onsets.length).toBe(16);
    expect(stereo.onsets).toEqual(normal.onsets);
    expect(stereo.tempoCandidates[0]).toMatchObject({ bpm: 120, confidence: 1 });
    expect(stereo.beatGridCandidate[0]).toBeCloseTo(.2, 2);
    expect(stereo.strongestEnergySeconds).toBeCloseTo(.2, 2);
  });
  it('keeps timestamps in the original source clock and avoids inventing beats in silence', () => {
    const shifted = analyzeAudioPcm(pulses(), 17.25);
    expect(shifted.onsets[0]!.seconds).toBeCloseTo(17.45, 2);
    expect(shifted.tempoCandidates[0]!.firstBeatSeconds).toBeCloseTo(17.45, 2);
    const silent = analyzeAudioPcm(Buffer.alloc(8000 * 8 * 8));
    expect(silent).toMatchObject({ decodedStereoPeakDb: null, strongestEnergySeconds: null, onsets: [], tempoCandidates: [], beatGridCandidate: [] });
    expect(() => analyzeAudioPcm(Buffer.alloc(3))).toThrow('PCM');
    const bad = Buffer.alloc(8); bad.writeFloatLE(NaN);
    expect(() => analyzeAudioPcm(bad)).toThrow('PCM');
    expect(measuredLoudness('log {"input_i":"-inf","input_tp":"-inf","input_lra":"0.0"}')).toEqual({ integratedLufs: null, truePeakDb: null, loudnessRangeLu: 0 });
  });
  it('does not force a tempo for isolated irregular cues', () => {
    const pcm = Buffer.alloc(8000 * 8 * 8);
    for (const seconds of [.23, 1.38, 3.21, 5.93]) for (let i = Math.round(seconds * 8000); i < Math.round(seconds * 8000) + 100; i++) {
      pcm.writeFloatLE(.5, i * 8); pcm.writeFloatLE(.5, i * 8 + 4);
    }
    expect(analyzeAudioPcm(pcm)).toMatchObject({ tempoCandidates: [], beatGridCandidate: [] });
  });
  it('rejects remote, escaping and junction sources before decoding', async () => {
    await expect(analysisSource(root, '../private.wav')).rejects.toThrow('dentro');
    await expect(analysisSource(root, 'https://example.com/private.wav')).rejects.toThrow('local');
    const project = join(root, 'project'); await mkdir(project);
    await writeFile(join(root, 'outside.wav'), 'not audio');
    await symlink(root, join(project, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(analysisSource(project, 'escape/outside.wav')).rejects.toThrow('sale del proyecto');
  });
  it('bounds subprocess output and execution time', async () => {
    await expect(mediaProcess(process.execPath, ['-e', 'process.stdout.write(Buffer.alloc(1024))'], 16)).rejects.toThrow('límite');
    await expect(mediaProcess(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], 1024, 50)).rejects.toThrow('superó');
  });
  it.skipIf(!ffmpeg || !ffprobe)('analyzes an actual WAV via the shared agent tool, preserving the file', async () => {
    const pcm = join(root, 'pulses.f32'), wav = join(root, 'pulses.wav');
    await writeFile(pcm, pulses(8, true));
    await mediaProcess(ffmpeg!, ['-nostdin', '-v', 'error', '-f', 'f32le', '-ar', '8000', '-ac', '2', '-i', pcm, '-ar', '48000', wav], 100_000);
    const original = hash(await readFile(wav));
    const tools = new WorkspaceTools(root, undefined, undefined, undefined, undefined, env);
    expect(WORKSPACE_TOOLS.some(tool => tool.name === 'syka_audio_analyze')).toBe(true);
    const result = await tools.call('syka_audio_analyze', { source: 'pulses.wav', startSeconds: 2, endSeconds: 6 }) as Awaited<ReturnType<typeof analyzeAudio>>;
    expect(result.timebase).toBe('source-seconds');
    expect(result.onsets[0]!.seconds).toBeCloseTo(2.2, 2);
    expect(result.tempoCandidates[0]!.bpm).toBe(120);
    expect(result.integratedLufs).not.toBeNull();
    expect(result.truePeakDb).not.toBeNull();
    expect(hash(await readFile(wav))).toBe(original);
    await expect(analyzeAudio(root, { source: 'pulses.wav', endSeconds: 9 }, { env })).rejects.toThrow('intervalo');
  }, 30_000);
});
