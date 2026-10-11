import { lstat, readdir, rename, rm, rmdir, statfs, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { STORAGE_UUID, storageJson, verifiedStoragePath, type ManagedStorageJob, type ManagedTrash } from '../../../../packages/agent-chat/src/host/storage-ledger';
import { StoragePolicyStore } from './store';
import { cacheEvictions } from './eligibility';
import type { CleanupCategory, CleanupReport, CleanupTotals, StorageOverview, StoragePolicy, StorageTrashEntry } from './types';

const DAY = 86_400_000;
const empty = (): CleanupTotals => ({ cache: { bytes: 0, files: 0 }, temporary: { bytes: 0, files: 0 }, trash: { bytes: 0, files: 0 } });
const same = (a: string, b: string) => process.platform === 'win32' ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b);
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; } };
type Candidate = { base: string; path: string; category: CleanupCategory; bytes: number; files: number; time: number; ledger?: string; job?: ManagedStorageJob; trash?: ManagedTrash };
type Inventory = { candidates: Candidate[]; partial: boolean; skipped: number; trash: StorageTrashEntry[] };
type Options = { runtime: string; profile: string; busy?: () => boolean; idle?: () => boolean; now?: () => number; log?: (message: string) => void };

/** Only owned cache files, registered processing directories and explicit discards.
 * Project roots, originals, exports, chats, credentials and ordinary attachments
 * are never candidates, regardless of their age or available disk space.
 */
export class StorageService {
  readonly store: StoragePolicyStore;
  private tail: Promise<unknown> = Promise.resolve();
  private lastCleanup?: CleanupReport;
  private checkedAt = 0;
  private timer?: ReturnType<typeof setInterval>;
  private startup?: ReturnType<typeof setTimeout>;
  private autoPending = false;
  private readonly options: Options;
  constructor(options: Options) { this.options = options; this.store = new StoragePolicyStore(join(options.runtime, 'storage-policy.json')); }
  private now() { return this.options.now?.() ?? Date.now(); }

  private async tree(base: string, path: string): Promise<{ bytes: number; files: number }> {
    let bytes = 0, files = 0, visited = 0;
    const walk = async (current: string, depth: number): Promise<void> => {
      if (depth > 12 || ++visited > 10_000) throw Error('Medición parcial.');
      const verified = await verifiedStoragePath(base, current), info = await lstat(verified);
      if (info.isFile()) { bytes += info.size; files++; }
      else if (info.isDirectory()) {
        for (const entry of await readdir(verified)) await walk(join(verified, entry), depth + 1);
      } else throw Error('Archivo especial protegido.');
      if (visited % 128 === 0) await new Promise<void>(done => setImmediate(done));
    };
    await walk(path, 0); return { bytes, files };
  }

  private async children(path: string, inventory: Inventory, base = this.options.runtime): Promise<string[]> {
    try {
      await verifiedStoragePath(base, path);
      const names = await readdir(path);
      if (names.length > 10_000) inventory.partial = true;
      return names.slice(0, 10_000);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { inventory.partial = true; inventory.skipped++; } return []; }
  }

  private validJob(job: ManagedStorageJob, id: string): boolean {
    if (job.version !== 1 || job.id !== id || !STORAGE_UUID.test(id) || !Number.isFinite(job.createdAt) || job.createdAt <= 0 || !Array.isArray(job.ownerPids) || job.ownerPids.some(pid => !Number.isSafeInteger(pid) || pid <= 0) || job.finishedAt !== undefined && (!Number.isFinite(job.finishedAt) || job.finishedAt <= 0)) return false;
    const expected = job.kind === 'video-import' ? join(this.options.runtime, 'video-imports', id)
      : job.kind === 'reference-download' ? join(job.base, '03 Assets reutilizables', 'Referencias', 'ref-' + id, 'download') : '';
    return !!expected && same(expected, job.path) && (job.kind !== 'video-import' || same(job.base, this.options.runtime));
  }

