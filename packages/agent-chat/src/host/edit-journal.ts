/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Shared by Electron main and the agent utility process. Disk is the authority:
// a project lock serializes writers, snapshots retain exact bytes, and a pending
// transaction makes a source rename recoverable if the process dies before the
// journal rename. Undo always compares the current source with the recorded head.
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rename, rmdir, stat, unlink } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".html", ".svg", ".yaml", ".yml", ".txt", ".toml"]);
const RESERVED = new Set(["node_modules", "01 crudos", "01crudos", "02 finales", "02finales", "03 assets reutilizables", "03assetsreutilizables", "90 descartable", "90descartable"]);
const sha = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const pause = (ms: number): Promise<void> => new Promise(done => setTimeout(done, ms));
const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error);

type FileChange = { file: string; before: string; after: string };
type Entry = FileChange & { id: string; files?: FileChange[]; origin: "manual" | "chat"; label: string; groupId?: string; createdAt: string };
type State = { version: 1 | 2; revision: string; cursor: number; entries: Entry[]; heads: Record<string, string> };
type Transfer = { file: string; from: string; to: string };
type Pending = { version: 1; previousRevision: string; next: State; file: string; from: string; to: string }
  | { version: 2; previousRevision: string; next: State; files: Transfer[] };
type Store = { root: string; dir: string };

/** A safe refusal to overwrite source changed outside this chronology. */
export class SourceHistoryConflictError extends Error {
  constructor(message: string) { super(message); this.name = "SourceHistoryConflictError"; }
}

export type SourceHistoryStatus = { revision: string; canUndo: boolean; canRedo: boolean; undoLabel?: string; redoLabel?: string; undoEntryId?: string; redoEntryId?: string };
export type SourceHistoryResult = SourceHistoryStatus & { changed: boolean; previousRevision?: string; entryId?: string; path?: string; sha256?: string };
export type CommitSourceEditOptions = {
  projectDir: string; filePath: string; before: Buffer | string; after: string;
  origin: "manual" | "chat"; label?: string; groupId?: string;
  /** View/stamping writes advance CAS heads without creating an undo entry. */
  record?: boolean;
  onBeforeWrite?: (absolutePath: string, content: string) => void;
};
export type RestoreSourceEditOptions = { projectDir: string; expectedSha256?: string; expectedFilePath?: string; expectedEntryId?: string };
export type CommitSourceEditsOptions = Omit<CommitSourceEditOptions, 'filePath' | 'before' | 'after'> & {
  changes: Array<Pick<CommitSourceEditOptions, 'filePath' | 'before' | 'after'>>;
};
const entryFiles = (entry: Entry): FileChange[] => entry.files ?? [{ file: entry.file, before: entry.before, after: entry.after }];

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !!rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep);
}

async function sourcePath(root: string, path: string): Promise<string> {
  const candidate = resolve(root, path);
  if (!inside(root, candidate) || !SOURCE_EXTENSIONS.has(extname(candidate).toLowerCase())) throw new Error("History supports existing authoring source files inside this project only");
  const actual = await realpath(candidate);
  if (!inside(root, actual) || relative(root, actual).split(sep).some(part => (part.startsWith(".") && ![".agents", ".codex"].includes(part)) || RESERVED.has(part.toLowerCase()))) throw new Error("Source path escapes the project or names a protected folder");
  if (!SOURCE_EXTENSIONS.has(extname(actual).toLowerCase())) throw new Error("Resolved file is not authoring source");
  return actual;
}

async function readSource(file: string): Promise<Buffer> {
  const info = await stat(file);
  if (!info.isFile() || info.size > MAX_SOURCE_BYTES) throw new Error("Source exceeds the supported 16 MiB limit");
  const bytes = await readFile(file);
  if (bytes.length > MAX_SOURCE_BYTES || !Buffer.from(bytes.toString("utf8")).equals(bytes)) throw new Error("Source must be UTF-8 and at most 16 MiB");
  return bytes;
}

async function openStore(projectDir: string): Promise<Store> {
  if (!isAbsolute(projectDir)) throw new Error("Project directory must be absolute");
  const root = await realpath(projectDir);
  let dir = root;
  for (const name of [".syka", "edit-history"]) {
    const next = join(dir, name);
    await mkdir(next).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
    dir = await realpath(next);
    if (!inside(root, dir)) throw new Error("Edit history path escapes the project");
  }
  return { root, dir };
}

