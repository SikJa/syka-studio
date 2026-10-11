import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, readFile, realpath, rename, unlink, writeFile, open } from 'node:fs/promises';
import { join } from 'node:path';

export type EditingRecipe = {
  version: 1; label: string; format: 'general' | 'reels' | 'youtube';
  skill?: string; objective: string; decisions: string[]; references: string[]; review: string[];
};
const revision = (text: string) => createHash('sha256').update(text).digest('hex');

type RecipeLockOwner = { version: 1; pid: number; token: string; createdAt: string };

async function lockOwner(path: string): Promise<RecipeLockOwner | null> {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw Error('Recipe lock must be a real file');
    if (info.size > 4096) throw Error('Recipe lock metadata is too large');
    let value: Partial<RecipeLockOwner>;
    try { value = JSON.parse(await readFile(path, 'utf8')); }
    catch { throw Error('Recipe lock has no verifiable owner; close all recipe writers before manually removing the lock'); }
    if (!value || value.version !== 1 || !Number.isSafeInteger(value.pid) || value.pid! <= 0
      || typeof value.token !== 'string' || !value.token || value.token.length > 128
      || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) {
      throw Error('Recipe lock has no verifiable owner; close all recipe writers before manually removing the lock');
    }
    return value as RecipeLockOwner;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function ownerIsDead(owner: RecipeLockOwner): boolean {
  try { process.kill(owner.pid, 0); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH'; }
}

async function claimRecovery(folder: string, abandoned: RecipeLockOwner, candidate: string): Promise<boolean> {
  const history = join(folder, 'recipe-lock-recovery');
  await mkdir(history, { recursive: true });
  const info = await lstat(history);
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(history) !== history) {
    throw Error('Recipe lock recovery must be inside the project');
  }
  // Immutable claims serialize recovery of one token. If a reclaimer dies,
  // a successor claims its token instead; no age threshold steals a live lock.
  // Keep these tiny crash records so delayed contenders cannot reuse a claim.
  const visited = new Set<string>();
  let previous = abandoned;
  while (!visited.has(previous.token)) {
    visited.add(previous.token);
    const path = join(history, revision(previous.token) + '.json');
    try { await link(candidate, path); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const reclaimer = await lockOwner(path);
    if (!reclaimer) continue;
    if (!ownerIsDead(reclaimer)) return false;
    previous = reclaimer;
  }
  throw Error('Recipe lock recovery metadata contains a cycle');
}

async function acquireRecipeLock(folder: string, safe: () => Promise<void>): Promise<RecipeLockOwner> {
  const owner: RecipeLockOwner = { version: 1, pid: process.pid, token: randomUUID(), createdAt: new Date().toISOString() };
  const path = join(folder, 'editing-recipe.lock');
  const candidate = join(folder, 'recipe-lock-' + owner.token + '.tmp');
  try {
    const file = await open(candidate, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(owner) + '\n'); await file.sync(); }
    finally { await file.close(); }
    // The public lock is linked only after all metadata is written. A crash
    // during publication cannot leave a new empty, unverifiable lock.
    for (let attempt = 0; attempt < 8; attempt++) {
      await safe();
      try { await link(candidate, path); return owner; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
      const previous = await lockOwner(path);
      if (!previous) continue;
      if (!ownerIsDead(previous)) throw Error('Recipe is busy in another process; try again');
      if (!await claimRecovery(folder, previous, candidate)) {
        const current = await lockOwner(path);
        if (!current || current.token !== previous.token) continue;
        throw Error('Recipe lock recovery is busy in another process; try again');
      }
      const current = await lockOwner(path);
      if (!current || current.token !== previous.token || current.pid !== previous.pid) continue;
      if (!ownerIsDead(current)) throw Error('Recipe is busy in another process; try again');
      await safe();
      await unlink(path);
    }
    throw Error('Recipe lock changed during recovery; try again');
  } finally { await unlink(candidate).catch(() => {}); }
}

async function assertOwnLock(path: string, owner: RecipeLockOwner): Promise<void> {
  const current = await lockOwner(path);
  if (!current || current.pid !== owner.pid || current.token !== owner.token) throw Error('Recipe lock ownership changed before saving');
}

async function releaseRecipeLock(path: string, owner: RecipeLockOwner): Promise<void> {
  const current = await lockOwner(path);
  if (current?.pid === owner.pid && current.token === owner.token) await unlink(path);
}
export function validateRecipe(raw: unknown): EditingRecipe {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Recipe must be an object');
  const value = raw as Record<string, unknown>;
  const allowed = ['version','label','format','skill','objective','decisions','references','review'];
  if (Object.keys(value).some(key => !allowed.includes(key))) throw Error('Unknown recipe field');
  const text = (key: string, required = true) => {
    const item = value[key];
    if (!required && item === undefined) return undefined;
    if (typeof item !== 'string' || !item.trim() || item.length > 2000) throw Error('Invalid recipe ' + key);
    return item.trim();
  };
  const list = (key: string) => {
    const items = value[key];
    if (!Array.isArray(items) || items.length > 40 || items.some(item => typeof item !== 'string' || !item.trim() || item.length > 2000)) throw Error('Invalid recipe ' + key);
    return (items as string[]).map(item => item.trim());
  };
  if (value.version !== 1 || !['general','reels','youtube'].includes(String(value.format))) throw Error('Invalid recipe version or format');
  return {version:1,label:text('label')!,format:value.format as EditingRecipe['format'],skill:text('skill',false),
    objective:text('objective')!,decisions:list('decisions'),references:list('references'),review:list('review')};
}

/** Project-only knowledge. Optimistic revision, one writer, backups, atomic replacement. */
export async function editingRecipe(cwd: string, raw: unknown) {
  const args = raw as { action?: string; recipe?: unknown; revision?: string | null };
  if (!args || !['read','save'].includes(args.action ?? '')) throw Error('Use read or save');
  const root = await realpath(cwd), folder = join(root, '.syka'), path = join(folder, 'editing-recipe.json');
  const safe = async () => {
    const directory = await lstat(folder);
    if (!directory.isDirectory() || directory.isSymbolicLink() || await realpath(folder) !== folder) throw Error('Recipe folder must be a real project directory');
    try { if ((await lstat(path)).isSymbolicLink()) throw Error('Recipe must not be a symlink'); }
    catch(error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  };
  const read = async () => {
    try { await safe(); const content = await readFile(path,'utf8'); return {path:'.syka/editing-recipe.json',recipe:validateRecipe(JSON.parse(content)),revision:revision(content)}; }
    catch(error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {path:'.syka/editing-recipe.json',recipe:null,revision:null}; throw error; }
  };
  if (args.action === 'read') return read();
  const recipe = validateRecipe(args.recipe);
  await mkdir(folder, {recursive:true}); await safe();
  const lockPath = join(folder,'editing-recipe.lock');
  const lock = await acquireRecipeLock(folder, safe);
  const temporary = join(folder,'editing-recipe-'+randomUUID()+'.tmp');
  try {
    const previous = await read();
    if (args.revision !== previous.revision) throw Error('Recipe changed: read the current revision before saving');
    let backup: string | undefined;
    if (previous.recipe) {
      const history = join(folder,'recipe-history');
      await mkdir(history,{recursive:true});
      if ((await lstat(history)).isSymbolicLink() || await realpath(history) !== history) throw Error('Recipe history must be inside the project');
      backup = join(history,randomUUID()+'.json');
      await writeFile(backup,await readFile(path,'utf8'),{flag:'wx'});
    }
    const content = JSON.stringify(recipe,null,2)+'\n';
    await writeFile(temporary,content,{flag:'wx'}); await safe(); await assertOwnLock(lockPath, lock); await rename(temporary,path);
    return {...await read(),saved:true,backup};
  } finally {
    await unlink(temporary).catch(()=>{}); await safe(); await releaseRecipeLock(lockPath, lock);
  }
}
