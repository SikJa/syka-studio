import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectSourceRevision } from './source-revision';

const folders: string[] = [];
afterEach(async () => { for (const dir of folders.splice(0)) await rm(dir, { recursive: true, force: true }); });
async function project() { const dir = await mkdtemp(join(tmpdir(), 'syka-preview-revision-')); folders.push(dir); return dir; }

describe('read-only preview source identity', () => {
  it('detects external edits and multi-file dependencies without consulting or resetting undo history', async () => {
    const dir = await project(); await mkdir(join(dir, 'src'));
    await writeFile(join(dir, 'index.tsx'), 'import { text } from "./src/text";');
    await writeFile(join(dir, 'src/text.ts'), 'export const text = "first";');
    await writeFile(join(dir, '.babelrc'), '{"plugins":[]}');
    const first = await projectSourceRevision(dir);
    expect(await projectSourceRevision(dir)).toEqual(first);
    await writeFile(join(dir, 'src/text.ts'), 'export const text = "other";');
    const second = await projectSourceRevision(dir); expect(second).not.toEqual(first);
    await writeFile(join(dir, '.babelrc'), '{"plugins":["test"]}');
    const third = await projectSourceRevision(dir); expect(third).not.toEqual(second);
    await writeFile(join(dir, 'assets.yml'), 'version: 1');
    expect(await projectSourceRevision(dir)).toEqual(third);
    await writeFile(join(dir, 'package.json'), '{"diffusion":{"fps":30}}');
    expect(await projectSourceRevision(dir)).not.toEqual(third);
  });
  it('ignores media, cached evidence and hidden history while enforcing a byte limit', async () => {
    const dir = await project(); await writeFile(join(dir, 'index.tsx'), 'export default 1;');
    const before = await projectSourceRevision(dir);
    for (const name of ['assets', 'cache', 'reviews', '.syka', 'node_modules']) {
      await mkdir(join(dir, name)); await writeFile(join(dir, name, 'ignored.json'), 'not authoring source');
    }
    expect(await projectSourceRevision(dir)).toEqual(before);
    await writeFile(join(dir, 'huge.json'), Buffer.alloc(32 * 1024 * 1024 + 1));
    await expect(projectSourceRevision(dir)).rejects.toThrow('32 MiB');
  });
});