async function atomic(path: string, content: string | Buffer): Promise<void> {
  const temp = join(dirname(path), `.syka-journal-${randomUUID()}.tmp`);
  try {
    const handle = await open(temp, "wx");
    try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
    await rename(temp, path);
  } finally { await unlink(temp).catch(() => {}); }
}

async function json<T>(store: Store, name: string): Promise<T | null> {
  const path = join(store.dir, name);
  try {
    if ((await lstat(path)).isSymbolicLink()) throw new Error("History records cannot be symbolic links");
    const bytes = await readFile(path);
    if (bytes.length > 4 * 1024 * 1024) throw new Error("History metadata exceeds the supported limit");
    return JSON.parse(bytes.toString("utf8")) as T;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

function validateState(state: State): void {
  if (![1, 2].includes(state.version) || typeof state.revision !== "string" || !Array.isArray(state.entries) || !Number.isInteger(state.cursor) || state.cursor < 0 || state.cursor > state.entries.length || !state.heads || typeof state.heads !== "object") throw new Error("Invalid edit history metadata");
  for (const [file, hash] of Object.entries(state.heads)) if (!file || !HASH.test(hash)) throw new Error("Invalid edit history head");
  for (const entry of state.entries) {
    if (!entry.file || !entry.id || !HASH.test(entry.before) || !HASH.test(entry.after) || !["manual", "chat"].includes(entry.origin)) throw new Error("Invalid edit history entry");
    if (entry.files && (!Array.isArray(entry.files) || entry.files.length < 2 || state.version !== 2)) throw new Error('Invalid batch edit history');
    const files = entryFiles(entry);
    if (new Set(files.map(change => change.file)).size !== files.length || files.some(change => !change.file || !HASH.test(change.before) || !HASH.test(change.after))) throw new Error('Invalid batch file hashes');
  }
}

async function stateOf(store: Store): Promise<State> {
  const existing = await json<State>(store, "journal.json");
  if (existing) { validateState(existing); return existing; }
  const state: State = { version: 1, revision: randomUUID(), cursor: 0, entries: [], heads: {} };
  await atomic(join(store.dir, "journal.json"), JSON.stringify(state));
  return state;
}

async function reapAbandonedLock(store: Store): Promise<void> {
  // Only one reclaimer examines/removes the stale directory. Otherwise two
  // reclaimers could both inspect the old owner and the second rename a new
  // writer's lock after the first writer acquired it.
  const reaper = join(store.dir, "reclaim-lock");
  try { await mkdir(reaper); } catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return; throw error; }
  try {
    const path = join(store.dir, "lock");
    const info = await lstat(path).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error; });
    if (!info) return;
    if (info.isSymbolicLink()) throw new Error("History lock cannot be a symbolic link");
    const owner = await readFile(join(path, "owner.json"), "utf8").then(value => JSON.parse(value) as { pid: number }, () => null);
    let abandoned = !owner && Date.now() - info.mtimeMs > 60_000;
    if (owner && Number.isInteger(owner.pid) && owner.pid > 0) {
      try { process.kill(owner.pid, 0); } catch (failure) { abandoned = (failure as NodeJS.ErrnoException).code === "ESRCH"; }
    }
    if (!abandoned) return;
    const claimed = join(store.dir, `abandoned-${randomUUID()}`);
    await rename(path, claimed);
    // The ownerless crash window can leave an incomplete temp metadata file.
    const { readdir } = await import("node:fs/promises");
    for (const name of await readdir(claimed)) {
      if (name === "owner.json" || /^\.syka-journal-[a-f0-9-]+\.tmp$/.test(name)) await unlink(join(claimed, name));
      else throw new Error("Abandoned history lock contains unexpected files");
    }
    await rmdir(claimed);
  } finally { await rmdir(reaper); }
}

async function lock<T>(store: Store, work: () => Promise<T>): Promise<T> {
  const path = join(store.dir, "lock");
  const token = randomUUID();
  const deadline = Date.now() + 8000;
  while (true) {
    try {
      await mkdir(path);
      await atomic(join(path, "owner.json"), JSON.stringify({ pid: process.pid, token }));
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await reapAbandonedLock(store);
      if (Date.now() >= deadline) throw new Error("Edit history is busy in another process; try again");
      await pause(30);
    }
  }
  try { return await work(); } finally {
    const owner = await readFile(join(path, "owner.json"), "utf8").then(value => JSON.parse(value) as { token: string }, () => null);
    if (owner?.token === token) { await unlink(join(path, "owner.json")); await rmdir(path); }
  }
}