  private validTrash(item: ManagedTrash, id: string): boolean {
    if (item.version !== 1 || item.id !== id || !STORAGE_UUID.test(id) || typeof item.name !== 'string' || item.name.length > 160 || !Number.isFinite(item.discardedAt) || item.discardedAt <= 0) return false;
    const root = item.kind === 'reference' ? join(item.base, '03 Assets reutilizables', 'Referencias')
      : item.kind === 'recording' ? join(item.base, '03 Assets reutilizables', 'Adjuntos', 'screen-recordings') : '';
    const stem = item.kind === 'reference' ? basename(item.originalPath).replace(/^ref-/, '') : basename(item.originalPath);
    return !!root && same(dirname(item.originalPath), root) && STORAGE_UUID.test(stem)
      && (item.kind !== 'reference' || basename(item.originalPath) === 'ref-' + stem)
      && same(item.payloadPath, join(item.base, '.syka', 'storage-trash', id, 'payload'));
  }

  private async inventory(): Promise<Inventory> {
    const inventory: Inventory = { candidates: [], partial: false, skipped: 0, trash: [] };
    const cache = join(this.options.profile, 'providers', 'groq-transcripts');
    for (const name of await this.children(cache, inventory, this.options.profile)) {
      if (!/^[a-f0-9]{64}\.json$/i.test(name)) { inventory.skipped++; continue; }
      const path = join(cache, name);
      try {
        await verifiedStoragePath(this.options.profile, path);
        const info = await lstat(path); if (!info.isFile()) throw Error('Caché no válida.');
        inventory.candidates.push({ base: this.options.profile, path, category: 'cache', bytes: info.size, files: 1, time: info.mtimeMs });
      } catch { inventory.partial = true; inventory.skipped++; }
    }
    const jobs = join(this.options.runtime, 'storage', 'jobs');
    for (const name of await this.children(jobs, inventory)) {
      const id = name.replace(/\.json$/, ''); if (name !== id + '.json' || !STORAGE_UUID.test(id)) continue;
      const ledger = join(jobs, name);
      try {
        const job = await storageJson<ManagedStorageJob>(this.options.runtime, ledger);
        if (!this.validJob(job, id)) throw Error('Temporal no reconocido.');
        const measured = await this.tree(job.base, job.path);
        inventory.candidates.push({ base: job.base, path: job.path, category: 'temporary', ...measured, time: job.finishedAt ?? job.createdAt, job, ledger });
        if (job.ownerPids.some(alive)) inventory.skipped++;
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { inventory.partial = true; inventory.skipped++; } }
    }
    const trash = join(this.options.runtime, 'storage', 'trash');
    for (const id of await this.children(trash, inventory)) {
      if (!STORAGE_UUID.test(id)) continue;
      const ledger = join(trash, id, 'item.json');
      try {
        const item = await storageJson<ManagedTrash>(this.options.runtime, ledger);
        if (!this.validTrash(item, id)) throw Error('Papelera no reconocida.');
        const measured = await this.tree(item.base, item.payloadPath);
        inventory.candidates.push({ base: item.base, path: item.payloadPath, category: 'trash', ...measured, time: item.discardedAt, trash: item, ledger });
        inventory.trash.push({ id, name: item.name, originalPath: item.originalPath, discardedAt: item.discardedAt, ...measured });
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { inventory.partial = true; inventory.skipped++; } }
    }
    return inventory;
  }

  private eligible(inventory: Inventory, policy: StoragePolicy, forceCache = false): Candidate[] {
    const now = this.now(), selected = new Set<Candidate>();
    const expired = (time: number, days: number) => days > 0 && now - time >= days * DAY;
    const caches = inventory.candidates.filter(item => item.category === 'cache');
    for (const item of cacheEvictions(caches, policy, now, !inventory.partial, forceCache)) selected.add(item);
    for (const item of inventory.candidates) {
      if (!forceCache && item.category === 'temporary' && !item.job!.ownerPids.some(alive) && expired(item.time, policy.orphanDays)) selected.add(item);
      if (!forceCache && item.category === 'trash' && expired(item.time, policy.trashDays)) selected.add(item);
    }
    return [...selected];
  }

  private totals(items: Candidate[]): CleanupTotals {
    const totals = empty();
    for (const item of items) { totals[item.category].bytes += item.bytes; totals[item.category].files += item.files; }
    return totals;
  }

  async overview(): Promise<StorageOverview> {
    const state = await this.store.get(), inventory = await this.inventory();
    const availableBytes = await statfs(this.options.runtime).then(info => info.bsize * info.bavail).catch(() => undefined);
    return { ...state, runtime: this.options.runtime, availableBytes, totals: this.totals(inventory.candidates), eligible: this.totals(this.eligible(inventory, state.policy)), trash: inventory.trash.sort((a, b) => b.discardedAt - a.discardedAt), partial: inventory.partial, lastCleanup: this.lastCleanup };
  }

