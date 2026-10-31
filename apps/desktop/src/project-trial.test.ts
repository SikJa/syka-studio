import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { copyProjectTrial } from './project-trial';
let root: string, source: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'syka-trial-test-')); source = join(root, 'original');
  await mkdir(source);await writeFile(join(source, 'package.json'), JSON.stringify({ projectId:'original-id',displayName:'Original',main:'index.tsx' }));
  await writeFile(join(source, 'index.tsx'), 'export default () => <stage />;');
});
afterEach(async () => { await rm(root, {recursive:true,force:true}); });
it('creates an independent identity and media bytes, without changing original files', async () => {
  const before = await readFile(join(source,'package.json'));
  await writeFile(join(source,'sound.wav'),Buffer.from([1,2,3,4]));
  const trial = await copyProjectTrial(source,'original-id','Original');
  const pkg = JSON.parse(await readFile(join(trial,'package.json'),'utf8'));
  expect(pkg.projectId).not.toBe('original-id');expect(pkg.trialOf.id).toBe('original-id');
  expect(await readFile(join(source,'package.json'))).toEqual(before);
  await writeFile(join(trial,'index.tsx'),'changed');await writeFile(join(trial,'sound.wav'),Buffer.from([9]));
  expect(await readFile(join(source,'index.tsx'),'utf8')).toContain('<stage />');
  expect(await readFile(join(source,'sound.wav'))).toEqual(Buffer.from([1,2,3,4]));
});
it('rebases internal absolute references and starts with fresh history and no Git link', async () => {
  await mkdir(join(source,'.syka'));await writeFile(join(source,'.syka','history.json'),'old');
  await writeFile(join(source,'.git'),'gitdir: other-worktree');
  await writeFile(join(source,'asset.json'),JSON.stringify({src:join(source,'sound.wav'),outside:source+'-other/file'}));
  const trial=await copyProjectTrial(source,'original-id','Original');
  const data=JSON.parse(await readFile(join(trial,'asset.json'),'utf8'));
  expect(data.src).toBe(join(trial,'sound.wav'));expect(data.outside).toBe(source+'-other/file');
  expect(await readdir(trial)).not.toContain('.syka');expect(await readdir(trial)).not.toContain('.git');
});
it('creates separate destinations for concurrent trials', async () => {
  const trials=await Promise.all([copyProjectTrial(source,'original-id','Original'),copyProjectTrial(source,'original-id','Original')]);
  expect(trials[0]).not.toBe(trials[1]);
});
it('preserves independent approved decisions without inheriting locks or edit history', async () => {
  await mkdir(join(source,'.syka'));
  const recipe = JSON.stringify({ version:1, objective:'Motion editable', decisions:['Conservar música aprobada'], references:[join(source,'reference.png')] });
  await writeFile(join(source,'.syka','editing-recipe.json'), recipe);
  await writeFile(join(source,'.syka','editing-recipe.lock'),'active elsewhere');
  await writeFile(join(source,'.syka','history.json'),'original history');
  const trial = await copyProjectTrial(source,'original-id','Original');
  expect(await readdir(join(trial,'.syka'))).toEqual(['editing-recipe.json']);
  const copied = JSON.parse(await readFile(join(trial,'.syka','editing-recipe.json'),'utf8'));
  expect(copied.decisions).toEqual(['Conservar música aprobada']);
  expect(copied.references).toEqual([join(trial,'reference.png')]);
  await writeFile(join(trial,'.syka','editing-recipe.json'),'changed trial');
  expect(await readFile(join(source,'.syka','editing-recipe.json'),'utf8')).toBe(recipe);
});
it('refuses junctions rather than retaining a writable path into the original or another folder', async () => {
  const outside=join(root,'outside');await mkdir(outside);await writeFile(join(outside,'keep.txt'),'keep');
  await symlink(outside,join(source,'linked'),'junction');
  await expect(copyProjectTrial(source,'original-id','Original')).rejects.toThrow('enlace');
  expect(await readFile(join(outside,'keep.txt'),'utf8')).toBe('keep');
});
