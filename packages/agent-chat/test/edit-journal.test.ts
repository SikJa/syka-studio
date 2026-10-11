/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, rmdir, symlink, unlink, utimes, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commitSourceEdit, commitSourceEdits, getSourceHistoryStatus, undoSourceEdit, redoSourceEdit } from "../src/host/edit-journal";

const qaRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.runtime/diffusion/qa");
const hash = (text: string): string => createHash("sha256").update(text).digest("hex");
const initial = 'export default () => <scene><text>Inicial</text></scene>;\n';
let fixture: string;
let dir: string;
let file: string;
const contents = (): Promise<string> => readFile(file, "utf8");
const commit = async (after: string, origin: "manual" | "chat", extra: Partial<Parameters<typeof commitSourceEdit>[0]> = {}) => commitSourceEdit({ projectDir: dir, filePath: "index.tsx", before: await contents(), after, origin, ...extra });

beforeEach(async () => {
  await mkdir(qaRoot, { recursive: true });
  fixture = await mkdtemp(join(qaRoot, "journal-test-"));
  dir = join(fixture, "Proyecto 🧩 Demo");
  await mkdir(dir);
  file = join(dir, "index.tsx");
  await writeFile(file, initial);
});
afterEach(async () => {
  // Never recursively delete a fixture outside the explicit QA workspace.
  const rel = relative(qaRoot, resolve(fixture));
  if (!rel || rel === ".." || rel.startsWith(".." + sep)) throw new Error("Invalid QA cleanup target");
  await rm(fixture, { recursive: true, force: true });
});