  clean(category: 'eligible' | 'cache', automatic = false): Promise<CleanupReport> {
    const operation = this.tail.catch(() => {}).then(async () => {
      const state = await this.store.get();
      if (this.options.busy?.()) throw Error('Hay una grabación, descarga o transcripción en curso. La limpieza espera a que termine.');
      if (automatic && !state.policy.automatic) return { at: this.now(), bytes: 0, files: 0, skipped: 0, failures: 0, automatic };
      const inventory = await this.inventory(), selected = this.eligible(inventory, state.policy, category === 'cache');
      const report: CleanupReport = { at: this.now(), bytes: 0, files: 0, skipped: inventory.skipped, failures: 0, automatic };
      for (const item of selected) {
        try {
          if (this.options.busy?.()) { report.skipped++; continue; }
          await verifiedStoragePath(item.base, item.path);
          if (item.job) {
            const current = await storageJson<ManagedStorageJob>(this.options.runtime, item.ledger!);
            if (!this.validJob(current, item.job.id) || current.ownerPids.some(alive) || JSON.stringify(current) !== JSON.stringify(item.job)) { report.skipped++; continue; }
          }
          const measured = await this.tree(item.base, item.path);
          if (item.category === 'cache') {
            // A cache hit refreshes mtime. Recheck before removing a just-used result.
            if ((await lstat(item.path)).mtimeMs !== item.time) { report.skipped++; continue; }
            await unlink(await verifiedStoragePath(item.base, item.path));
          } else {
            if (item.trash && JSON.stringify(await storageJson<ManagedTrash>(this.options.runtime, item.ledger!)) !== JSON.stringify(item.trash)) { report.skipped++; continue; }
            // Only a UUID-owned download/payload, verified again immediately before rm.
            await rm(await verifiedStoragePath(item.base, item.path), { recursive: true });
            await unlink(await verifiedStoragePath(this.options.runtime, item.ledger!));
            if (item.trash) {
              await rmdir(await verifiedStoragePath(item.base, dirname(item.path))).catch(() => {});
              await rmdir(await verifiedStoragePath(this.options.runtime, dirname(item.ledger!))).catch(() => {});
            }
          }
          report.bytes += measured.bytes; report.files += measured.files;
        } catch { report.failures++; }
        await new Promise<void>(done => setImmediate(done));
      }
      this.lastCleanup = report; return report;
    });
    this.tail = operation; return operation;
  }

  restore(id: string): Promise<void> {
    const operation = this.tail.catch(() => {}).then(async () => {
      if (!STORAGE_UUID.test(id)) throw Error('Elemento de papelera inválido.');
      const ledger = join(this.options.runtime, 'storage', 'trash', id, 'item.json');
      const item = await storageJson<ManagedTrash>(this.options.runtime, ledger);
      if (!this.validTrash(item, id)) throw Error('El registro de la papelera no es válido.');
      await verifiedStoragePath(item.base, dirname(item.originalPath));
      try { await lstat(item.originalPath); throw Error('Ya existe un archivo en esa ubicación. La recuperación no lo sobrescribió.'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const source = await verifiedStoragePath(item.base, item.payloadPath);
      // The checked source and target belong to the same project volume.
      await rename(source, item.originalPath);
      await unlink(ledger);
      await rmdir(await verifiedStoragePath(item.base, dirname(item.payloadPath))).catch(() => {});
      await rmdir(await verifiedStoragePath(this.options.runtime, dirname(ledger))).catch(() => {});
    });
    this.tail = operation; return operation;
  }

  async tick(): Promise<void> {
    if (this.autoPending || this.options.busy?.() || this.options.idle?.() === false) return;
    this.autoPending = true;
    try {
      const { policy } = await this.store.get();
      if (!policy.automatic || this.now() - this.checkedAt < policy.intervalMinutes * 60_000) return;
      await this.clean('eligible', true); this.checkedAt = this.now();
    } catch (error) { this.options.log?.(String(error)); }
    finally { this.autoPending = false; }
  }
  start(): void {
    if (this.timer) return;
    this.startup = setTimeout(() => void this.tick(), 60_000); this.startup.unref();
    this.timer = setInterval(() => void this.tick(), 60_000); this.timer.unref();
  }
  stop(): void { clearInterval(this.timer); clearTimeout(this.startup); this.timer = undefined; }
}