async function snapshot(store: Store, hash: string, content?: Buffer | string): Promise<Buffer> {
  if (!HASH.test(hash)) throw new Error("Invalid snapshot hash");
  const dir = join(store.dir, "snapshots");
  await mkdir(dir).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
  if (!inside(store.root, await realpath(dir))) throw new Error("Snapshot path escapes the project");
  const path = join(dir, hash + ".source");
  if (content !== undefined) {
    if (sha(content) !== hash) throw new Error("Snapshot integrity mismatch");
    // Snapshots are immutable, but must also appear whole: a crash during a
    // direct write would otherwise leave a truncated blob under its final hash.
    // All callers hold the project lock, so no other journal writer can race it.
    const exists = await lstat(path).then(() => true, (error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return false; throw error; });
    if (!exists) await atomic(path, content);
  }
  if ((await lstat(path)).isSymbolicLink()) throw new Error("Snapshot cannot be a symbolic link");
  const bytes = await readSource(path);
  if (sha(bytes) !== hash) throw new Error("Snapshot integrity mismatch");
  return bytes;
}

async function checkHeads(store: Store, state: State, except?: string | Set<string>): Promise<void> {
  for (const [file, expected] of Object.entries(state.heads)) {
    if (file === except || (except instanceof Set && except.has(file))) continue;
    const actual = sha(await readSource(await sourcePath(store.root, file)));
    if (actual !== expected) throw new SourceHistoryConflictError(`Source changed outside shared history: ${file}. Undo/redo refused to overwrite external changes`);
  }
}

async function recover(store: Store): Promise<State> {
  let state = await stateOf(store);
  const pending = await json<Pending>(store, "pending.json");
  if (!pending) return state;
  validateState(pending.next);
  const transfers = pending.version === 1 ? [{file: pending.file, from: pending.from, to: pending.to}] : pending.version === 2 ? pending.files : [];
  if (!Array.isArray(transfers) || !transfers.length || transfers.some(change => !change.file || !HASH.test(change.from) || !HASH.test(change.to)) || new Set(transfers.map(change => change.file)).size !== transfers.length) throw new Error("Invalid pending edit transaction");
  if (state.revision !== pending.previousRevision && state.revision !== pending.next.revision) throw new SourceHistoryConflictError("History revision changed during recovery");
  const targets = [];
  // Validate every source and snapshot before recovering any file.
  for (const transfer of transfers) {
    const file = await sourcePath(store.root, transfer.file), current = sha(await readSource(file));
    if (current !== transfer.from && current !== transfer.to) throw new SourceHistoryConflictError("Source changed during interrupted edit; recovery refused to overwrite it");
    targets.push({ ...transfer, file, current, content: await snapshot(store, transfer.to) });
  }
  await checkHeads(store, state, new Set(transfers.map(change => change.file)));
  for (const target of targets) {
    if (sha(await readSource(target.file)) !== target.current) throw new SourceHistoryConflictError('Source changed during recovery; recovery refused to overwrite it');
    if (target.current === target.from) await atomic(target.file, target.content);
  }
  if (state.revision !== pending.next.revision) await atomic(join(store.dir, "journal.json"), JSON.stringify(pending.next));
  await unlink(join(store.dir, "pending.json"));
  state = pending.next;
  return state;
}

function status(state: State): SourceHistoryStatus {
  const previous = state.entries[state.cursor - 1];
  const next = state.entries[state.cursor];
  return { revision: state.revision, canUndo: !!previous, canRedo: !!next,
    ...(previous ? { undoLabel: previous.label, undoEntryId: previous.id } : {}),
    ...(next ? { redoLabel: next.label, redoEntryId: next.id } : {}) };
}

async function transact(store: Store, state: State, next: State, file: string, from: string, to: string, onBeforeWrite?: CommitSourceEditOptions["onBeforeWrite"]): Promise<void> {
  return transactFiles(store, state, next, [{file,from,to}], onBeforeWrite);
}

