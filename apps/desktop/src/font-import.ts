import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { basename, join } from 'node:path';

export interface ImportedFont {
  id: string;
  family: string;
  weight: string;
  style: 'normal' | 'italic';
  file: string;
  license: string;
  licenseUrl: string;
  missingSpanish: string[];
}
export interface FontCatalog {
  fonts: (ImportedFont & { source: string })[];
  errors: string[];
}
export type FontRequest = { action: 'list' | 'import' };
type Table = { tag: string; offset: number; length: number };

/** Reads actual OpenType names, variants and coverage; never trusts a filename. */
export function inspectFont(bytes: Buffer): { metadata: Omit<ImportedFont, 'id' | 'file'>; bytes: Buffer }[] {
  const check = (offset: number, length: number) => {
    if (!Number.isSafeInteger(offset) || offset < 0 || length < 0 || offset + length > bytes.length) throw Error('Archivo de fuente truncado.');
  };
  check(0, 12);
  const collection = bytes.toString('ascii', 0, 4) === 'ttcf';
  const count = collection ? bytes.readUInt32BE(8) : 1;
  if (!count || count > 64) throw Error('Colección de fuentes inválida.');
  check(12, collection ? count * 4 : 0);
  return Array.from({ length: count }, (_, index) => {
    const start = collection ? bytes.readUInt32BE(12 + index * 4) : 0;
    check(start, 12);
    const signature = bytes.toString('ascii', start, start + 4);
    if (bytes.readUInt32BE(start) !== 0x10000 && signature !== 'OTTO' && signature !== 'true') throw Error('Usá una fuente OTF, TTF o TTC válida.');
    const tableCount = bytes.readUInt16BE(start + 4);
    if (!tableCount || tableCount > 256) throw Error('Tablas OpenType inválidas.');
    check(start + 12, tableCount * 16);
    const tables: Table[] = Array.from({ length: tableCount }, (_, i) => {
      const offset = start + 12 + i * 16;
      const table = { tag: bytes.toString('ascii', offset, offset + 4), offset: bytes.readUInt32BE(offset + 8), length: bytes.readUInt32BE(offset + 12) };
      check(table.offset, table.length);
      return table;
    });
    const table = (tag: string) => {
      const entry = tables.find(t => t.tag === tag);
      if (!entry) throw Error(`Falta la tabla ${tag}.`);
      return bytes.subarray(entry.offset, entry.offset + entry.length);
    };
    const names = table('name');
    const nameCount = names.readUInt16BE(2), strings = names.readUInt16BE(4);
    const values = new Map<number, string>();
    // Prefer Unicode names over legacy Macintosh records.
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < nameCount; i++) {
      const at = 6 + i * 12;
      const platform = names.readUInt16BE(at), id = names.readUInt16BE(at + 6);
      const offset = strings + names.readUInt16BE(at + 10), length = names.readUInt16BE(at + 8);
      if (offset + length > names.length) throw Error('Nombre de fuente truncado.');
      if ((pass === 1) !== (platform === 0 || platform === 3)) continue;
      const raw = names.subarray(offset, offset + length);
      const text = platform === 0 || platform === 3 ? Buffer.from(raw).swap16().toString('utf16le') : raw.toString('latin1');
      if (!values.has(id) || pass === 1) values.set(id, text.replace(/\0/g, '').trim());
    }
    const family = values.get(16) || values.get(1);
    if (!family || family.length > 160) throw Error('La fuente no tiene un nombre de familia válido.');
    const os = table('OS/2');
    const weight = os.readUInt16BE(4);
    const italic = !!(os.readUInt16BE(62) & 1);
    const cmap = table('cmap');
    const spans: number[] = [];
    for (let i = 0; i < cmap.readUInt16BE(2); i++) {
      const at = 4 + i * 8, platform = cmap.readUInt16BE(at), encoding = cmap.readUInt16BE(at + 2);
      if (platform === 0 || (platform === 3 && [1, 10].includes(encoding))) spans.push(cmap.readUInt32BE(at + 4));
    }
    const hasGlyph = (code: number) => spans.some(at => {
      const format = cmap.readUInt16BE(at);
      if (format === 12) {
        const groups = cmap.readUInt32BE(at + 12);
        for (let i = 0; i < groups; i++) {
          const p = at + 16 + i * 12, first = cmap.readUInt32BE(p), last = cmap.readUInt32BE(p + 4);
          if (code >= first && code <= last) return cmap.readUInt32BE(p + 8) + code - first !== 0;
        }
      } else if (format === 4 && code <= 0xffff) {
        const n = cmap.readUInt16BE(at + 6) / 2, ends = at + 14, starts = ends + n * 2 + 2, deltas = starts + n * 2, ranges = deltas + n * 2;
        for (let i = 0; i < n; i++) {
          const first = cmap.readUInt16BE(starts + i * 2), last = cmap.readUInt16BE(ends + i * 2);
          if (code < first || code > last) continue;
          const delta = cmap.readInt16BE(deltas + i * 2), range = cmap.readUInt16BE(ranges + i * 2);
          if (!range) return ((code + delta) & 0xffff) !== 0;
          const glyph = cmap.readUInt16BE(ranges + i * 2 + range + (code - first) * 2);
          return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
        }
      }
      return false;
    });
    const metadata = {
      family, weight: String(Math.max(1, Math.min(1000, weight))), style: italic ? 'italic' as const : 'normal' as const,
      license: values.get(13) || values.get(0) || 'Licencia no incluida en el archivo; verificá los derechos de uso.',
      licenseUrl: values.get(14) || values.get(11) || '',
      missingSpanish: [...'áéíóúüñÁÉÍÓÚÜÑ¿¡'].filter(c => !hasGlyph(c.codePointAt(0)!)),
    };
    // A browser can load only the first face of a TTC. Extract every face as a
    // standalone SFNT, preserving all tables and recalculating its checksum.
    if (!collection) return { metadata, bytes };
    let cursor = 12 + tables.length * 16;
    const output = Buffer.alloc(cursor + tables.reduce((n, t) => n + ((t.length + 3) & ~3), 0));
    bytes.copy(output, 0, start, start + 12);
    let head = -1;
    for (const [i, entry] of tables.entries()) {
      const at = 12 + i * 16;
      output.write(entry.tag, at, 4, 'ascii');
      output.writeUInt32BE(cursor, at + 8);
      output.writeUInt32BE(entry.length, at + 12);
      bytes.copy(output, cursor, entry.offset, entry.offset + entry.length);
      if (entry.tag === 'head') { head = cursor; output.writeUInt32BE(0, head + 8); }
      let sum = 0;
      for (let p = cursor; p < cursor + entry.length; p += 4) sum = (sum + output.readUInt32BE(p)) >>> 0;
      output.writeUInt32BE(sum, at + 4);
      cursor += (entry.length + 3) & ~3;
    }
    let sum = 0;
    for (let p = 0; p < output.length; p += 4) sum = (sum + output.readUInt32BE(p)) >>> 0;
    if (head >= 0) output.writeUInt32BE((0xb1b0afba - sum) >>> 0, head + 8);
    return { metadata, bytes: output };
  });
}

