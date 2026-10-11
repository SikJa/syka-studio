import { describe, expect, it, vi } from 'vitest';
vi.mock('./probe', () => ({
  detectMimeType: async () => 'image/svg+xml', probeMedia: async () => ({ type: 'IMAGE', width: 120, height: 120 }),
  DEFAULT_SEQUENCE_FPS: 30, isSequenceListing: () => false, sortFrames: (entries: unknown[]) => entries,
}));
import { AssetLibrary } from './library';
import type { ProjectFS } from './fs';

function fixture() {
  const original = '/outside/logos/vercel.svg';
  const svg = '<svg viewBox="0 0 120 120"><path d="M60 0L120 120H0Z"/></svg>';
  const files = new Map<string, File>([[original, new File([svg], 'vercel.svg', { type: 'image/svg+xml' })]]);
  let manifest: unknown = null, writes = 0;
  const fs: ProjectFS = {
    async readManifest() { return manifest; }, async writeManifest(value) { manifest = structuredClone(value); },
    async list() { return []; }, async stat(source) { const file = files.get(source); return file ? { size: file.size, mtime: 1 } : null; },
    async file(source) { const file = files.get(source); if (!file) throw Error('Source disconnected'); return file; },
    async write(path, blob) { writes++; files.set(path, new File([blob], path.split('/').at(-1)!, { type: blob.type })); },
    async remove(path) { files.delete(path); },
  };
  return { original, svg, files, fs, writes: () => writes };
}
describe('portable asset copies', () => {
  it('keeps existing link imports unchanged', async () => {
    const f = fixture(), library = new AssetLibrary(f.fs);
    const result = await library.import([f.original]);
    expect(result.failed).toEqual([]); expect(result.assets[0].source).toBe(f.original); expect(f.writes()).toBe(0);
    await library.dispose();
  });
  it('copies exact bytes and reopens after the external library disappears', async () => {
    const f = fixture(), library = new AssetLibrary(f.fs);
    const result = await library.import([f.original], { folder: 'logos', copy: true });
    expect(result.failed).toEqual([]);
    expect(result.assets[0].source).toBe('assets/logos/vercel.svg');
    expect(await f.files.get(result.assets[0].source)!.text()).toBe(f.svg);
    expect(await f.files.get(f.original)!.text()).toBe(f.svg);
    await library.dispose(); f.files.delete(f.original);
    const reopened = new AssetLibrary(f.fs); await reopened.load();
    const asset = await reopened.resolve('logos/vercel.svg');
    expect(await (await f.fs.file(asset.source)).text()).toBe(f.svg);
    await reopened.dispose();
  });
  it('materializes an already linked asset without duplicate identity or extra copies', async () => {
    const f = fixture(), library = new AssetLibrary(f.fs);
    const linked = (await library.import([f.original], { folder: 'logos' })).assets[0];
    const copied = (await library.import([f.original], { folder: 'logos', copy: true })).assets[0];
    expect(copied).toBe(linked); expect(copied.source).toBe('assets/logos/vercel.svg');
    await library.import([f.original], { copy: true });
    expect(library.list()).toHaveLength(1); expect(f.writes()).toBe(1);
    await library.dispose();
  });
});
