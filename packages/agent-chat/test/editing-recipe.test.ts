import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, mkdir, writeFile, symlink, utimes, readdir } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WorkspaceTools } from '../src/host/workspace-tools';
import { captionsAfterRecut } from '../../../docs/skills/syka-captions/examples/recut-timing';
let cwd: string;
const workers = new Set<ChildProcessWithoutNullStreams>();
const moduleUrl = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '../src/host/editing-recipe.ts')).href;
const run = promisify(execFile);
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
async function removeFixture(path: string) {
  const target = resolve(path);
  if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith('syka-recipe-')) throw Error('Invalid recipe test cleanup');
  await rm(target, { recursive: true, force: true });
}
beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(),'syka-recipe-test-')); });
afterEach(async () => {
  for (const worker of workers) {
    if (worker.exitCode === null && worker.signalCode === null) {
      const exited = once(worker, 'exit'); worker.kill('SIGKILL'); await exited;
    }
  }
  workers.clear();
  await removeFixture(cwd);
});
const recipe = {version:1,label:'YouTube sin emojis',format:'youtube',objective:'Explicar una idea',
  decisions:['Conservar voz'],references:['referencias/video.mp4'],review:['Revisar cortes']};
const call = (args: unknown) => new WorkspaceTools(cwd).call('syka_editing_recipe',args) as Promise<{recipe:unknown;revision:string|null;backup?:string}>;

function pausedWriter(args: unknown, pauseAt: 'rename' | 'prepare' = 'rename') {
  // Pause a real save at its final rename, after it has published the owner,
  // checked CAS, written the backup and prepared the complete replacement.
  const script = `import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
const original = fs.rename;
const originalWrite = fs.writeFile;
const hold = setInterval(() => {}, 1000);
const pause = () => new Promise(done => { process.stdin.once('data', done); console.log('locked'); });
fs.rename = async (...args) => {
  if (${JSON.stringify(pauseAt)} === 'rename' && args[1].endsWith('editing-recipe.json')) await pause();
  return original(...args);
};
fs.writeFile = async (...args) => {
  if (${JSON.stringify(pauseAt)} === 'prepare' && String(args[0]).includes('editing-recipe-') && String(args[0]).endsWith('.tmp')) await pause();
  return originalWrite(...args);
};
syncBuiltinESMExports();
try { const {editingRecipe} = await import(${JSON.stringify(moduleUrl)});
  const result = await editingRecipe(${JSON.stringify(cwd)}, ${JSON.stringify(args)});
  console.log('saved:' + JSON.stringify(result));
} catch (error) { console.error(error.stack); process.exitCode = 1; }
finally { clearInterval(hold); process.stdin.pause(); }`;
  const worker = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  workers.add(worker);
  let stdout = '', stderr = '';
  worker.stderr.on('data', data => { stderr += data; });
  const ready = new Promise<void>((done, fail) => {
    worker.stdout.on('data', data => { stdout += data; if (stdout.includes('locked')) done(); });
    worker.once('error', fail);
    worker.once('exit', () => { workers.delete(worker); if (!stdout.includes('locked')) fail(Error(stderr || 'Recipe writer exited before acquiring the lock')); });
  });
  const finished = new Promise<{ code: number | null; stdout: string; stderr: string }>((done, fail) => {
    worker.once('error', fail);
    worker.once('exit', code => done({ code, stdout, stderr }));
  });
  return { worker, ready, finished };
}

async function deadProcessId(): Promise<number> {
  const { stdout } = await run(process.execPath, ['-e', 'console.log(process.pid)'], { windowsHide: true });
  const pid = Number(stdout.trim());
  expect(() => process.kill(pid, 0)).toThrow();
  return pid;
}

