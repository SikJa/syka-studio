/* MPL-2.0. Only disposable temporary fixtures; never the real Recycle Bin. */
import { tmpdir } from 'node:os';
import { mkdir, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, parse, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAIN_CHANNELS, MAIN_WIRE } from './main-channels';
import { deleteProjectWithCleanup } from './project-delete';

const native = vi.hoisted(() => ({trash: vi.fn()}));
vi.mock('electron', () => ({app: {isPackaged: false, getPath: () => tmpdir()}, dialog: {}, shell: {trashItem: native.trash}, ipcMain: {on: () => {}}}));
const {deleteProject, watchProject, unwatchAll} = await import('./projects');

let root: string;
const changed: Array<{dir: string; path: string}> = [];
const window = {
  isDestroyed: () => false,
  webContents: {isLoading: () => false, send: (wire: string, envelope: {channel: string; data: {dir: string; path: string}}) => {
    if (wire === MAIN_WIRE.EVENT && envelope.channel === MAIN_CHANNELS.PROJECTS_CHANGED) changed.push(envelope.data);
  }},
} as unknown as Parameters<typeof watchProject>[0];
async function fixture(name = 'project', projectId: string | null = 'fixture-project-id') {
  const dir = join(root, name);await mkdir(dir);
  await writeFile(join(dir, 'index.tsx'), 'export default () => null;\n');
  await writeFile(join(dir, 'package.json'), JSON.stringify({name, main: 'index.tsx', ...(projectId ? {projectId} : {})}));
  await writeFile(join(dir, 'original-media.txt'), 'original media fixture');
  return dir;
}
beforeEach(async () => {root=await mkdtemp(join(tmpdir(), 'syka-project-delete-'));changed.length=0;native.trash.mockReset();});
afterEach(async () => {
  unwatchAll();vi.restoreAllMocks();
  expect(dirname(root)).toBe(resolve(tmpdir()));expect(basename(root)).toMatch(/^syka-project-delete-/);
  await rm(root, {recursive: true, force: true});
});

describe('project deletion', () => {
  it('moves the exact project fixture through the native trash bridge before cleaning its chats', async () => {
    const dir=await fixture(), discarded=join(root, 'simulated-recycle-bin');
    const order: string[]=[];
    native.trash.mockImplementation(async (path: string) => {expect(path).toBe(resolve(dir));order.push('trash');await rename(path, discarded);});
    const cleanupChats=vi.fn(async (id: string) => {order.push('chats');expect(id).toBe('fixture-project-id');await expect(stat(dir)).rejects.toMatchObject({code: 'ENOENT'});});
    await expect(deleteProjectWithCleanup(dir, {trash: deleteProject, cleanupChats})).resolves.toBeUndefined();
    expect(order).toEqual(['trash', 'chats']);expect(native.trash).toHaveBeenCalledOnce();expect(cleanupChats).toHaveBeenCalledOnce();
    expect(await readFile(join(discarded, 'original-media.txt'), 'utf8')).toBe('original media fixture');
    expect(JSON.parse(await readFile(join(discarded, 'package.json'), 'utf8')).projectId).toBe('fixture-project-id');
  });
  it('does not reject a successful trash when chat bookkeeping fails', async () => {
    const dir=await fixture(), discarded=join(root, 'simulated-recycle-bin');
    native.trash.mockImplementation((path: string) => rename(path, discarded));
    const warn=vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(deleteProjectWithCleanup(dir, {trash: deleteProject, cleanupChats: () => {throw Error('private provider detail');}})).resolves.toBeUndefined();
    expect(await readFile(join(discarded, 'original-media.txt'), 'utf8')).toBe('original media fixture');
    expect(warn).toHaveBeenCalledWith('[projects] Project moved to trash; chat cleanup could not be confirmed.');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private provider detail');
  });
  it('preserves files and chats and restores the external-change watcher when native trash fails', async () => {
    const dir=await fixture();watchProject(window, dir);
    native.trash.mockRejectedValue(Object.assign(Error('Native trash unavailable'), {code: 'EBUSY'}));
    const cleanupChats=vi.fn();
    await expect(deleteProjectWithCleanup(dir, {trash: deleteProject, cleanupChats})).rejects.toMatchObject({code: 'EBUSY'});
    expect(cleanupChats).not.toHaveBeenCalled();
    expect(await readFile(join(dir, 'original-media.txt'), 'utf8')).toBe('original media fixture');
    expect(JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')).projectId).toBe('fixture-project-id');
    changed.length=0;await writeFile(join(dir, 'index.tsx'), 'export default () => "outside edit";\n');
    await vi.waitFor(() => expect(changed).toContainEqual({dir, path: 'index.tsx'}), {timeout: 4000});
  });
  it('closes a watcher registered through a junction alias without detaching another project', async () => {
    const dir=await fixture(), other=await fixture('other'), alias=join(root, 'project-alias'), discarded=join(root, 'simulated-recycle-bin');
    await symlink(dir, alias, process.platform === 'win32' ? 'junction' : 'dir');
    watchProject(window, alias);watchProject(window, other);
    native.trash.mockImplementation((path: string) => rename(path, discarded));
    await deleteProject(dir);changed.length=0;
    await writeFile(join(discarded, 'index.tsx'), 'export default () => "trashed fixture edit";\n');
    await writeFile(join(other, 'index.tsx'), 'export default () => "other project edit";\n');
    await vi.waitFor(() => expect(changed).toContainEqual({dir: other, path: 'index.tsx'}), {timeout: 4000});
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(changed.some(change => change.dir === alias || change.dir === dir)).toBe(false);
  });
  it('rejects relative paths, drive roots and non-project folders without invoking trash', async () => {
    const ordinary=join(root, 'ordinary');await mkdir(ordinary);await writeFile(join(ordinary, 'keep.txt'), 'keep');
    await expect(deleteProject('relative/project')).rejects.toThrow('ruta absoluta');
    await expect(deleteProject(parse(root).root)).rejects.toThrow('proyecto en esa carpeta');
    await expect(deleteProject(ordinary)).rejects.toThrow('proyecto en esa carpeta');
    await expect(deleteProject(join(root, 'missing'))).rejects.toThrow('proyecto en esa carpeta');
    expect(native.trash).not.toHaveBeenCalled();expect(await readFile(join(ordinary, 'keep.txt'), 'utf8')).toBe('keep');
  });
  it('can trash a legacy project without deleting an unrelated empty chat identity', async () => {
    const dir=await fixture('legacy', null);native.trash.mockResolvedValue(undefined);
    const cleanupChats=vi.fn();
    await expect(deleteProjectWithCleanup(dir, {trash: deleteProject, cleanupChats})).resolves.toBeUndefined();
    expect(cleanupChats).not.toHaveBeenCalled();
  });
  it('can trash a recorded project whose source entry is missing', async () => {
    const dir=await fixture();await rename(join(dir, 'index.tsx'), join(dir, 'saved-source.txt'));
    native.trash.mockResolvedValue(undefined);
    await expect(deleteProject(dir)).resolves.toBe('fixture-project-id');
    expect(native.trash).toHaveBeenCalledWith(resolve(dir));
  });
});
