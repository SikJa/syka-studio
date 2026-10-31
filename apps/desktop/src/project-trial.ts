import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

const textTypes = new Set(['.tsx', '.ts', '.jsx', '.js', '.css', '.json', '.yml', '.yaml', '.md']);
async function digest(file: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

/** An isolated editing workspace, not a Git branch. Never writes to the source. */
export async function copyProjectTrial(dir: string, parentId: string, displayName: string) {
  const source = await realpath(dir);
  const files = new Map<string, string>();
  const scan = async (folder: string) => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name), path = relative(source, file);
      if (folder === source && entry.name === '.git') continue;
      // Keep approved project decisions, not another edition's locks, sessions or undo history.
      if (folder === join(source, '.syka') && entry.name !== 'editing-recipe.json') continue;
      const info = await lstat(file);
      if (info.isSymbolicLink()) throw Error(`La versión de prueba necesita archivos independientes: ${path} es un enlace. No se modificó el original.`);
      if (folder === join(source, '.syka') && !info.isFile()) throw Error('La receta del proyecto debe ser un archivo independiente.');
      if (info.isDirectory()) await scan(file);
      else if (info.isFile()) files.set(path, await digest(file));
      else throw Error(`No se puede copiar este tipo de archivo: ${path}`);
    }
  };
  await scan(source);
  const id = randomUUID(), target = join(dirname(source), `${basename(source)}-prueba-${id.slice(0, 8)}`);
  // A failed/in-progress copy is nested outside the project's scan level.
  const stagingRoot = join(dirname(source), '.syka-trials');
  await mkdir(stagingRoot, { recursive: true });
  if (resolve(await realpath(stagingRoot)) !== resolve(stagingRoot)) throw Error('La carpeta de versiones no puede ser un enlace.');
  const staging = await mkdtemp(join(stagingRoot, 'pending-'));
  for (const [path, expected] of files) {
    const from = join(source, path), to = join(staging, path);
    if (await realpath(from) !== from || (await lstat(from)).isSymbolicLink()) throw Error('Cambió una ruta del proyecto durante la copia.');
    await mkdir(dirname(to), { recursive: true });
    await copyFile(from, to);
    if (await digest(to) !== expected) throw Error('El proyecto cambió durante la copia. Volvé a intentar cuando termine de guardar.');
    if (textTypes.has(extname(path).toLowerCase())) {
      const content = await readFile(to, 'utf8');
      if (!content.includes('\0')) {
        let rebased = content;
        for (const fromRoot of new Set([dir, source])) {
          for (const [oldPath, newPath] of [[fromRoot.replaceAll('\\', '\\\\'), target.replaceAll('\\', '\\\\')], [fromRoot.replaceAll('\\', '/'), target.replaceAll('\\', '/')], [fromRoot, target]]) {
            // Only rewrite descendants, never another folder with a shared prefix.
            for (const slash of ['/', '\\\\', '\\']) rebased = rebased.replaceAll(oldPath + slash, newPath + slash);
          }
        }
        if (rebased !== content) await writeFile(to, rebased);
      }
    }
  }
  const before = new Map(files); files.clear(); await scan(source);
  if (files.size !== before.size || [...before].some(([path, hash]) => files.get(path) !== hash)) throw Error('El proyecto cambió durante la copia. La original sigue intacta; volvé a intentar.');
  const pkg = JSON.parse(await readFile(join(staging, 'package.json'), 'utf8'));
  const trialOf = { id: parentId, displayName, createdAt: new Date().toISOString() };
  await writeFile(join(staging, 'package.json'), JSON.stringify({ ...pkg, projectId: id, displayName: `${displayName} · Prueba`, trialOf }, null, 2) + '\n');
  await rename(staging, target);
  return target;
}