async function transactFiles(store: Store, state: State, next: State, transfers: Transfer[], onBeforeWrite?: CommitSourceEditOptions['onBeforeWrite']): Promise<void> {
  await checkHeads(store, state);
  const targets = [];
  for (const change of transfers) {
    const target = await sourcePath(store.root, change.file);
    if (sha(await readSource(target)) !== change.from) throw new SourceHistoryConflictError('Source changed since it was read; edit refused');
    targets.push({ ...change, target, content: await snapshot(store, change.to), original: await snapshot(store, change.from) });
  }
  const pending: Pending = transfers.length === 1
    ? {version:1,previousRevision:state.revision,next,...transfers[0]!}
    : {version:2,previousRevision:state.revision,next,files:transfers};
  await atomic(join(store.dir, "pending.json"), JSON.stringify(pending));
  const written: typeof targets = [];
  try {
    for (const change of targets) {
      if (await sourcePath(store.root, change.file) !== change.target || sha(await readSource(change.target)) !== change.from) throw new SourceHistoryConflictError('Source changed during the edit; edit refused');
      onBeforeWrite?.(change.target, change.content.toString('utf8'));
      await atomic(change.target, change.content);
      written.push(change);
    }
    await atomic(join(store.dir, 'journal.json'), JSON.stringify(next));
  } catch (error) {
    // Ordinary failures roll back. A crash leaves pending.json for recovery.
    for (const change of written.reverse()) {
      if (sha(await readSource(change.target)) !== change.to) throw new SourceHistoryConflictError('Source changed during rollback; preserved external edit and pending recovery');
      onBeforeWrite?.(change.target, change.original.toString('utf8'));
      await atomic(change.target, change.original);
    }
    await unlink(join(store.dir, 'pending.json'));
    throw error;
  }
  await unlink(join(store.dir, "pending.json"));
}

export async function getSourceHistoryStatus(projectDir: string): Promise<SourceHistoryStatus> {
  const store = await openStore(projectDir);
  return lock(store, async () => { const state = await recover(store); await checkHeads(store, state); return status(state); });
}

export async function commitSourceEdit(options: CommitSourceEditOptions): Promise<SourceHistoryResult> {
  const before = Buffer.from(options.before);
  const after = Buffer.from(options.after, "utf8");
  if (before.length > MAX_SOURCE_BYTES || after.length > MAX_SOURCE_BYTES || !Buffer.from(before.toString("utf8")).equals(before)) throw new Error("Source edit exceeds 16 MiB or is not UTF-8");
  if (!["manual", "chat"].includes(options.origin)) throw new Error("Invalid edit origin");
  const store = await openStore(options.projectDir);
  return lock(store, async () => {
    const state = await recover(store);
    await checkHeads(store, state);
    const absolute = await sourcePath(store.root, options.filePath);
    const file = relative(store.root, absolute).split(sep).join("/");
    const previousHash = sha(before);
    if (sha(await readSource(absolute)) !== previousHash) throw new SourceHistoryConflictError("Source changed since it was read; edit refused");
    const nextHash = sha(after);
    if (nextHash === previousHash) return { ...status(state), changed: false, previousRevision: state.revision, path: file, sha256: nextHash };
    await snapshot(store, previousHash, before);
    await snapshot(store, nextHash, after);
    const next: State = { ...state, revision: randomUUID(), heads: { ...state.heads, [file]: nextHash }, entries: [...state.entries] };
    let entry: Entry | undefined;
    if (options.record !== false) {
      next.entries = state.entries.slice(0, state.cursor);
      const previous = next.entries.at(-1);
      const merge = options.origin === "manual" && !!options.groupId && state.cursor === state.entries.length && previous?.origin === "manual" && previous.groupId === options.groupId && previous.file === file && !previous.files;
      entry = merge ? { ...previous, after: nextHash } : {
        id: randomUUID(), file, before: previousHash, after: nextHash, origin: options.origin,
        label: (options.label || (options.origin === "chat" ? "Edición del chat" : "Edición manual")).slice(0, 200),
        ...(options.groupId ? { groupId: options.groupId.slice(0, 200) } : {}), createdAt: new Date().toISOString(),
      };
      if (merge) next.entries[next.entries.length - 1] = entry;
      else next.entries.push(entry);
      next.entries = next.entries.slice(-1000);
      next.cursor = next.entries.length;
    }
    await transact(store, state, next, file, previousHash, nextHash, options.onBeforeWrite);
    return { ...status(next), changed: true, previousRevision: state.revision, ...(entry ? { entryId: entry.id } : {}), path: file, sha256: nextHash };
  });
}

