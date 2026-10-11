import { describe, expect, it } from 'vitest';
import { AssetLibrary } from './library';
import type { ProjectFS } from './fs';

describe('media resolution during project startup', () => {
  it('waits for a delayed manifest before resolving an existing library video', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const fs: ProjectFS = {
      async readManifest() {
        await gate;
        return { version: 1, folders: [], assets: [{ id: 'test-video', path: 'recording.mp4', source: 'F:/media/recording.mp4', type: 'VIDEO', createdAt: '2026-09-29T00:00:00Z', mimeType: 'video/mp4', stat: { size: 123, mtime: 1 }, width: 1920, height: 1080, duration: 10, frameRate: 60, sampleRate: 48000, channels: 2, bitRate: 1 }] };
      },
      async writeManifest() {}, async list() { return []; },
      async stat() { return null; }, async file() { throw new Error('No file read needed to resolve known media'); },
      async write() {}, async remove() {},
    };
    const library = new AssetLibrary(fs);
    const loading = library.load();
    const resolving = library.resolve('recording.mp4');
    release();
    await loading;
    expect((await resolving).source).toBe('F:/media/recording.mp4');
    await expect(library.resolve('missing.mp4')).rejects.toThrow('Could not resolve media src');
    library.dispose();
  });
});

