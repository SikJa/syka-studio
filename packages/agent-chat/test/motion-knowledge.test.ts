import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cp, mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { motionKnowledge } from '../src/host/motion-knowledge';
import { WorkspaceTools, WORKSPACE_TOOLS } from '../src/host/workspace-tools';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let folder: string, docs: string;
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'syka-motion-knowledge-host-'));
  docs = join(folder, 'resources/docs');
  await cp(join(repo, 'docs/skills/syka-motion-references'), join(docs, 'skills/syka-motion-references'), { recursive: true });
});
afterAll(async () => { vi.unstubAllGlobals(); await rm(folder, { recursive: true, force: true }); });

describe('installed motion knowledge', () => {
  it('ships repository studies and separate routes without a personal research folder', async () => {
    const tools = new WorkspaceTools(folder, docs);
    const result = await tools.call('syka_motion_knowledge', { query: 'showreel', kind: 'skill', useCase: 'reel', limit: 4, includeText: true }) as { results: { useCases: string[]; sourceText?: string; sourceStorage: string }[] };
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.every(row => row.useCases.includes('reel'))).toBe(true);
    const study = await tools.call('syka_motion_knowledge', { id: 'stack-whaleyxbt-claude-motion', includeText: true }) as typeof result;
    expect(study.results[0]?.sourceStorage).toBe('bundled_original_study');
    expect(study.results[0]?.sourceText).toContain('timeline compartido');
    const sound = await tools.call('syka_motion_knowledge', { id: 'stack-bodila51-opus-sound-layer', includeText: true }) as typeof result;
    expect(sound.results[0]?.sourceStorage).toBe('bundled_original_study');
    expect(sound.results[0]?.sourceText).toContain('syka_audio_review');
    await expect(tools.call('syka_motion_knowledge', { query: 'anything', useCase: 'invented' })).rejects.toThrow('use case');
  });
  it('native workspace tool reads the relocated bundled studies and text without network or videos', async () => {
    const fetcher = vi.fn(() => { throw Error('Offline test: network forbidden'); });
    vi.stubGlobal('fetch', fetcher);
    const tools = new WorkspaceTools(folder, docs);
    const result = await tools.call('syka_motion_knowledge', { query: 'tarjetas tipografía continuidad', kind: 'video', limit: 3, includeText: true, maxChars: 24000 }) as {
      delivery: string; knowledgeAvailable: boolean; libraryAvailable: boolean;
      results: { sourcePath: string | null; sourceText?: string; ownAnalysis?: unknown; media: unknown[] }[];
    };
    expect(result.delivery).toBe('bundled_offline_knowledge');
    expect(result.knowledgeAvailable).toBe(true);
    expect(result.libraryAvailable).toBe(false);
    expect(result.results).toHaveLength(3);
    expect(result.results.some(r => r.ownAnalysis)).toBe(true);
    expect(result.results.some(r => r.sourceText && r.sourcePath?.startsWith(docs))).toBe(true);
    expect(result.results.every(r => r.media.length === 0)).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
    expect(JSON.stringify(result, null, 2).length + 1).toBeLessThanOrEqual(24000);
    expect(WORKSPACE_TOOLS.some(t => t.name === 'syka_motion_knowledge')).toBe(true);
  });

  it('refuses arbitrary archive, executable and non-text query options', async () => {
    await expect(motionKnowledge(docs, { query: 'tarjetas', library: folder })).rejects.toThrow('Only bundled');
    await expect(motionKnowledge(docs, { query: 'tarjetas', executable: 'node' })).rejects.toThrow('Only bundled');
    await expect(motionKnowledge(docs, { query: 12 })).rejects.toThrow('query must be text');
    await expect(motionKnowledge(docs, { query: 'tarjetas', includeText: 'yes' })).rejects.toThrow('includeText must be boolean');
    await expect(motionKnowledge(undefined, { query: 'tarjetas' })).rejects.toThrow('resources are not configured');
  });

  it('rejects a bundled skill junction that escapes app resources', async () => {
    const alternate = join(folder, 'junction-docs');
    await mkdir(join(alternate, 'skills'), { recursive: true });
    await symlink(join(docs, 'skills/syka-motion-references'), join(alternate, 'skills/syka-motion-references'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(motionKnowledge(alternate, { query: 'tarjetas' })).rejects.toThrow('escapes app resources');
  });
});
