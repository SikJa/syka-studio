import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, rmdir, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const STORAGE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ManagedStorageJob = { version: 1; id: string; kind: 'video-import' | 'reference-download'; base: string; path: string; createdAt: number; ownerPids: number[]; finishedAt?: number };
export type ManagedTrash = { version: 1; id: string; kind: 'reference' | 'recording'; base: string; originalPath: string; name: string; discardedAt: number; payloadPath: string };
const equivalent = (a: string, b: string) => process.platform === 'win32' ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b);

/** Reject junctions, symlinks and traversal in every component within the owned root. */
export async function verifiedStoragePath(base: string, path: string): Promise<string> {
  if (!isAbsolute(base) || !isAbsolute(path)) throw Error('Ruta de almacenamiento inválida.');
  base = resolve(base); path = resolve(path);
  const rel = relative(base, path);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) throw Error('La ruta sale del almacenamiento autorizado.');
  if (!equivalent(await realpath(base), base) || (await lstat(base)).isSymbolicLink()) throw Error('El almacenamiento apunta a un enlace externo.');
  let cursor = base;
  for (const part of rel.split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    if ((await lstat(cursor)).isSymbolicLink()) throw Error('No se limpian enlaces ni uniones de carpetas.');
  }
  if (!equivalent(await realpath(path), path)) throw Error('La ruta real no coincide con el destino autorizado.');
  return path;
}

/** Create owned subdirectories one at a time, checking existing parents first. */
export async function ensureStorageDirectory(base: string, path: string): Promise<void> {
  await verifiedStoragePath(base, base);
  const rel = relative(resolve(base), resolve(path));
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) throw Error('El directorio sale del almacenamiento autorizado.');
  let current = resolve(base);
  for (const part of rel.split(sep).filter(Boolean)) {
    await verifiedStoragePath(base, current); current = join(current, part);
    await mkdir(current).catch(error => { if (error.code !== 'EEXIST') throw error; });
    await verifiedStoragePath(base, current);
    if (!(await lstat(current)).isDirectory()) throw Error('El destino no es una carpeta.');
  }
}

export async function atomicStorageJson(path: string, value: unknown): Promise<void> {
  const pending = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(pending, 'wx');
    try { await file.writeFile(JSON.stringify(value)); await file.sync(); } finally { await file.close(); }
    await rename(pending, path);
  } finally { await unlink(pending).catch(() => {}); }
}

export async function storageJson<T>(base: string, path: string): Promise<T> {
  await verifiedStoragePath(base, path);
  const info = await lstat(path);
  if (!info.isFile() || info.size > 16_384) throw Error('Registro de almacenamiento inválido.');
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

export async function createStorageJob(runtime: string | undefined, job: Omit<ManagedStorageJob, 'version' | 'createdAt' | 'ownerPids'>): Promise<void> {
  if (!runtime) return;
  if (!STORAGE_UUID.test(job.id)) throw Error('Identificador temporal inválido.');
  await verifiedStoragePath(job.base, job.path);
  const root = join(runtime, 'storage', 'jobs'); await ensureStorageDirectory(runtime, root);
  await verifiedStoragePath(runtime, root);
  const record: ManagedStorageJob = { ...job, version: 1, createdAt: Date.now(), ownerPids: [process.pid] };
  const file = await open(join(root, `${job.id}.json`), 'wx');
  try { await file.writeFile(JSON.stringify(record)); await file.sync(); } finally { await file.close(); }
}

export async function finishStorageJob(runtime: string | undefined, id: string): Promise<void> {
  if (!runtime || !STORAGE_UUID.test(id)) return;
  const path = join(runtime, 'storage', 'jobs', `${id}.json`);
  try {
    const job = await storageJson<ManagedStorageJob>(runtime, path);
    const exists = await lstat(job.path).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
    if (!exists) { await unlink(path); return; }
    await atomicStorageJson(path, { ...job, ownerPids: [], finishedAt: Date.now() });
  } catch { /* An unavailable ledger never changes the completed media operation. */ }
}

const ownerWrites = new Map<string, Promise<unknown>>();
export async function addStorageJobOwner(runtime: string | undefined, id: string, pid: number | undefined): Promise<void> {
  if (!runtime || !STORAGE_UUID.test(id) || !pid || !Number.isSafeInteger(pid) || pid <= 0) return;
  const path = join(runtime, 'storage', 'jobs', `${id}.json`);
  const update = (ownerWrites.get(path) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const job = await storageJson<ManagedStorageJob>(runtime, path);
    if (job.finishedAt !== undefined) return;
    await atomicStorageJson(path, { ...job, ownerPids: [...new Set([...job.ownerPids, pid])].slice(0, 64) });
  });
  ownerWrites.set(path, update);
  try { await update; } finally { if (ownerWrites.get(path) === update) ownerWrites.delete(path); }
}

export async function settleStorageOwners(runtime: string | undefined, id: string): Promise<void> {
  if (runtime) await ownerWrites.get(join(runtime, 'storage', 'jobs', `${id}.json`))?.catch(() => {});
}

/** Explicit discards only. Never used for ordinary attachments or project media. */
export async function moveToStorageTrash(runtime: string, base: string, path: string, kind: ManagedTrash['kind'], name: string): Promise<string> {
  await verifiedStoragePath(base, path);
  if (!(await lstat(path)).isDirectory()) throw Error('El elemento descartado no es una carpeta propia de Syka.');
  const parent = kind === 'reference' ? join(base, '03 Assets reutilizables', 'Referencias') : join(base, '03 Assets reutilizables', 'Adjuntos', 'screen-recordings');
  const stem = kind === 'reference' ? path.slice(dirname(path).length + 1).replace(/^ref-/, '') : path.slice(dirname(path).length + 1);
  if (!equivalent(dirname(path), parent) || !STORAGE_UUID.test(stem) || kind === 'reference' && !path.endsWith('ref-' + stem)) throw Error('Sólo se descartan referencias o grabaciones creadas por Syka.');
  const id = randomUUID(), folder = join(runtime, 'storage', 'trash', id);
  // Keep the payload on the project's volume: moving a 2 GB video must not copy it.
  const local = join(base, '.syka', 'storage-trash', id), payloadPath = join(local, 'payload');
  await ensureStorageDirectory(base, local); await ensureStorageDirectory(runtime, folder);
  await atomicStorageJson(join(folder, 'item.json'), { version: 1, id, base: resolve(base), kind, originalPath: resolve(path), name: name.slice(0, 160), discardedAt: Date.now(), payloadPath } satisfies ManagedTrash);
  // Both absolute destinations have been checked. EXDEV leaves the original intact.
  try { await rename(await verifiedStoragePath(base, path), payloadPath); }
  catch (error) {
    await unlink(join(folder, 'item.json')).catch(() => {});
    await rmdir(await verifiedStoragePath(base, local)).catch(() => {});
    await rmdir(await verifiedStoragePath(runtime, folder)).catch(() => {});
    throw Error('No se pudo mover a la papelera; el original se conserva.', { cause: error });
  }
  return id;
}
