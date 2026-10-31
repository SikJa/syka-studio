import { watch, type FSWatcher } from 'node:fs';
import { lstat, mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { basename, dirname, extname, isAbsolute, join, relative, sep } from 'node:path';

export type IndexedResourceFile = {
  path: string;
  name: string;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  sha256?: string;
};
const MAX_FILES = 20_000;
const MAX_INDEX_BYTES = 12 * 1024 * 1024;
const indexes = new Map<string, ResourceIndex>();
const inside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep);
};
const signature = (file: Pick<IndexedResourceFile, 'size' | 'mtimeMs' | 'ctimeMs'>) => `${file.size}:${file.mtimeMs}:${file.ctimeMs}`;
// Bumped by every observed or applied change, so callers can reuse results computed at the same revision.
let revision = 0;
export const resourceRevision = () => revision;
export const bumpResourceRevision = () => { revision++; };

/** One bounded, watched inventory per library. Search and pagination never walk it again. */
class ResourceIndex {
  readonly files = new Map<string, IndexedResourceFile>();
  readonly changes = new Set<string>();
  readonly metrics = { scans: 0, stats: 0, persistedHashes: 0 };
  private watcher?: FSWatcher;
  private initialized = false;
  private needsScan = true;
  private closed = false;
  private rootStamp = '';
  private lastScan = 0;
  private pending?: Promise<void>;
  private background?: Promise<void>;
  private savedStamp = '';
  private saveTimer?: ReturnType<typeof setTimeout>;
  private saving: Promise<void> = Promise.resolve();
  private saveVersion = 0;
  private catalogPaths?: readonly string[];
  private catalogKey = '';
  truncated = false;
  readonly root: string;
  readonly config: string;
  readonly extensions: readonly string[];
  constructor(root: string, config: string, extensions: readonly string[]) {
    this.root = root; this.config = config; this.extensions = extensions;
    try {
      this.watcher = watch(root, { recursive: true, persistent: false }, (_event, filename) => {
        revision++;
        if (!filename) this.needsScan = true;
        else {
          const path = join(root, filename.toString());
          if (path === dirname(this.cacheFile) || path.startsWith(dirname(this.cacheFile) + sep)) return;
          if (inside(root, path)) this.changes.add(path);
        }
      });
      this.watcher.on('error', () => { this.watcher?.close(); this.watcher = undefined; this.needsScan = true; });
    } catch { /* Periodic reconciliation remains available on filesystems without recursive watching. */ }
  }
  private get cacheFile() {
    const key = createHash('sha256').update(this.root + '\0' + this.extensions.join(',')).digest('hex').slice(0, 24);
    return join(dirname(this.config), 'resource-index', key + '.json');
  }
  private async restore() {
    try {
      if ((await stat(this.cacheFile)).size > MAX_INDEX_BYTES) return;
      const data = JSON.parse(await readFile(this.cacheFile, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.files) || data.files.length > MAX_FILES) return;
      if (typeof data.rootStamp === 'string') this.savedStamp = data.rootStamp;
      for (const file of data.files) {
        if (typeof file.path !== 'string' || isAbsolute(file.path)) continue;
        const path = join(this.root, file.path);
        if (!inside(this.root, path) || !this.extensions.includes(extname(path).toLowerCase())) continue;
        if (![file.size, file.mtimeMs, file.ctimeMs].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) continue;
        this.files.set(path, { ...file, path, name: basename(path), sha256: typeof file.sha256 === 'string' && /^[a-f0-9]{64}$/.test(file.sha256) ? file.sha256 : undefined });
      }
    } catch { /* A disposable index must never prevent opening the original library. */ }
  }
  private async inspect(path: string, old: Map<string, IndexedResourceFile>, target: Map<string, IndexedResourceFile>) {
    if (!this.extensions.includes(extname(path).toLowerCase())) return;
    this.metrics.stats++;
    try {
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink()) return;
      if (this.catalogPaths && !inside(this.root, await realpath(path))) return;
      const previous = old.get(path);
      const file: IndexedResourceFile = { path, name: basename(path), size: info.size, mtimeMs: info.mtimeMs, ctimeMs: info.ctimeMs };
      if (previous && signature(previous) === signature(file)) file.sha256 = previous.sha256;
      if (file.sha256) this.metrics.persistedHashes++;
      target.set(path, file);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  private async scan() {
    const next = new Map<string, IndexedResourceFile>();
    let visited = 0;
    this.truncated = false;
    const walk = async (dir: string, depth: number): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true });
      const paths: string[] = [];
      for (const entry of entries) {
        if (++visited > MAX_FILES) { this.truncated = true; break; }
        if (entry.isSymbolicLink()) continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory() && depth < 8 && !['node_modules', '.git'].includes(entry.name)) await walk(path, depth + 1);
        else if (entry.isFile()) paths.push(path);
      }
      // Bounded concurrency avoids serial disk roundtrips without flooding a large library.
      for (let i = 0; i < paths.length; i += 24) await Promise.all(paths.slice(i, i + 24).map(path => this.inspect(path, this.files, next)));
    };
    if (this.catalogPaths) {
      this.truncated = this.catalogPaths.length > MAX_FILES;
      const paths = this.catalogPaths.slice(0, MAX_FILES).filter(path => inside(this.root, path));
      for (let i = 0; i < paths.length; i += 24) await Promise.all(paths.slice(i, i+24).map(path=>this.inspect(path,this.files,next)));
    } else await walk(this.root, 0);
    this.files.clear();
    for (const [path, file] of next) this.files.set(path, file);
    revision++;
    this.metrics.scans++;
    this.lastScan = Date.now();
    this.scheduleSave();
  }
  private async reconcile() {
    const info = await stat(this.root);
    if (!info.isDirectory()) throw Error('La biblioteca no es una carpeta');
    const stamp = `${info.mtimeMs}:${info.ctimeMs}`;
    if (!this.initialized) {
      await this.restore(); this.initialized = true;
      // Answer from the saved inventory at once (a cold first page took 1.6 s)
      // and reconcile in the background; the watcher keeps later changes.
      if (this.files.size && !this.catalogPaths && this.savedStamp === stamp) {
        this.rootStamp = stamp; this.needsScan = false;
        this.background = this.scan().catch(() => { this.needsScan = true; }).finally(() => { this.background = undefined; });
        return;
      }
    }
    // A background reconciliation is already refreshing the inventory.
    if (this.background) return;
    if (this.rootStamp && stamp !== this.rootStamp) this.needsScan = true;
    this.rootStamp = stamp;
    if (this.needsScan || Date.now() - this.lastScan > (this.watcher ? 300_000 : 5_000)) {
      this.needsScan = false;
      this.changes.clear();
      try { await this.scan(); } catch (error) { this.needsScan = true; throw error; }
      return;
    }
    const changed = [...this.changes];
    this.changes.clear();
    for (const path of changed) {
      try {
        const info = await lstat(path);
        if (info.isDirectory()) { this.needsScan = true; continue; }
        const actual = await realpath(path);
        if (info.isSymbolicLink() || !inside(this.root, actual) || !this.extensions.includes(extname(path).toLowerCase())) { this.files.delete(path); continue; }
        await this.inspect(path, this.files, this.files);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        for (const key of this.files.keys()) if (key === path || key.startsWith(path + sep)) this.files.delete(key);
      }
    }
    if (this.needsScan) { this.needsScan = false; await this.scan(); }
    else if (changed.length) { revision++; this.scheduleSave(); }
  }
  async list(force = false) {
    // "Actualizar" must see the disk, not the saved inventory being reconciled.
    if (force) { await this.background?.catch(() => undefined); this.needsScan = true; }
    if (!this.pending) this.pending = this.reconcile().finally(() => { this.pending = undefined; });
    await this.pending;
    return [...this.files.values()];
  }
  catalog(paths?: readonly string[]) {
    const key = paths ? createHash('sha256').update(paths.join('\0')).digest('hex') : '';
    if (key !== this.catalogKey) { this.catalogKey = key; this.catalogPaths = paths; this.needsScan = true; }
  }
  remember(path: string, sha256: string, info: IndexedResourceFile) {
    const file = this.files.get(path);
    if (!file || signature(file) !== signature(info) || file.sha256 === sha256) return;
    file.sha256 = sha256;
    this.scheduleSave();
  }
  private scheduleSave() {
    if (this.closed) return;
    this.saveVersion++;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.saveTimer = undefined; void this.persist(); }, 1000);
    this.saveTimer.unref();
  }
  private persist() {
    const files = [...this.files.values()].map(({ name: _name, ...file }) => ({ ...file, path: relative(this.root, file.path) }));
    // rootStamp lets a reopen trust this inventory only while the root folder is unchanged.
    const body = JSON.stringify({ version: 1, rootStamp: this.rootStamp, files });
    const file = this.cacheFile;
    this.saving = this.saving.catch(() => undefined).then(async () => {
      if (Buffer.byteLength(body) > MAX_INDEX_BYTES) return;
      const temp = file + '.' + randomUUID() + '.tmp';
      try { await mkdir(dirname(file), { recursive: true }); await writeFile(temp, body, { flag: 'wx', mode: 0o600 }); await rename(temp, file); }
      finally { await unlink(temp).catch(() => undefined); }
    }).catch(() => undefined);
    return this.saving;
  }
  async close() {
    this.closed = true;
    this.watcher?.close();
    clearTimeout(this.saveTimer);
    await this.pending?.catch(() => undefined);
    await this.background?.catch(() => undefined);
    if (this.saveVersion) await this.persist();
    await this.saving;
  }
}

export async function resourceFiles(root: string, config: string, extensions: readonly string[], refresh = false, catalogPaths?: readonly string[]) {
  const key = config + '\0' + root + '\0' + extensions.join(',');
  let index = indexes.get(key);
  if (!index) {
    if (indexes.size >= 32) { const first = indexes.keys().next().value!; const old = indexes.get(first)!; indexes.delete(first); await old.close(); }
    index = new ResourceIndex(root, config, extensions);
    indexes.set(key, index);
  } else { indexes.delete(key); indexes.set(key, index); }
  index.catalog(catalogPaths);
  const files = await index.list(refresh);
  return { files, truncated: index.truncated, remember: (file: IndexedResourceFile, hash: string) => index.remember(file.path, hash, file) };
}

export function resourceIndexMetrics(config: string) {
  return [...indexes.values()].filter(index => index.config === config).map(index => ({ root: index.root, files: index.files.size, ...index.metrics }));
}
export async function closeResourceIndexes(config?: string) {
  // Closed indexes stop watching: results computed from them are no longer trustworthy.
  revision++;
  for (const [key, index] of indexes) if (!config || index.config === config) { indexes.delete(key); await index.close(); }
}
