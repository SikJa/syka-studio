import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkSoundCatalog } from '../../../scripts/check-sound-catalog.mjs';

describe('installed sound integrity', () => {
  it('accepts a relocated bundle and prevents shipping corrupt or escaping assets', async () => {
    const docs = await mkdtemp(join(tmpdir(), 'syka-packaged-sounds-'));
    const folder = join(docs, 'resources', 'sounds');
    try {
      await mkdir(folder, { recursive: true });
      const bytes = Buffer.from('controlled content for packaging hash verification');
      const entry = { path: 'sound.wav', provider: 'Syka', audioType: 'sfx', duration: .1, license: 'MIT', sha256: createHash('sha256').update(bytes).digest('hex') };
      const save = () => writeFile(join(folder, 'catalog.json'), JSON.stringify({ version: 1, entries: [entry] }));
      await writeFile(join(folder, 'sound.wav'), bytes);
      await writeFile(join(folder, 'LICENSE-SYKA.txt'), 'MIT License');
      await save();
      expect(await checkSoundCatalog(docs)).toMatchObject({ count: 1, bytes: bytes.length });
      await writeFile(join(folder, 'sound.wav'), 'changed bytes');
      await expect(checkSoundCatalog(docs)).rejects.toThrow('hash mismatch');
      entry.path = '../sound.wav'; await save();
      await expect(checkSoundCatalog(docs)).rejects.toThrow('Invalid');
    } finally { await rm(docs, { recursive: true, force: true }); }
  });
});
