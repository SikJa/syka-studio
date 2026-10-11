import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createStorageJob, finishStorageJob, moveToStorageTrash } from '../../../../packages/agent-chat/src/host/storage-ledger';
import { cacheEvictions } from './eligibility';
import { StorageService } from './service';
import { DEFAULT_STORAGE_POLICY } from './types';

const roots: string[] = [], DAY = 86_400_000, now = Date.UTC(2026, 9, 11, 12);
async function fixture(busy = () => false) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'syka-storage-'))); roots.push(base);
  const runtime = join(base, 'runtime'), profile = join(runtime, 'profile'), project = join(base, 'project');
  await mkdir(profile, { recursive: true }); await mkdir(project);
  const service = new StorageService({ runtime, profile, busy, now: () => now });
  return { base, runtime, profile, project, service };
}
async function cached(profile: string, char: string, age: number) {
  const root = join(profile, 'providers', 'groq-transcripts'); await mkdir(root, { recursive: true });
  const path = join(root, char.repeat(64) + '.json'); await writeFile(path, '{"words":[]}'); await utimes(path, (now - age * DAY) / 1000, (now - age * DAY) / 1000); return path;
}
async function job(f: Awaited<ReturnType<typeof fixture>>, kind: 'video-import' | 'reference-download', finished: boolean, age: number) {
  const id = randomUUID(), base = kind === 'video-import' ? f.runtime : f.project;
  const path = kind === 'video-import' ? join(base, 'video-imports', id) : join(base, '03 Assets reutilizables', 'Referencias', 'ref-' + id, 'download');
  await mkdir(path, { recursive: true }); await writeFile(join(path, 'source.part'), 'partial source');
  await createStorageJob(f.runtime, { id, kind, base, path });
  if (finished) await finishStorageJob(f.runtime, id);
  const ledger = join(f.runtime, 'storage', 'jobs', id + '.json'), data = JSON.parse(await readFile(ledger, 'utf8'));
  data.createdAt = now - age * DAY; if (finished) data.finishedAt = data.createdAt;
  await writeFile(ledger, JSON.stringify(data)); return { id, path, ledger };
}
async function discarded(f: Awaited<ReturnType<typeof fixture>>, age: number) {
  const path = join(f.project, '03 Assets reutilizables', 'Referencias', 'ref-' + randomUUID()); await mkdir(path, { recursive: true });
  await writeFile(join(path, 'frame.jpg'), 'original reference');
  const id = await moveToStorageTrash(f.runtime, f.project, path, 'reference', 'Mi referencia');
  const ledger = join(f.runtime, 'storage', 'trash', id, 'item.json'), item = JSON.parse(await readFile(ledger, 'utf8'));
  item.discardedAt = now - age * DAY; await writeFile(ledger, JSON.stringify(item)); return { id, path, ledger, item };
}
afterEach(async () => {
  for (const base of roots.splice(0)) {
    const root = resolve(base), temp = await realpath(tmpdir());
    if (!root.startsWith(temp + sep + 'syka-storage-') || (await lstat(root)).isSymbolicLink()) throw Error('Unsafe fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});

describe('storage preferences', () => {
  it('persists selected deadlines, survives restart and rejects competing changes', async () => {
    const f = await fixture(); expect((await f.service.store.get()).policy).toEqual(DEFAULT_STORAGE_POLICY);
    await f.service.store.save(0, { ...DEFAULT_STORAGE_POLICY, cacheDays: 7, trashDays: 30 });
    const restarted = new StorageService({ runtime: f.runtime, profile: f.profile });
    expect((await restarted.store.get()).policy).toMatchObject({ cacheDays: 7, trashDays: 30 });
    await expect(restarted.store.save(0, DEFAULT_STORAGE_POLICY)).rejects.toThrow('otra ventana');
  });
  it('rejects unsupported periods and stops cleanup when its configuration is corrupt', async () => {
    const f = await fixture(), path = await cached(f.profile, 'a', 45);
    await expect(f.service.store.save(0, { ...DEFAULT_STORAGE_POLICY, orphanDays: -1 })).rejects.toThrow();
    await writeFile(f.service.store.file, 'broken');
    await expect(f.service.clean('cache')).rejects.toThrow('limpieza se detuvo');
    expect(await readFile(f.service.store.file, 'utf8')).toBe('broken'); expect(await readFile(path, 'utf8')).toContain('words');
  });
});
describe('cache limits', () => {
  it('evicts the least recently used cache while preserving recent results and originals', () => {
    const items = [{ name: 'older', bytes: 200 * 1024 ** 2, time: now - 2 * DAY }, { name: 'used', bytes: 100 * 1024 ** 2, time: now - DAY }, { name: 'new', bytes: 50 * 1024 ** 2, time: now - 1000 }];
    expect([...cacheEvictions(items, { ...DEFAULT_STORAGE_POLICY, cacheLimitMB: 256 }, now, true)].map(item => item.name)).toEqual(['older']);
    expect(cacheEvictions(items, { ...DEFAULT_STORAGE_POLICY, cacheLimitMB: 256 }, now, false).size).toBe(0);
  });
  it('honors no expiry and no quota independently', () => {
    const items = [{ bytes: 5000 * 1024 ** 2, time: now - 180 * DAY }];
    expect(cacheEvictions(items, { ...DEFAULT_STORAGE_POLICY, cacheDays: 0, cacheLimitMB: 0 }, now, true).size).toBe(0);
    expect(cacheEvictions(items, { ...DEFAULT_STORAGE_POLICY, cacheDays: 0 }, now, true).size).toBe(1);
  });
});
describe('safe cleanup', () => {
  it('previews without deleting, removes stale cache and preserves recent cache, credentials and project media', async () => {
    const f = await fixture(), stale = await cached(f.profile, 'a', 31), recent = await cached(f.profile, 'b', 2);
    const media = join(f.project, 'video.mp4'), secret = join(f.profile, 'providers', 'groq.key.encrypted'); await writeFile(media, 'project original'); await writeFile(secret, 'credential fixture');
    const preview = await f.service.overview(); expect(preview.eligible.cache.files).toBe(1); expect(await readFile(stale, 'utf8')).toContain('words');
    expect(await f.service.clean('eligible')).toMatchObject({ files: 1, failures: 0 });
    await expect(lstat(stale)).rejects.toMatchObject({ code: 'ENOENT' }); expect(await readFile(recent, 'utf8')).toContain('words');
    expect(await readFile(media, 'utf8')).toBe('project original'); expect(await readFile(secret, 'utf8')).toBe('credential fixture');
  });
  it('never cleans an active download, even when it is old', async () => {
    const f = await fixture(), active = await job(f, 'video-import', false, 10), stopped = await job(f, 'video-import', true, 2);
    expect((await f.service.overview()).eligible.temporary.files).toBe(1);
    await f.service.clean('eligible'); expect(await readFile(join(active.path, 'source.part'), 'utf8')).toContain('partial'); await expect(lstat(stopped.path)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('cleans only the registered reference download and preserves its frames and source', async () => {
    const f = await fixture(), item = await job(f, 'reference-download', true, 2), evidence = resolve(item.path, '..');
    await writeFile(join(evidence, 'frame.jpg'), 'saved frame'); await writeFile(join(evidence, 'source.mp4'), 'retained source');
    await f.service.clean('eligible'); await expect(lstat(item.path)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(join(evidence, 'frame.jpg'), 'utf8')).toBe('saved frame'); expect(await readFile(join(evidence, 'source.mp4'), 'utf8')).toBe('retained source');
  });
  it('defers all cleanup during a recording or transcription', async () => {
    const f = await fixture(() => true), path = await cached(f.profile, 'a', 45);
    await expect(f.service.clean('cache')).rejects.toThrow('en curso'); await f.service.tick(); expect(await readFile(path, 'utf8')).toContain('words');
  });
  it('manages its cache when the profile and runtime are in separate directories', async () => {
    const f = await fixture(), profile = join(f.base, 'separate-profile'); await mkdir(profile);
    const path = await cached(profile, 'a', 45), service = new StorageService({ runtime: f.runtime, profile, now: () => now });
    expect((await service.overview()).eligible.cache.files).toBe(1);
    expect(await service.clean('eligible')).toMatchObject({ files: 1, failures: 0 });
    await expect(lstat(path)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('waits for idle time before automatic cleanup without blocking an explicit request', async () => {
    let idle = false;
    const f = await fixture(), service = new StorageService({ runtime: f.runtime, profile: f.profile, idle: () => idle, now: () => now });
    const automatic = await cached(f.profile, 'a', 45); await service.tick(); expect((await lstat(automatic)).isFile()).toBe(true);
    idle = true; await service.tick(); await expect(lstat(automatic)).rejects.toMatchObject({ code: 'ENOENT' });
    const manual = await cached(f.profile, 'b', 45); idle = false; await service.clean('eligible'); await expect(lstat(manual)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('does not follow a cache junction or a nested junction inside a registered download', async () => {
    const f = await fixture(), outside = join(f.base, 'outside'); await mkdir(outside); const original = join(outside, 'a'.repeat(64) + '.json'); await writeFile(original, 'external original');
    await mkdir(join(f.profile, 'providers')); await symlink(outside, join(f.profile, 'providers', 'groq-transcripts'), process.platform === 'win32' ? 'junction' : 'dir');
    const download = await job(f, 'video-import', true, 10); await symlink(outside, join(download.path, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    expect((await f.service.overview()).partial).toBe(true); await f.service.clean('cache'); await f.service.clean('eligible');
    expect(await readFile(original, 'utf8')).toBe('external original'); expect((await lstat(download.path)).isDirectory()).toBe(true);
  });
  it('ignores malformed ledger entries that point at an original or another project', async () => {
    const f = await fixture(), item = await job(f, 'video-import', true, 10), original = join(f.project, 'my-video.mp4'); await writeFile(original, 'original');
    const data = JSON.parse(await readFile(item.ledger, 'utf8')); data.path = original; await writeFile(item.ledger, JSON.stringify(data));
    await f.service.clean('eligible'); expect(await readFile(original, 'utf8')).toBe('original'); expect((await lstat(item.path)).isDirectory()).toBe(true);
  });
  it('honors disabled automatic cleanup while allowing a deliberate manual cleanup', async () => {
    const f = await fixture(), path = await cached(f.profile, 'a', 45); await f.service.store.save(0, { ...DEFAULT_STORAGE_POLICY, automatic: false });
    await f.service.tick(); expect(await readFile(path, 'utf8')).toContain('words'); await f.service.clean('cache'); await expect(lstat(path)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('runs automatic cleanup at the selected interval and postpones it while busy', async () => {
    let clock = now, busy = false;
    const f = await fixture(), service = new StorageService({ runtime: f.runtime, profile: f.profile, now: () => clock, busy: () => busy });
    await service.store.save(0, { ...DEFAULT_STORAGE_POLICY, intervalMinutes: 15 });
    const first = await cached(f.profile, 'a', 45); await service.tick(); await expect(lstat(first)).rejects.toMatchObject({ code: 'ENOENT' });
    const next = await cached(f.profile, 'b', 45); clock += 14 * 60_000; await service.tick(); expect((await lstat(next)).isFile()).toBe(true);
    clock += 60_000; busy = true; await service.tick(); expect((await lstat(next)).isFile()).toBe(true);
    busy = false; await service.tick(); await expect(lstat(next)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
describe('recoverable explicit discards', () => {
  it('keeps a recent discard and restores it without overwriting another file', async () => {
    const f = await fixture(), item = await discarded(f, 2); expect((await f.service.overview()).trash[0].name).toBe('Mi referencia');
    await f.service.clean('eligible'); await mkdir(item.path); await writeFile(join(item.path, 'frame.jpg'), 'new work');
    await expect(f.service.restore(item.id)).rejects.toThrow('no lo sobrescribió'); expect(await readFile(join(item.path, 'frame.jpg'), 'utf8')).toBe('new work');
    if (!resolve(item.path).startsWith(resolve(f.project) + sep)) throw Error('Unsafe fixture path'); await rm(item.path, { recursive: true });
    await f.service.restore(item.id); expect(await readFile(join(item.path, 'frame.jpg'), 'utf8')).toBe('original reference'); expect((await f.service.overview()).trash).toHaveLength(0);
  });
  it('expires only explicit discards after their selected retention and supports never expire', async () => {
    const f = await fixture(), expired = await discarded(f, 8), recent = await discarded(f, 2);
    await f.service.clean('eligible'); await expect(lstat(expired.item.payloadPath)).rejects.toMatchObject({ code: 'ENOENT' }); expect((await lstat(recent.item.payloadPath)).isDirectory()).toBe(true);
    const forever = await discarded(f, 180); await f.service.store.save(0, { ...DEFAULT_STORAGE_POLICY, trashDays: 0 }); await f.service.clean('eligible'); expect((await lstat(forever.item.payloadPath)).isDirectory()).toBe(true);
  });
});
