import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
vi.mock('electron', () => ({ app: { getPath: () => '' } }));
import { defaultBrand, measureStorage, measureProjects, StudioSettingsStore } from './studio-settings';
const roots: string[] = [];
async function fixture() { const root = await mkdtemp(join(tmpdir(), 'syka-settings-')); roots.push(root); return { root, store: new StudioSettingsStore(join(root, 'studio-settings.json')) }; }
afterEach(async () => { for (const root of roots.splice(0)) { const absolute = resolve(root); if (!absolute.startsWith(resolve(tmpdir()) + '\\syka-settings-') && !absolute.startsWith(resolve(tmpdir()) + '/syka-settings-')) throw Error('Unsafe test cleanup'); await rm(absolute, { recursive: true, force: true }); } });
describe('persistent studio settings', () => {
  it('starts with local defaults without creating a file', async () => { const { store } = await fixture(); expect(await store.get()).toEqual({ revision: 0, brand: defaultBrand }); await expect(readFile(store.file)).rejects.toMatchObject({ code: 'ENOENT' }); });
  it('keeps a normalized brand after restarting the store', async () => { const { store } = await fixture(); await store.save(0, { ...defaultBrand, name: '  Syka QA  ', website: 'https://example.test', voice: 'Claro y directo', primary: '#aabbcc' }); expect(await new StudioSettingsStore(store.file).get()).toMatchObject({ revision: 1, brand: { name: 'Syka QA', primary: '#AABBCC', voice: 'Claro y directo' } }); });
  it('refuses competing or missing revisions without losing the saved brand', async () => { const { store } = await fixture(); const results = await Promise.allSettled([store.save(0, { ...defaultBrand, name: 'Uno' }), store.save(0, { ...defaultBrand, name: 'Dos' })]); expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']); await expect(store.save(undefined as unknown as number, defaultBrand)).rejects.toThrow('otra ventana'); expect((await store.get()).brand.name).toBe('Uno'); });
  it('rejects active logos, credential URLs and invalid colours', async () => { const { store } = await fixture(); for (const patch of [{ logo: 'data:image/svg+xml,<svg />' }, { website: 'https://user:secret@example.test' }, { primary: 'red' }, { font: '' }]) await expect(store.save(0, { ...defaultBrand, ...patch })).rejects.toThrow(); expect((await store.get()).revision).toBe(0); });
  it('preserves a corrupt file and refuses to overwrite it', async () => { const { store } = await fixture(); await writeFile(store.file, '{bad data'); await expect(store.get()).rejects.toThrow('original se conserva'); await expect(store.save(0, defaultBrand)).rejects.toThrow(); expect(await readFile(store.file, 'utf8')).toBe('{bad data'); });
  it('measures files without following a directory junction', async () => { const { root } = await fixture(); const area = join(root, 'area'), outside = join(root, 'other'); await mkdir(area); await mkdir(outside); await writeFile(join(area, 'owned.txt'), '12345'); await writeFile(join(outside, 'other.txt'), 'not ours'); await symlink(outside, join(area, 'link'), process.platform === 'win32' ? 'junction' : 'dir'); expect(await measureStorage('Local', area)).toMatchObject({ bytes: 5, files: 1, partial: false }); });
  it('measures every known project once and identifies missing folders', async () => {
    const { root } = await fixture(); const first = join(root, 'first'), second = join(root, 'second');
    await mkdir(first); await mkdir(second); await writeFile(join(first, 'media.mp4'), '12345'); await writeFile(join(second, 'source.tsx'), '123456789');
    const areas = await measureProjects([{ name: 'Uno', path: first }, { name: 'Duplicado', path: first + '/' }, { name: 'Dos', path: second }, { name: 'Desconectado', path: join(root, 'gone') }, { name: 'Relativo', path: 'relative-project' }]);
    expect(areas).toHaveLength(3); expect(areas[0]).toMatchObject({ name: 'Uno', bytes: 5, files: 1 }); expect(areas[1]).toMatchObject({ name: 'Dos', bytes: 9, files: 1 }); expect(areas[2]).toMatchObject({ name: 'Desconectado', unavailable: true });
    expect(areas[0].availableBytes).toBeGreaterThan(0);
  });
});
