import { describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { resourceLibrary, type ResourceResult } from '../src/host/resource-library';
import { WorkspaceTools } from '../src/host/workspace-tools';
import { checkSoundCatalog } from '../../../scripts/check-sound-catalog.mjs';

const docs = resolve(import.meta.dirname, '../../../docs');
const sounds = join(docs, 'resources', 'sounds');

describe('Cuelume offline SFX integration', () => {
  it('exposes every real cue through the agent tool, with material, emphasis and measured timing', async () => {
    const profile = await mkdtemp(join(tmpdir(), 'syka-cuelume-agent-'));
    try {
      const tools = new WorkspaceTools(profile, docs, undefined, join(profile, 'resources.json'));
      const found = await tools.call('syka_resources', { action: 'list', kind: 'sounds', query: 'Cuelume', audioType: 'sfx', limit: 200 }) as ResourceResult;
      expect(found.warnings).toEqual([]); expect(found.nextOffset).toBeNull();
      expect(found.total).toBe(168);
      expect(new Set(found.entries.map(entry => entry.theme))).toEqual(new Set(['default', 'mech', 'bubble', 'press']));
      expect(new Set(found.entries.map(entry => entry.variant))).toEqual(new Set(['subtle', 'normal', 'strong']));
      for (const entry of found.entries) {
        expect(entry.provider).toBe('Cuelume'); expect(entry.license).toBe('MIT');
        expect(entry.origin).toBe('bundled'); expect(entry.duration).toBeGreaterThan(0);
        expect(entry.cuePoint).toBeGreaterThanOrEqual(0); expect(entry.cuePoint).toBeLessThan(entry.duration!);
        expect(entry.soundProfile?.peakDb).toBeLessThan(0);
      }
      const taps = await tools.call('syka_resources', { action: 'list', kind: 'sounds', query: 'Cuelume press', audioFamily: 'tap' }) as ResourceResult;
      expect(taps.entries).toHaveLength(3);
      expect(taps.entries.every(entry => entry.theme === 'press')).toBe(true);
    } finally { await rm(profile, { recursive: true, force: true }); }
  });

  it('previews and validates relocated WAVs, preserving their portable license and rejecting corrupt provenance', async () => {
    const fixture = await mkdtemp(join(tmpdir(), 'syka-cuelume-install-'));
    const root = join(fixture, 'resources', 'sounds');
    try {
      const catalog = JSON.parse(await readFile(join(sounds, 'catalog.json'), 'utf8'));
      const entries = catalog.entries.filter((entry: { path: string }) =>
        ['cuelume/default/success-normal.wav', 'cuelume/press/tap-normal.wav', 'cuelume/bubble/select-subtle.wav'].includes(entry.path));
      expect(entries).toHaveLength(3);
      for (const path of [...entries.map((entry: { path: string }) => entry.path), 'LICENSE-SYKA.txt', 'LICENSE-CUELUME.txt', 'sources/cuelume.json']) {
        await mkdir(dirname(join(root, path)), { recursive: true });
        await copyFile(join(sounds, path), join(root, path));
      }
      await writeFile(join(root, 'catalog.json'), JSON.stringify({ version: 1, entries }));
      expect(await checkSoundCatalog(fixture)).toMatchObject({ count: 3, providers: { Cuelume: 3 } });
      const resources = await resourceLibrary(join(fixture, 'config.json'), { action: 'list', kind: 'sounds', query: 'Cuelume press' }, undefined, root);
      expect(resources.entries).toHaveLength(1);
      const selected = resources.entries[0]!;
      expect(selected.path.startsWith(root)).toBe(true);
      const preview = await resourceLibrary(join(fixture, 'config.json'), { action: 'preview', path: selected.path }, undefined, root);
      const wave = Buffer.from(preview.preview!.split(',')[1]!, 'base64');
      expect(wave.subarray(0, 4).toString()).toBe('RIFF');
      expect(wave.readUInt32LE(24)).toBe(48000); expect(wave.readUInt16LE(22)).toBe(2);
      expect(wave.readUInt16LE(34)).toBe(16);
      expect(wave.includes(Buffer.from('MIT License'))).toBe(true);
      expect(wave.includes(Buffer.from('Copyright (c) 2026 Daniel Belyi'))).toBe(true);
      expect(wave.readUInt32LE(40) / 4 / 48000).toBe(selected.duration);
      const sourceFile = join(root, 'sources', 'cuelume.json');
      const source = JSON.parse(await readFile(sourceFile, 'utf8'));
      source.files.find((file: { path: string }) => file.path === entries[0].path).sha256 = '0'.repeat(64);
      await writeFile(sourceFile, JSON.stringify(source));
      await expect(checkSoundCatalog(fixture)).rejects.toThrow('Unverified Cuelume');
      await copyFile(join(sounds, 'sources', 'cuelume.json'), sourceFile);
      await writeFile(join(root, 'LICENSE-CUELUME.txt'), 'MIT License without the original notice');
      await expect(checkSoundCatalog(fixture)).rejects.toThrow('Cuelume license');
    } finally { await rm(fixture, { recursive: true, force: true }); }
  });
});