/** User fonts belong to the native profile, never the app's distributable catalog. */
export class FontStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly root: string;
  constructor(root: string) { this.root = root; }
  private async entries(): Promise<ImportedFont[]> {
    try { return JSON.parse(await readFile(join(this.root, 'catalog.json'), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
  async list(): Promise<FontCatalog> {
    const fonts: FontCatalog['fonts'] = [], errors: string[] = [];
    for (const font of await this.entries()) {
      try {
        if (basename(font.file) !== font.file) throw Error('Ruta inválida.');
        const data = await readFile(join(this.root, font.file));
        fonts.push({ ...font, source: `url("data:font/${font.file.endsWith('.otf') ? 'otf' : 'ttf'};base64,${data.toString('base64')}")` });
      } catch { errors.push(`No se pudo cargar ${font.family}. Volvé a importarla.`); }
    }
    return { fonts, errors };
  }
  import(paths: string[]): Promise<FontCatalog> {
    const operation = this.queue.then(async () => {
      if (paths.length > 50) throw Error('Importá hasta 50 archivos por vez.');
      let entries = await this.entries();
      const errors: string[] = [];
      await mkdir(this.root, { recursive: true });
      for (const path of paths) {
        try {
          const data = await readFile(path);
          if (data.length > 16 * 1024 * 1024) throw Error('La fuente supera 16 MB.');
          const faces = inspectFont(data);
          for (const face of faces) {
            const id = createHash('sha256').update(face.bytes).digest('hex');
            const file = id + (face.bytes.toString('ascii', 0, 4) === 'OTTO' ? '.otf' : '.ttf');
            await writeFile(join(this.root, file), face.bytes);
            const font = { ...face.metadata, id, file };
            entries = entries.filter(f => !(f.family === font.family && f.weight === font.weight && f.style === font.style));
            entries.push(font);
          }
        } catch (error) { errors.push(`${basename(path)}: ${(error as Error).message}`); }
      }
      const temp = join(this.root, 'catalog.json.tmp');
      await writeFile(temp, JSON.stringify(entries, null, 2));
      await rename(temp, join(this.root, 'catalog.json'));
      const result = await this.list();
      return { ...result, errors: [...errors, ...result.errors] };
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
