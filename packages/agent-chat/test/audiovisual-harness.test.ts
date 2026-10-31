import { describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceTools } from '../src/host/workspace-tools';
import { analyzeAudio } from '../src/host/audio-analysis';
import { resolveLocalTool } from '../src/host/local-tools';

const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string,string] => typeof entry[1] === 'string'));
const ffmpeg = resolveLocalTool('ffmpeg', { env }).path, ffprobe = resolveLocalTool('ffprobe', { env }).path;
describe('audiovisual resources through the common provider harness', () => {
  it.skipIf(!ffmpeg || !ffprobe)('finds a shipped SFX, verifies its project copy and measures that exact audible file', async () => {
    const project = await mkdtemp(join(tmpdir(), 'syka-audiovisual-harness-'));
    const tools = new WorkspaceTools(project, resolve('docs'), undefined, undefined, undefined, env);
    try {
      const result = await tools.call('syka_resources', { action: 'list', kind: 'sounds', audioType: 'sfx', query: 'Cuelume press glass', limit: 3 }) as { entries: { id: string; path: string; license: string; provider: string }[] };
      expect(result.entries.length).toBeGreaterThan(0);
      const selected = result.entries[0]!;
      expect(selected).toMatchObject({ license: 'MIT', provider: 'Cuelume' });
      const original = await readFile(selected.path);
      await mkdir(join(project, 'Audio'));
      await copyFile(selected.path, join(project, 'Audio', 'press.wav'));
      expect(await tools.call('syka_creative_selection', { action: 'choose', id: selected.id, role: 'sfx', reason: 'Acento para el botón, copiar y medir antes de alinear.', projectAsset: 'Audio/press.wav' })).toMatchObject({ imported: join('Audio','press.wav') });
      const analysis = await tools.call('syka_audio_analyze', { source: 'Audio/press.wav', detail: 'sfx' }) as Awaited<ReturnType<typeof analyzeAudio>>;
      expect(analysis.measuredCuePointSeconds).not.toBeNull();
      expect(analysis.soundProfile?.durationSeconds).toBeGreaterThan(0);
      expect(analysis.truePeakDb).not.toBeNull();
      expect(await readFile(selected.path)).toEqual(original);
      expect(await readFile(join(project, 'Audio', 'press.wav'))).toEqual(original);
    } finally {
      await tools.close();
      if (!project.startsWith(join(tmpdir(), 'syka-audiovisual-harness-'))) throw Error('Unexpected fixture');
      await rm(project, { recursive: true, force: true });
    }
  }, 30000);
});