const lockMetadata = (pid: number, token = randomUUID()) => ({ version: 1, pid, token, createdAt: new Date().toISOString() });
describe('persistent project recipes', () => {
  it('starts empty and survives a new tool instance/chat', async () => {
    expect(await call({action:'read'})).toMatchObject({recipe:null,revision:null});
    const saved = await call({action:'save',recipe,revision:null});
    expect(await call({action:'read'})).toEqual({...saved,saved:undefined,backup:undefined});
  });
  it('rejects stale writes and preserves the previous revision in a backup', async () => {
    const first = await call({action:'save',recipe,revision:null});
    const second = await call({action:'save',recipe:{...recipe,label:'Reels',format:'reels'},revision:first.revision});
    expect(JSON.parse(await readFile(second.backup!,'utf8'))).toEqual(recipe);
    await expect(call({action:'save',recipe,revision:first.revision})).rejects.toThrow('changed');
    expect(await call({action:'read'})).toMatchObject({recipe:{label:'Reels'}});
  });
  it('does not replace malformed recipes or a simultaneous writer', async () => {
    await expect(call({action:'save',recipe:{...recipe,format:'unknown'},revision:null})).rejects.toThrow();
    await mkdir(join(cwd,'.syka')); await writeFile(join(cwd,'.syka/editing-recipe.lock'),'other writer');
    await expect(call({action:'save',recipe,revision:null})).rejects.toThrow();
  });
  it('rejects a recipe directory linked outside the project', async () => {
    const outside = await mkdtemp(join(tmpdir(),'syka-recipe-outside-'));
    try {
      await symlink(outside,join(cwd,'.syka'),'junction');
      await expect(call({action:'save',recipe,revision:null})).rejects.toThrow('real project');
    } finally {
      await rm(join(cwd,'.syka'),{force:true}); await removeFixture(outside);
    }
  });
});