describe("shared source history", () => {
  it('validates all batch files before touching any, and rolls back ordinary write failures',async()=>{
    const other=join(dir,'other.tsx'); await writeFile(other,'other before');
    const changes=[{filePath:file,before:initial,after:'index after'},{filePath:other,before:'stale',after:'other after'}];
    await expect(commitSourceEdits({projectDir:dir,origin:'manual',changes})).rejects.toThrow(/changed since/);
    expect(await contents()).toBe(initial);
    changes[1]!.before='other before';
    await expect(commitSourceEdits({projectDir:dir,origin:'manual',changes,onBeforeWrite:(path,text)=>{
      if(path===other && text==='other after')throw Error('disk failure');
    }})).rejects.toThrow('disk failure');
    expect(await contents()).toBe(initial); expect(await readFile(other,'utf8')).toBe('other before');
    expect(await getSourceHistoryStatus(dir)).toMatchObject({canUndo:false});
    await expect(readFile(join(dir,'.syka/edit-history/pending.json'))).rejects.toMatchObject({code:'ENOENT'});
  });

  it('recovers a partly written multi-file transaction before allowing further edits',async()=>{
    const other=join(dir,'other.tsx'); await writeFile(other,'other before');
    const result=await commitSourceEdits({projectDir:dir,origin:'manual',changes:[
      {filePath:file,before:initial,after:'index after'},{filePath:other,before:'other before',after:'other after'}]});
    const history=join(dir,'.syka/edit-history');
    const committed=JSON.parse(await readFile(join(history,'journal.json'),'utf8'));
    await undoSourceEdit({projectDir:dir});
    const before=JSON.parse(await readFile(join(history,'journal.json'),'utf8'));
    const pending={version:2,previousRevision:before.revision,next:committed,files:[
      {file:'index.tsx',from:hash(initial),to:hash('index after')},
      {file:'other.tsx',from:hash('other before'),to:hash('other after')}]};
    await writeFile(file,'index after'); // Process died between source renames.
    await writeFile(join(history,'pending.json'),JSON.stringify(pending));
    expect(await getSourceHistoryStatus(dir)).toMatchObject({revision:result.revision,canUndo:true});
    expect(await readFile(other,'utf8')).toBe('other after');
    await undoSourceEdit({projectDir:dir});
    await writeFile(join(history,'pending.json'),JSON.stringify({...pending,previousRevision:(await getSourceHistoryStatus(dir)).revision}));
    await writeFile(other,'external edit');
    await expect(getSourceHistoryStatus(dir)).rejects.toThrow(/recovery refused/);
    expect(await contents()).toBe(initial); expect(await readFile(other,'utf8')).toBe('external edit');
  });
  it("persists manual → chat → manual and restores exact bytes through undo/redo", async () => {
    const a = initial.replace("Inicial", "manual 1");
    const b = initial.replace("Inicial", "chat 2");
    const c = initial.replace("Inicial", "manual 3");
    await commit(a, "manual"); await commit(b, "chat"); await commit(c, "manual");
    for (const expected of [b, a, initial]) { expect((await undoSourceEdit({ projectDir: dir })).changed).toBe(true); expect(await contents()).toBe(expected); }
    expect(await getSourceHistoryStatus(dir)).toMatchObject({ canUndo: false, canRedo: true });
    for (const expected of [a, b, c]) { await redoSourceEdit({ projectDir: dir }); expect(await contents()).toBe(expected); }
    const metadata = JSON.parse(await readFile(join(dir, ".syka/edit-history/journal.json"), "utf8"));
    expect(metadata.entries.map((entry: { origin: string }) => entry.origin)).toEqual(["manual", "chat", "manual"]);
    expect(metadata.cursor).toBe(3);
  });

  it("groups adjacent manual insert + mute into one undo, but never crosses a chat edit", async () => {
    const inserted = initial.replace("</scene>", '<audio src="voice.mp4" /></scene>');
    const muted = inserted.replace("<text>", "<text muted>");
    const first = await commit(inserted, "manual", { groupId: "split-audio" });
    const second = await commit(muted, "manual", { groupId: "split-audio" });
    expect(second.entryId).toBe(first.entryId);
    await undoSourceEdit({ projectDir: dir }); expect(await contents()).toBe(initial);
    await redoSourceEdit({ projectDir: dir }); expect(await contents()).toBe(muted);
    await commit(muted.replace("Inicial", "chat"), "chat");
    await commit(muted.replace("Inicial", "third"), "manual", { groupId: "split-audio" });
    await undoSourceEdit({ projectDir: dir }); expect(await contents()).toContain("chat");
  });

  it("invalidates redo after a new semantic edit and rejects an old chat historyId", async () => {
    const old = await commit("first", "chat"); await commit("second", "manual");
    await expect(undoSourceEdit({ projectDir: dir, expectedEntryId: old.entryId })).rejects.toThrow(/latest shared revision/);
    expect(await contents()).toBe("second");
    await undoSourceEdit({ projectDir: dir });
    await commit("replacement", "manual");
    expect(await getSourceHistoryStatus(dir)).toMatchObject({ canUndo: true, canRedo: false });
    expect((await redoSourceEdit({ projectDir: dir })).changed).toBe(false);
  });

  it("advances CAS heads for view/stamping writes without creating entries or clearing redo", async () => {
    await commit(initial + "// camera\n", "manual", { record: false });
    expect(await getSourceHistoryStatus(dir)).toMatchObject({ canUndo: false, canRedo: false });
    await commit("semantic", "chat");
    await commit("semantic // selection", "manual", { record: false });
    await undoSourceEdit({ projectDir: dir });
    expect(await contents()).toBe(initial + "// camera\n");
    await commit(initial + "// other camera\n", "manual", { record: false });
    expect(await getSourceHistoryStatus(dir)).toMatchObject({ canRedo: true });
    await redoSourceEdit({ projectDir: dir }); expect(await contents()).toBe("semantic");
  });

  it("refuses stale CAS and external changes without overwriting them", async () => {
    await commit("manual", "manual");
    await expect(commitSourceEdit({ projectDir: dir, filePath: file, before: initial, after: "stale", origin: "chat" })).rejects.toThrow(/changed/);
    await writeFile(file, "external editor");
    await expect(getSourceHistoryStatus(dir)).rejects.toThrow(/outside shared history/);
    await expect(undoSourceEdit({ projectDir: dir })).rejects.toThrow(/outside shared history/);
    await expect(commit("overwrite", "manual")).rejects.toThrow(/outside shared history/);
    expect(await contents()).toBe("external editor");
  });

  it("handles chronology across different files and blocks external edits in another tracked file", async () => {
    const other = join(dir, "otro 🧩.tsx"); await writeFile(other, "other before");
    await commit("index after", "manual");
    await commitSourceEdit({ projectDir: dir, filePath: other, before: "other before", after: "other after", origin: "chat" });
    await undoSourceEdit({ projectDir: dir }); expect(await readFile(other, "utf8")).toBe("other before");
    await undoSourceEdit({ projectDir: dir }); expect(await contents()).toBe(initial);
    await writeFile(other, "external other");
    await expect(redoSourceEdit({ projectDir: dir })).rejects.toThrow(/outside shared history/);
    expect(await contents()).toBe(initial);
  });

  it("checks snapshot integrity and refuses source/history junction escapes", async () => {
    await commit("edited", "manual");
    await writeFile(join(dir, ".syka/edit-history/snapshots", hash(initial) + ".source"), "tampered");
    await expect(undoSourceEdit({ projectDir: dir })).rejects.toThrow(/integrity mismatch/);
    expect(await contents()).toBe("edited");
    const outside = join(fixture, "outside"); await mkdir(outside);
    await writeFile(join(outside, "evil.tsx"), "outside");
    await symlink(outside, join(dir, "linked"), process.platform === "win32" ? "junction" : "dir");
    await expect(commitSourceEdit({ projectDir: dir, filePath: "linked/evil.tsx", before: "outside", after: "bad", origin: "chat" })).rejects.toThrow(/escapes/);
    const fresh = join(fixture, "fresh"); await mkdir(fresh);
    await symlink(outside, join(fresh, ".syka"), process.platform === "win32" ? "junction" : "dir");
    await expect(getSourceHistoryStatus(fresh)).rejects.toThrow(/history path escapes/);
  });

  it("recovers an interrupted transaction and preserves an unexpected external file", async () => {
    await commit("after", "manual"); await undoSourceEdit({ projectDir: dir });
    const history = join(dir, ".syka/edit-history");
    const state = JSON.parse(await readFile(join(history, "journal.json"), "utf8"));
    const next = { ...state, revision: "recovered-revision", cursor: 1, heads: { "index.tsx": hash("after") } };
    const pending = { version: 1, previousRevision: state.revision, next, file: "index.tsx", from: hash(initial), to: hash("after") };
    await writeFile(join(history, "pending.json"), JSON.stringify(pending));
    expect(await getSourceHistoryStatus(dir)).toMatchObject({ revision: "recovered-revision", canUndo: true });
    expect(await contents()).toBe("after");
    await undoSourceEdit({ projectDir: dir });
    const again = JSON.parse(await readFile(join(history, "journal.json"), "utf8"));
    await writeFile(join(history, "pending.json"), JSON.stringify({ ...pending, previousRevision: again.revision }));
    await writeFile(file, "external during interrupted transaction");
    await expect(getSourceHistoryStatus(dir)).rejects.toThrow(/recovery refused/);
    expect(await contents()).toBe("external during interrupted transaction");
  });

  it("reclaims an old ownerless lock after a process dies before owner metadata", async () => {
    await getSourceHistoryStatus(dir);
    const lock = join(dir, ".syka/edit-history/lock"); await mkdir(lock);
    const old = new Date(Date.now() - 120_000); await utimes(lock, old, old);
    expect(await getSourceHistoryStatus(dir)).toMatchObject({ canUndo: false });
  });

  it("waits for fresh ownerless and live-owner locks instead of stealing them", async () => {
    await getSourceHistoryStatus(dir);
    const lock = join(dir, ".syka/edit-history/lock");
    for (const liveOwner of [false, true]) {
      await mkdir(lock);
      if (liveOwner) await writeFile(join(lock, "owner.json"), JSON.stringify({ pid: process.pid, token: "other-writer" }));
      let released = false;
      const release = new Promise<void>((done, fail) => setTimeout(async () => {
        try {
          if (liveOwner) await unlink(join(lock, "owner.json"));
          await rmdir(lock); released = true; done();
        } catch (error) { fail(error); }
      }, 100));
      expect(await getSourceHistoryStatus(dir)).toMatchObject({ canUndo: false });
      expect(released).toBe(true);
      await release;
    }
  });

  it("serializes two independent processes: one succeeds, the other gets stale CAS", async () => {
    const moduleUrl = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), "../src/host/edit-journal.ts")).href;
    const run = promisify(execFile);
    const script = (after: string) => `import {commitSourceEdit} from ${JSON.stringify(moduleUrl)};\ntry { await commitSourceEdit(${JSON.stringify({ projectDir: dir, filePath: "index.tsx", before: initial, after, origin: "chat" })}); console.log('committed'); } catch (error) { console.log('rejected:' + error.message); }`;
    const processes = await Promise.all([run(process.execPath, ["--input-type=module", "-e", script("process A")]), run(process.execPath, ["--input-type=module", "-e", script("process B")])]);
    expect(processes.filter(result => result.stdout.includes("committed"))).toHaveLength(1);
    expect(processes.filter(result => result.stdout.includes("rejected:Source changed"))).toHaveLength(1);
    expect(["process A", "process B"]).toContain(await contents());
    const metadata = JSON.parse(await readFile(join(dir, ".syka/edit-history/journal.json"), "utf8"));
    expect(metadata.entries).toHaveLength(1);
  }, 15_000);
});
