import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectFont, FontStore } from '../src/font-import';

const assets = fileURLToPath(new URL('../../../packages/runtime/src/fonts/assets/', import.meta.url));
describe('native font import', () => {
  it('uses internal family/weight/style names and verifies Spanish coverage', async () => {
    const [face] = inspectFont(await readFile(join(assets, 'InstrumentSerif-Italic.ttf')));
    expect(face!.metadata.family).toBe('Instrument Serif');
    expect(face!.metadata.style).toBe('italic');
    expect(face!.metadata.weight).toBe('400');
    expect(face!.metadata.missingSpanish).toEqual([]);
  });
  it('extracts every TTC face and produces valid standalone SFNT checksums', async () => {
    const files = await Promise.all(['Montserrat-ExtraBold.ttf', 'InstrumentSerif-Italic.ttf'].map(f => readFile(join(assets, f))));
    const header = 20;
    const collection = Buffer.alloc(header + files.reduce((n, b) => n + ((b.length + 3) & ~3), 0));
    collection.write('ttcf'); collection.writeUInt32BE(0x10000, 4); collection.writeUInt32BE(2, 8);
    let offset = header;
    files.forEach((file, index) => {
      collection.writeUInt32BE(offset, 12 + index * 4);
      file.copy(collection, offset);
      for (let i = 0; i < file.readUInt16BE(4); i++) {
        const record = offset + 12 + i * 16;
        collection.writeUInt32BE(collection.readUInt32BE(record + 8) + offset, record + 8);
      }
      offset += (file.length + 3) & ~3;
    });
    const faces = inspectFont(collection);
    expect(faces.map(f => [f.metadata.weight, f.metadata.style])).toEqual([['800', 'normal'], ['400', 'italic']]);
    for (const face of faces) {
      expect(inspectFont(face.bytes)[0]!.metadata).toEqual(face.metadata);
      let sum = 0;
      for (let p = 0; p < face.bytes.length; p += 4) sum = (sum + face.bytes.readUInt32BE(p)) >>> 0;
      expect(sum).toBe(0xb1b0afba);
    }
  });
  it('copies user fonts, survives a restart and reports invalid files without losing good imports', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'syka-font-import-'));
    try {
      const source = join(temp, 'renamed.ttf');
      await writeFile(source, await readFile(join(assets, 'Montserrat-ExtraBold.ttf')));
      const bad = join(temp, 'bad.otf'); await writeFile(bad, 'not a font');
      const store = new FontStore(join(temp, 'profile'));
      const imported = await store.import([source, bad]);
      expect(imported.errors).toHaveLength(1);
      expect(imported.fonts).toHaveLength(1);
      expect(imported.fonts[0]!.family).toContain('Montserrat');
      await rm(source);
      const restored = await new FontStore(join(temp, 'profile')).list();
      expect(restored.fonts).toEqual(imported.fonts);
      expect((await store.import([join(assets, 'Montserrat-ExtraBold.ttf')])).fonts).toHaveLength(1);
    } finally { await rm(temp, { recursive: true, force: true }); }
  });
});
