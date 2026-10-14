import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AssetLibrary } from './library';
import type { ProjectFS } from './fs';

describe('portable Cuelume audio', () => {
  it('uses the native audio probe, copies exact WAV bytes and reopens after the source is disconnected', async () => {
    const path = resolve(import.meta.dirname, '../../../docs/resources/sounds/cuelume/press/tap-normal.wav');
    const bytes = new Uint8Array(await readFile(path));
    const original = '/external/cuelume/tap-normal.wav';
    const files = new Map<string, File>([[original, new File([bytes], 'tap-normal.wav', { type: 'audio/wav' })]]);
    let manifest: unknown = null;
    const fs: ProjectFS = {
      async readManifest() { return manifest; }, async writeManifest(value) { manifest = structuredClone(value); },
      async list() { return []; }, async stat(source) { const file = files.get(source); return file ? { size: file.size, mtime: 1 } : null; },
      async file(source) { const file = files.get(source); if (!file) throw Error('Library disconnected'); return file; },
      async write(source, blob) { files.set(source, new File([blob], 'tap-normal.wav', { type: blob.type })); },
      async remove(source) { files.delete(source); },
    };
    const library = new AssetLibrary(fs);
    const imported = await library.import([original], { folder: 'Audio/Cuelume', copy: true });
    expect(imported.failed).toEqual([]); expect(imported.assets).toHaveLength(1);
    const copied = imported.assets[0]!;
    expect(copied.type).toBe('AUDIO'); expect(copied.source).toBe('assets/Audio/Cuelume/tap-normal.wav');
    expect(new Uint8Array(await files.get(copied.source)!.arrayBuffer())).toEqual(bytes);
    await library.dispose(); files.delete(original);
    const reopened = new AssetLibrary(fs);
    try {
      await reopened.load();
      const restored = await reopened.resolve('Audio/Cuelume/tap-normal.wav');
      expect(restored.type).toBe('AUDIO');
      const restoredBytes = Buffer.from(await (await fs.file(restored.source)).arrayBuffer());
      expect(restoredBytes.equals(Buffer.from(bytes))).toBe(true);
      expect(restoredBytes.includes(Buffer.from('MIT License'))).toBe(true);
      expect(restoredBytes.includes(Buffer.from('Daniel Belyi'))).toBe(true);
    } finally { await reopened.dispose(); }
  });
});
