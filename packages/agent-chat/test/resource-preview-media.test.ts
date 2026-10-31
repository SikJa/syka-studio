import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resourceLibrary, resourcePreviewMedia } from '../src/host/resource-library';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe('streamed library previews', () => {
  it('validates media like a preview without reading it, and rejects anything outside the libraries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-preview-')); roots.push(root);
    const sounds = join(root, 'Sonidos'), outside = join(root, 'Privado'), config = join(root, 'resource-libraries.json');
    await mkdir(sounds); await mkdir(outside);
    await writeFile(join(sounds, 'tick.wav'), Buffer.alloc(64));
    await writeFile(join(outside, 'secret.wav'), Buffer.alloc(64));
    await writeFile(join(sounds, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    await resourceLibrary(config, { action: 'add-folder', kind: 'sounds', path: sounds });
    await expect(resourcePreviewMedia(config, join(sounds, 'tick.wav'))).resolves.toMatchObject({ kind: 'sounds', size: 64, mediaType: 'audio/wav' });
    await expect(resourcePreviewMedia(config, join(outside, 'secret.wav'))).rejects.toThrow('fuera de la biblioteca');
    await expect(resourcePreviewMedia(config, join(sounds, 'logo.svg'))).rejects.toThrow();
    const inline = await resourceLibrary(config, { action: 'preview', path: join(sounds, 'tick.wav') });
    expect(inline.preview).toMatch(/^data:audio\/wav;base64,/);
  });
});