describe('recipe writer ownership and crash recovery', () => {
  it('publishes complete owner metadata and never steals an old live writer', async () => {
    const first = await call({ action: 'save', recipe, revision: null });
    const before = await readFile(join(cwd, '.syka/editing-recipe.json'), 'utf8');
    const writer = pausedWriter({ action: 'save', recipe: { ...recipe, label: 'Live writer' }, revision: first.revision });
    await writer.ready;
    const lock = join(cwd, '.syka/editing-recipe.lock');
    const owner = JSON.parse(await readFile(lock, 'utf8'));
    expect(owner).toMatchObject({ version: 1, pid: writer.worker.pid });
    expect(owner.token).toMatch(/^[a-f0-9-]{36}$/);
    expect(Number.isFinite(Date.parse(owner.createdAt))).toBe(true);
    const old = new Date('2000-01-01T00:00:00.000Z');
    await writeFile(lock, JSON.stringify({ ...owner, createdAt: old.toISOString() }));
    await utimes(lock, old, old);
    await expect(call({ action: 'save', recipe, revision: first.revision })).rejects.toThrow('busy');
    expect(JSON.parse(await readFile(lock, 'utf8')).token).toBe(owner.token);
    expect(await readFile(join(cwd, '.syka/editing-recipe.json'), 'utf8')).toBe(before);
    writer.worker.stdin.write('continue\n');
    expect(await writer.finished).toMatchObject({ code: 0 });
    expect(await call({ action: 'read' })).toMatchObject({ recipe: { label: 'Live writer' } });
  });

  it('recovers a killed writer without altering its prior recipe or losing the backup', async () => {
    const first = await call({ action: 'save', recipe, revision: null });
    const path = join(cwd, '.syka/editing-recipe.json');
    const before = await readFile(path, 'utf8');
    const writer = pausedWriter({ action: 'save', recipe: { ...recipe, label: 'Interrupted' }, revision: first.revision });
    await writer.ready;
    writer.worker.kill('SIGKILL'); await writer.finished;
    expect(await readFile(path, 'utf8')).toBe(before);
    const recovered = await call({ action: 'save', recipe: { ...recipe, label: 'Recovered' }, revision: first.revision });
    expect(await readFile(recovered.backup!, 'utf8')).toBe(before);
    expect(await call({ action: 'read' })).toMatchObject({ recipe: { label: 'Recovered' } });
    await expect(readFile(join(cwd, '.syka/editing-recipe.lock'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readdir(join(cwd, '.syka/recipe-lock-recovery'))).toHaveLength(1);
  });

  it('recovers an interrupted reclaimer and still enforces the current recipe revision', async () => {
    const first = await call({ action: 'save', recipe, revision: null });
    const current = await call({ action: 'save', recipe: { ...recipe, label: 'Current' }, revision: first.revision });
    const pid = await deadProcessId(), owner = lockMetadata(pid), reclaimer = lockMetadata(pid);
    await writeFile(join(cwd, '.syka/editing-recipe.lock'), JSON.stringify(owner));
    const history = join(cwd, '.syka/recipe-lock-recovery'); await mkdir(history);
    await writeFile(join(history, hash(owner.token) + '.json'), JSON.stringify(reclaimer));
    await expect(call({ action: 'save', recipe, revision: first.revision })).rejects.toThrow('changed');
    expect(await call({ action: 'read' })).toMatchObject({ recipe: { label: 'Current' }, revision: current.revision });
    expect(await readdir(history)).toHaveLength(2);
    await expect(readFile(join(cwd, '.syka/editing-recipe.lock'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not remove another token when the original writer releases its lock', async () => {
    const writer = pausedWriter({ action: 'save', recipe, revision: null });
    await writer.ready;
    const lock = join(cwd, '.syka/editing-recipe.lock'), replacement = lockMetadata(process.pid);
    await writeFile(lock, JSON.stringify(replacement));
    writer.worker.stdin.write('continue\n');
    expect(await writer.finished).toMatchObject({ code: 0 });
    expect(JSON.parse(await readFile(lock, 'utf8'))).toEqual(replacement);
    await expect(call({ action: 'save', recipe, revision: null })).rejects.toThrow('busy');
  });

  it('refuses to replace the recipe after losing its ownership token', async () => {
    const first = await call({ action: 'save', recipe, revision: null });
    const path = join(cwd, '.syka/editing-recipe.json'), before = await readFile(path, 'utf8');
    const writer = pausedWriter({ action: 'save', recipe: { ...recipe, label: 'Lost owner' }, revision: first.revision }, 'prepare');
    await writer.ready;
    const lock = join(cwd, '.syka/editing-recipe.lock'), replacement = lockMetadata(process.pid);
    await writeFile(lock, JSON.stringify(replacement)); writer.worker.stdin.write('continue\n');
    expect(await writer.finished).toMatchObject({ code: 1, stderr: expect.stringContaining('ownership changed') });
    expect(await readFile(path, 'utf8')).toBe(before);
    expect(JSON.parse(await readFile(lock, 'utf8'))).toEqual(replacement);
  });

  it('treats a denied liveness check as unknown ownership rather than a dead writer', async () => {
    const first = await call({ action: 'save', recipe, revision: null });
    const lock = join(cwd, '.syka/editing-recipe.lock'), owner = lockMetadata(process.pid);
    await writeFile(lock, JSON.stringify(owner));
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => { throw Object.assign(Error('Access denied'), { code: 'EPERM' }); });
    try {
      await expect(call({ action: 'save', recipe, revision: first.revision })).rejects.toThrow('busy');
      expect(JSON.parse(await readFile(lock, 'utf8'))).toEqual(owner);
    } finally { kill.mockRestore(); }
  });

  it('preserves old empty legacy locks when no owner can be verified', async () => {
    const first = await call({ action: 'save', recipe, revision: null });
    const path = join(cwd, '.syka/editing-recipe.json'), before = await readFile(path, 'utf8');
    const lock = join(cwd, '.syka/editing-recipe.lock'); await writeFile(lock, '');
    const old = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); await utimes(lock, old, old);
    await expect(call({ action: 'save', recipe, revision: first.revision })).rejects.toThrow('no verifiable owner');
    expect(await readFile(lock, 'utf8')).toBe('');
    expect(await readFile(path, 'utf8')).toBe(before);
    expect(await call({ action: 'read' })).toMatchObject({ revision: first.revision });
  });

  it('rejects linked lock files and leaves their outside contents intact', async () => {
    await mkdir(join(cwd, '.syka'));
    const outside = await mkdtemp(join(tmpdir(), 'syka-recipe-outside-'));
    try {
      await writeFile(join(outside, 'sentinel'), 'outside');
      await symlink(outside, join(cwd, '.syka/editing-recipe.lock'), 'junction');
      await expect(call({ action: 'save', recipe, revision: null })).rejects.toThrow('real file');
      expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('outside');
    } finally {
      await rm(join(cwd, '.syka/editing-recipe.lock'), { force: true }); await removeFixture(outside);
    }
  });

  it('rejects a recovery directory linked outside the project', async () => {
    const first = await call({ action: 'save', recipe, revision: null });
    await writeFile(join(cwd, '.syka/editing-recipe.lock'), JSON.stringify(lockMetadata(await deadProcessId())));
    const outside = await mkdtemp(join(tmpdir(), 'syka-recipe-outside-'));
    try {
      await writeFile(join(outside, 'sentinel'), 'outside');
      await symlink(outside, join(cwd, '.syka/recipe-lock-recovery'), 'junction');
      await expect(call({ action: 'save', recipe, revision: first.revision })).rejects.toThrow('inside the project');
      expect(await readdir(outside)).toEqual(['sentinel']);
    } finally {
      await rm(join(cwd, '.syka/recipe-lock-recovery'), { force: true }); await removeFixture(outside);
    }
  });

  it('allows only one of two independent recovering writers to change the recipe', async () => {
    const first = await call({ action: 'save', recipe, revision: null }), pid = await deadProcessId();
    await writeFile(join(cwd, '.syka/editing-recipe.lock'), JSON.stringify(lockMetadata(pid)));
    const script = (label: string) => `import {editingRecipe} from ${JSON.stringify(moduleUrl)};
try { await editingRecipe(${JSON.stringify(cwd)}, ${JSON.stringify({ action: 'save', recipe: { ...recipe, label }, revision: first.revision })}); console.log('saved'); }
catch (error) { console.log('rejected:' + error.message); }`;
    const results = await Promise.all(['Writer A', 'Writer B'].map(label => run(process.execPath, ['--input-type=module', '-e', script(label)], { windowsHide: true })));
    expect(results.filter(result => result.stdout.includes('saved'))).toHaveLength(1);
    expect(results.filter(result => /rejected:.*(?:busy|changed)/.test(result.stdout))).toHaveLength(1);
    const latest = await call({ action: 'read' }) as { recipe: { label: string } };
    expect(['Writer A', 'Writer B']).toContain(latest.recipe.label);
    const backups = await readdir(join(cwd, '.syka/recipe-history'));
    expect(backups).toHaveLength(1);
    expect(JSON.parse(await readFile(join(cwd, '.syka/recipe-history', backups[0]), 'utf8'))).toEqual(recipe);
  }, 15_000);
});
describe('caption synchronization after a recut', () => {
  it('removes omitted words and maps retained spans at different speeds', () => {
    const result = captionsAfterRecut([
      {start:0,end:1,text:'fuera'}, {start:2,end:3,text:'primera'}, {start:6,end:8,text:'segunda'},
    ],[
      {sourceIn:2,sourceOut:4,timelineStart:0,playbackRate:1},
      {sourceIn:6,sourceOut:10,timelineStart:2,playbackRate:2},
    ]);
    expect(result).toEqual([{text:'primera',start:0,end:1,clipped:false},{text:'segunda',start:2,end:3,clipped:false}]);
  });
  it('flags cut-through words and excludes an exact end boundary', () => {
    expect(captionsAfterRecut([{start:1,end:3,text:'cortada'},{start:4,end:5,text:'fuera'}],
      [{sourceIn:2,sourceOut:4,timelineStart:5,playbackRate:1}]))
      .toEqual([{text:'cortada',start:5,end:6,clipped:true}]);
  });
  it('rejects invalid rates instead of emitting infinite timestamps', () => {
    expect(() => captionsAfterRecut([], [{sourceIn:0,sourceOut:2,timelineStart:0,playbackRate:0}])).toThrow();
  });
});
