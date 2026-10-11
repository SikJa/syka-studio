import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, sep } from 'node:path';
import { DapiError } from '@diffusionstudio/dapi';

const SOURCE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.html', '.svg', '.yaml', '.yml']);
const SKIP = new Set(['node_modules', 'assets', 'cache', 'exports', 'reviews', 'dist', 'build',
  '01 crudos', '01crudos', '02 finales', '02finales', '03 assets reutilizables', '03assetsreutilizables', '90 descartable', '90descartable']);
const MAX_FILES = 2048, MAX_BYTES = 32 * 1024 * 1024;
const BABEL_FILES = new Set(['.babelrc', '.babelrc.json', '.babelrc.js', '.babelrc.cjs']);

/** Read-only fingerprint: independent of undo history, bounded, with no media or hidden-folder scans. */
export async function projectSourceRevision(dir: string): Promise<{ revision: string }> {
  const root = await realpath(dir), files: string[] = [];
  let visited = 0;
  const inside = (path: string) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep); };
  async function visit(folder: string, depth: number): Promise<void> {
    if (depth > 24) throw new DapiError('invalid-input', 'La fuente tiene demasiados niveles para revisarla.');
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (++visited > 8192) throw new DapiError('invalid-input', 'La carpeta tiene demasiadas entradas para una revisión interna.');
      const babel = folder === root && BABEL_FILES.has(entry.name);
      if ((entry.name.startsWith('.') && !babel) || entry.isSymbolicLink()) continue;
      // Library probing updates this metadata itself; it is not authoring source.
      if (folder === root && entry.name === 'assets.yml') continue;
      const path = join(folder, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name.toLowerCase())) await visit(path, depth + 1);
      } else if (entry.isFile() && (babel || SOURCE.has(extname(entry.name).toLowerCase()))) {
        if (files.length >= MAX_FILES) throw new DapiError('invalid-input', 'La revisión admite hasta 2048 archivos de fuente.');
        files.push(path);
      }
    }
  }
  await visit(root, 0);
  const hash = createHash('sha256');
  let bytes = 0;
  for (const file of files.sort()) {
    const actual = await realpath(file);
    if (!inside(actual)) throw new DapiError('invalid-input', 'Un archivo de fuente sale del proyecto.');
    const info = await stat(actual);
    if (!info.isFile() || bytes + info.size > MAX_BYTES) throw new DapiError('invalid-input', 'La fuente supera el límite de 32 MiB de revisión.');
    const content = await readFile(actual);
    bytes += content.length;
    if (bytes > MAX_BYTES) throw new DapiError('invalid-input', 'La fuente supera el límite de 32 MiB de revisión.');
    hash.update(relative(root, file).split(sep).join('/')).update('\0').update(String(content.length)).update('\0').update(content);
  }
  return { revision: hash.digest('hex') };
}