/** A source batch has one journal entry and one crash-recoverable commit. */
export async function commitSourceEdits(options: CommitSourceEditsOptions): Promise<SourceHistoryResult> {
  if (!options.changes.length) throw new Error('An edit batch must contain source files');
  if (options.changes.length === 1) return commitSourceEdit({...options,...options.changes[0]!});
  if (!['manual','chat'].includes(options.origin)) throw new Error('Invalid edit origin');
  const store = await openStore(options.projectDir);
  return lock(store, async () => {
    const state = await recover(store);
    await checkHeads(store, state);
    const changes: FileChange[] = [];
    const paths = new Set<string>();
    for (const change of options.changes) {
      const absolute = await sourcePath(store.root, change.filePath);
      const file = relative(store.root, absolute).split(sep).join('/');
      if (paths.has(file)) throw new Error('Duplicate source in edit batch');
      paths.add(file);
      const before = Buffer.from(change.before), after = Buffer.from(change.after,'utf8');
      if (before.length > MAX_SOURCE_BYTES || after.length > MAX_SOURCE_BYTES || !Buffer.from(before.toString('utf8')).equals(before)) throw new Error('Source edit exceeds 16 MiB or is not UTF-8');
      const previousHash = sha(before), nextHash = sha(after);
      if (sha(await readSource(absolute)) !== previousHash) throw new SourceHistoryConflictError('Source changed since it was read; edit refused');
      if (previousHash === nextHash) continue;
      await snapshot(store,previousHash,before); await snapshot(store,nextHash,after);
      changes.push({file,before:previousHash,after:nextHash});
    }
    if (!changes.length) return {...status(state),changed:false,previousRevision:state.revision};
    const next: State = {...state,version:2,revision:randomUUID(),heads:{...state.heads},entries:[...state.entries]};
    for (const change of changes) next.heads[change.file] = change.after;
    let entry: Entry | undefined;
    if (options.record !== false) {
      next.entries = state.entries.slice(0,state.cursor);
      const previous = next.entries.at(-1);
      const merge = options.origin === 'manual' && !!options.groupId && state.cursor === state.entries.length && previous?.origin === 'manual' && previous.groupId === options.groupId;
      const files = new Map((merge ? entryFiles(previous!) : []).map(change => [change.file,{...change}]));
      for (const change of changes) files.set(change.file,{...change,before:files.get(change.file)?.before ?? change.before});
      const all = [...files.values()], primary = all[0]!;
      entry = {...primary,id:merge ? previous!.id : randomUUID(),origin:options.origin,
        label:(options.label || 'Edición manual').slice(0,200),createdAt:merge ? previous!.createdAt : new Date().toISOString(),
        ...(options.groupId ? {groupId:options.groupId.slice(0,200)} : {}),...(all.length > 1 ? {files:all} : {})};
      if (merge) next.entries[next.entries.length-1] = entry; else next.entries.push(entry);
      next.entries = next.entries.slice(-1000); next.cursor = next.entries.length;
    }
    await transactFiles(store,state,next,changes.map(change=>({file:change.file,from:change.before,to:change.after})),options.onBeforeWrite);
    return {...status(next),changed:true,previousRevision:state.revision,...(entry ? {entryId:entry.id}:{}),path:changes[0]!.file,sha256:changes[0]!.after};
  });
}

async function restore(options: RestoreSourceEditOptions, redo: boolean): Promise<SourceHistoryResult> {
  const store = await openStore(options.projectDir);
  return lock(store, async () => {
    const state = await recover(store);
    await checkHeads(store, state);
    const entry = state.entries[redo ? state.cursor : state.cursor - 1];
    if (!entry) return { ...status(state), changed: false };
    if (options.expectedEntryId && options.expectedEntryId !== entry.id) throw new Error("History changed: only the latest shared revision can be undone/redone");
    const files = entryFiles(entry);
    const expected = options.expectedFilePath ? await sourcePath(store.root,options.expectedFilePath) : undefined;
    const selected = expected ? files.find(change => resolve(store.root,change.file) === expected) : files[0];
    if (!selected) throw new Error('History changed: expected source is no longer the latest revision');
    const file = await sourcePath(store.root, selected.file);
    const currentHash = sha(await readSource(file));
    if (options.expectedSha256 && options.expectedSha256 !== currentHash) throw new Error("Source changed since it was read; undo/redo refused");
    const transfers: Transfer[] = [];
    const next: State = {...state,revision:randomUUID(),cursor:state.cursor+(redo?1:-1),heads:{...state.heads}};
    for (const change of files) {
      const nextHash = redo ? change.after : change.before;
      transfers.push({file:change.file,from:sha(await readSource(await sourcePath(store.root,change.file))),to:nextHash});
      next.heads[change.file] = nextHash;
    }
    await transactFiles(store,state,next,transfers);
    return {...status(next),changed:true,entryId:entry.id,path:selected.file,sha256:redo ? selected.after : selected.before};
  });
}

export const undoSourceEdit = (options: RestoreSourceEditOptions): Promise<SourceHistoryResult> => restore(options, false);
export const redoSourceEdit = (options: RestoreSourceEditOptions): Promise<SourceHistoryResult> => restore(options, true);
export { errorText as sourceHistoryError };
