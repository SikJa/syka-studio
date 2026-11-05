import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ModelAsset } from './assets';
import { ExternalModels, knownModelDirs } from './external';
import { LocalVoice } from './local-voice';
import type { WhisperServer } from './whisper-server';

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
const temp = async () => { const dir = await mkdtemp(join(tmpdir(), 'syka-external-')); dirs.push(dir); return dir; };
const asset = (data: Buffer, file: string): ModelAsset => ({ file, url: 'https://x', sha256: createHash('sha256').update(data).digest('hex'), sizeBytes: data.length });

describe('knownModelDirs', () => {
  it("looks in Whispera's and Syka Code's folders on each platform", () => {
    expect(knownModelDirs('win32', { USERPROFILE: 'C:\\Users\\example', APPDATA: 'C:\\Users\\example\\AppData\\Roaming' })[0]).toMatch(/\.whispera[\\/]desktop[\\/]models$/);
    expect(knownModelDirs('darwin', { HOME: '/Users/example' }).some(dir => dir.includes('Application Support'))).toBe(true);
    expect(knownModelDirs('linux', { HOME: '/home/example' })[0]).toBe(join('/home/example', '.whispera', 'desktop', 'models'));
  });
});

describe('ExternalModels', () => {
  it('accepts only the exact file and remembers the verdict', async () => {
    const other = await temp();
    const data = Buffer.from('parakeet-weights');
    const good = asset(data, 'model.gguf');
    await writeFile(join(other, good.file), data);
    const external = new ExternalModels({ cacheFile: join(await temp(), 'cache.json'), dirs: () => ['C:/missing', other] });
    expect(await external.find(good)).toBe(join(other, good.file));
    expect(await external.find({ ...good, sha256: '0'.repeat(64) })).toBeNull();
    expect(await external.find({ ...good, sizeBytes: 3 })).toBeNull();
  });

  it("lets Whisper use another app's model in place and never deletes it", async () => {
    const other = await temp();
    const data = Buffer.from('ggml-small-weights');
    const small = asset(data, 'ggml-small.bin');
    await writeFile(join(other, small.file), data);
    const own = await temp();
    await mkdir(join(own, 'whisper-test'), { recursive: true });
    await writeFile(join(own, 'whisper-test', 'whisper-server.exe'), '');
    const external = new ExternalModels({ cacheFile: join(own, 'cache.json'), dirs: () => [other] });
    const local = new LocalVoice({ dir: own, server: { stop: () => undefined, state: 'stopped' } as unknown as WhisperServer, platform: 'win32', external,
      runtime: { url: 'x', sha256: 'x', sizeBytes: 1, folder: 'whisper-test', keep: /./ },
      models: { base: { ...small, file: 'ggml-base.bin', sha256: '1'.repeat(64) }, small, turbo: { ...small, file: 'ggml-turbo.bin', sha256: '2'.repeat(64) } } });
    expect(local.installed('small')).toBe(false);
    await local.discover();
    expect(local.status().models.find(model => model.id === 'small')).toMatchObject({ installed: true, external: true });
    expect(local.readyModel()).toBe('small');
    expect(local.modelPath('small')).toBe(join(other, small.file));
    await local.deleteModel('small');
    expect(existsSync(join(other, small.file))).toBe(true);
  });
});
