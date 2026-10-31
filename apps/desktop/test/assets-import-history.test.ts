import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/main-manager', () => ({ mainBridge: { emit: vi.fn() } }));
vi.mock('electron', () => ({ app: { isPackaged: false }, dialog: {}, shell: {} }));
vi.mock('../../../packages/assets/src/probe', () => ({
  detectMimeType: async () => 'image/svg+xml', probeMedia: async () => ({ type: 'IMAGE', width: 120, height: 120 }),
  DEFAULT_SEQUENCE_FPS: 30, isSequenceListing: () => false, sortFrames: (entries: unknown[]) => entries,
}));
import { AssetLibrary } from '../../../packages/assets/src/library';
import type { ProjectFS } from '../../../packages/assets/src/fs';
import { readManifest, writeManifest, projectEditHistory, writeProject, unwatchAll } from '../src/projects';
import { formatSource } from '@diffusionstudio/jsx';

const qaRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.runtime/assets-import-tests');
let dir: string, fixture: string, media: string;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M1 0L120 120H0Z"/></svg>';
beforeEach(async () => {
  await mkdir(qaRoot, { recursive: true });
  fixture = await mkdtemp(join(qaRoot, 'import-'));
  dir = join(fixture, 'Proyecto con espacios'); media = join(fixture, 'Fuentes originales');
  await mkdir(dir); await mkdir(join(media, 'Fotos'), { recursive: true });
  await writeFile(join(dir, 'index.tsx'), 'export default () => <scene id="scene"><text id="title">Original</text></scene>;\n');
  await writeFile(join(media, 'uno.svg'), svg); await writeFile(join(media, 'Fotos/dos.svg'), svg.replace('M1', 'M2'));
  await writeManifest(dir, { version: 1, folders: [], assets: [] });
});
afterEach(async () => {
  unwatchAll();
  const check = relative(qaRoot, fixture);
  if (!check || check === '..' || check.startsWith('..' + sep)) throw Error('Unsafe fixture cleanup');
  await rm(fixture, { recursive: true, force: true });
});
function fsAdapter(): ProjectFS {
  const absolute = (source: string) => /^(?:[A-Za-z]:[\\/]|\/)/.test(source) ? source : join(dir, source);
  return {
    readManifest: () => readManifest(dir),
    writeManifest: (manifest, options) => writeManifest(dir, manifest, options),
    async list(source) { return readdir(absolute(source), { withFileTypes: true }).then(entries => Promise.all(entries.map(async entry => {
      const info = await stat(join(absolute(source), entry.name));
      return { name: entry.name, kind: entry.isDirectory() ? 'directory' as const : 'file' as const, size: info.size, mtime: info.mtimeMs };
    }))).catch(() => []); },
    async stat(source) { return stat(absolute(source)).then(info => ({ size: info.size, mtime: info.mtimeMs }), () => null); },
    async file(source) { const bytes = await readFile(absolute(source)); return new File([bytes], source.split(/[\\/]/).at(-1)!, { type: 'image/svg+xml' }); },
    async write() { throw Error('Manual import must link originals'); },
    async remove() { throw Error('Undo must never remove source media'); },
  };
}
describe('manual asset import and the shared undo journal', () => {
  it('imports a complete nested folder as one undo step, reloads and redoes without touching originals', async () => {
    const library = new AssetLibrary(fsAdapter());
    const result = await library.import([media], { folder: 'Referencias', recordHistory: true });
    expect(result.failed).toEqual([]); expect(result.assets).toHaveLength(2);
    expect(library.list().map(asset => asset.path).sort()).toEqual(['Referencias/Fuentes originales/Fotos/dos.svg', 'Referencias/Fuentes originales/uno.svg']);
    const journal = JSON.parse(await readFile(join(dir, '.syka/edit-history/journal.json'), 'utf8'));
    expect(journal.entries).toHaveLength(1); expect(journal.entries[0].label).toBe('Importar recursos');
    expect(await projectEditHistory(dir, 'undo')).toMatchObject({ ok: true, changed: true, path: 'assets.yml' });
    await library.load(); expect(library.list()).toHaveLength(0); expect([...library.folders()]).toHaveLength(0);
    expect(await readFile(join(media, 'uno.svg'), 'utf8')).toBe(svg);
    expect(await readFile(join(media, 'Fotos/dos.svg'), 'utf8')).toContain('M2');
    expect(await projectEditHistory(dir, 'redo')).toMatchObject({ ok: true, changed: true });
    await library.load(); expect(library.list()).toHaveLength(2);
    await library.dispose();
    const reopened = new AssetLibrary(fsAdapter()); await reopened.load(); expect(reopened.list()).toHaveLength(2); await reopened.dispose();
  });
  it('shares chronology with composition edits and ignores reimporting the same files', async () => {
    const library = new AssetLibrary(fsAdapter());
    await library.import([join(media, 'uno.svg')], { recordHistory: true });
    await library.import([join(media, 'uno.svg')], { recordHistory: true });
    expect(JSON.parse(await readFile(join(dir, '.syka/edit-history/journal.json'), 'utf8')).entries).toHaveLength(1);
    const result = await writeProject(dir, [{ kind: 'set', source: formatSource('index.tsx', 'title'), props: {}, text: 'Editado' }]);
    expect(result.error).toBeUndefined();
    await projectEditHistory(dir, 'undo'); expect(await readFile(join(dir, 'index.tsx'), 'utf8')).toContain('Original');
    await library.load(); expect(library.list()).toHaveLength(1);
    await projectEditHistory(dir, 'undo'); await library.load(); expect(library.list()).toHaveLength(0);
    await library.dispose();
  });
  it('preserves an externally changed manifest and reports the stale-history conflict', async () => {
    const library = new AssetLibrary(fsAdapter()); await library.import([join(media, 'uno.svg')], { recordHistory: true });
    const file = join(dir, 'assets.yml'); const external = (await readFile(file, 'utf8')) + '\n# cambio externo\n'; await writeFile(file, external);
    expect(await projectEditHistory(dir, 'undo')).toMatchObject({ ok: false });
    expect(await readFile(file, 'utf8')).toBe(external); await library.dispose();
  });
  it('preserves generation metadata written after import while undoing only the imported files', async () => {
    const library = new AssetLibrary(fsAdapter()); await library.import([media], { recordHistory: true, directory: true });
    const current = await readManifest(dir) as { folders: string[]; assets: unknown[] };
    const partial = { id: 'later-generation', type: 'VIDEO', path: 'Generados/motion.mp4', state: 'pending', generation: { key: 'later-generation' } };
    await writeManifest(dir, { ...current, folders: [...current.folders, 'Generados'], assets: [partial, ...current.assets] });
    expect(await projectEditHistory(dir, 'undo')).toMatchObject({ ok: true, changed: true });
    await library.load(); expect(library.list()).toHaveLength(0); expect(library.partials()).toHaveLength(1);
    expect(library.partials()[0].id).toBe('later-generation'); expect([...library.folders()]).toContain('Generados');
    expect(await projectEditHistory(dir, 'redo')).toMatchObject({ ok: true, changed: true });
    await library.load(); expect(library.list()).toHaveLength(2); expect(library.partials()).toHaveLength(1);
    await library.dispose();
  });
});
