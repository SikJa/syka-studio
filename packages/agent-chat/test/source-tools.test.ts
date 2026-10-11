/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SourceTools } from "../src/host/source-tools";
import { commitSourceEdit, getSourceHistoryStatus, redoSourceEdit, undoSourceEdit } from "../src/host/edit-journal";

let fixture: string;
let cwd: string;
let tools: SourceTools;
const original = 'export default () => <scene><text>Hello</text></scene>;\n';
type ReadSource = { content: string; sha256: string };
type EditedSource = { sha256: string; historyId: string };
beforeEach(async () => {
  fixture = await mkdtemp(join(tmpdir(), "syka-source-test-"));
  cwd = join(fixture, "project");
  await mkdir(cwd);
  await writeFile(join(cwd, "index.tsx"), original);
  tools = new SourceTools(cwd);
});
afterEach(async () => { await rm(fixture, { recursive: true, force: true }); });

describe("reversible authoring bridge", () => {
  it("reads bundled reference but rejects project files and escaped paths", async () => {
    const docs = join(fixture, "docs");
    await mkdir(docs);
    await writeFile(join(docs, "captions.md"), "Use captions src with real timed words.");
    const reference = new SourceTools(cwd, docs);
    expect(await reference.call("syka_read_reference", { path: "captions.md" })).toEqual({ path: "captions.md", content: "Use captions src with real timed words." });
    await expect(reference.call("syka_read_reference", { path: "../project/index.tsx" })).rejects.toThrow();
    await expect(reference.call("syka_read_reference", { path: join(cwd, "index.tsx") })).rejects.toThrow();
    await expect(tools.call("syka_read_reference", { path: "captions.md" })).rejects.toThrow(/not configured/);
  });
  it("reads, edits, backs up, and undoes the same composition", async () => {
    const source = await tools.call("syka_read_source", { path: "index.tsx" }) as ReadSource;
    const changed = original.replace("Hello", "Syka");
    const edit = await tools.call("syka_edit_source", { path: "index.tsx", expectedSha256: source.sha256, content: changed }) as EditedSource;
    expect(await readFile(join(cwd, "index.tsx"), "utf8")).toBe(changed);
    expect(await readFile(join(cwd, "90 Descartable", "Trabajo temporal", ".syka-history", edit.historyId + ".source"), "utf8")).toBe(original);
    await tools.call("syka_undo_source", { historyId: edit.historyId, expectedSha256: edit.sha256 });
    expect(await readFile(join(cwd, "index.tsx"), "utf8")).toBe(original);
    const restored = await tools.call("syka_read_source", { path: "index.tsx" }) as ReadSource;
    await tools.call("syka_redo_source", { historyId: edit.historyId, expectedSha256: restored.sha256 });
    expect(await readFile(join(cwd, "index.tsx"), "utf8")).toBe(changed);
  });

  it("shares chronology with manual editor changes and restores both across instances", async () => {
    const source = await tools.call("syka_read_source", { path: "index.tsx" }) as ReadSource;
    const changed = original.replace("Hello", "Codex");
    const chat = await tools.call("syka_edit_source", { path: "index.tsx", expectedSha256: source.sha256, content: changed }) as EditedSource;
    const manual = changed.replace("Codex", "Manual");
    await commitSourceEdit({ projectDir: cwd, filePath: "index.tsx", before: changed, after: manual, origin: "manual", label: "Mover texto" });
    const current = await tools.call("syka_read_source", { path: "index.tsx" }) as ReadSource;
    await expect(tools.call("syka_undo_source", { historyId: chat.historyId, expectedSha256: current.sha256 })).rejects.toThrow(/latest shared/);
    await undoSourceEdit({ projectDir: cwd });
    expect(await readFile(join(cwd, "index.tsx"), "utf8")).toBe(changed);
    const reloaded = new SourceTools(cwd);
    await reloaded.call("syka_undo_source", { historyId: chat.historyId, expectedSha256: chat.sha256 });
    expect(await readFile(join(cwd, "index.tsx"), "utf8")).toBe(original);
    expect((await getSourceHistoryStatus(cwd)).canRedo).toBe(true);
    await redoSourceEdit({ projectDir: cwd });
    await redoSourceEdit({ projectDir: cwd });
    expect(await readFile(join(cwd, "index.tsx"), "utf8")).toBe(manual);
  });

  it("rejects stale writes and stale undo without losing newer manual edits", async () => {
    const source = await tools.call("syka_read_source", { path: "index.tsx" }) as ReadSource;
    const edit = await tools.call("syka_edit_source", { path: "index.tsx", expectedSha256: source.sha256, content: "agent edit" }) as EditedSource;
    await writeFile(join(cwd, "index.tsx"), "manual edit");
    await expect(tools.call("syka_edit_source", { path: "index.tsx", expectedSha256: source.sha256, content: "stale edit" })).rejects.toThrow(/changed/);
    await expect(tools.call("syka_undo_source", { historyId: edit.historyId, expectedSha256: edit.sha256 })).rejects.toThrow(/changed/);
    expect(await readFile(join(cwd, "index.tsx"), "utf8")).toBe("manual edit");
  });

  it("rejects traversal, original media, hidden files and oversized writes", async () => {
    await writeFile(join(fixture, "outside.tsx"), "outside");
    await expect(tools.call("syka_read_source", { path: "../outside.tsx" })).rejects.toThrow(/inside/);
    await expect(tools.call("syka_read_source", { path: "clip.mp4" })).rejects.toThrow(/source/);
    await expect(tools.call("syka_read_source", { path: ".auth.json" })).rejects.toThrow(/hidden/);
    const source = await tools.call("syka_read_source", { path: "index.tsx" }) as ReadSource;
    await expect(tools.call("syka_edit_source", { path: "index.tsx", expectedSha256: source.sha256, content: "x".repeat(16 * 1024 * 1024 + 1) })).rejects.toThrow(/oversized/);
    expect(await readFile(join(cwd, "index.tsx"), "utf8")).toBe(original);
  });

  it("resolves junctions before reading source or creating a backup", async () => {
    const outside = join(fixture, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "external.tsx"), "external");
    await symlink(outside, join(cwd, "linked"), process.platform === "win32" ? "junction" : "dir");
    await expect(tools.call("syka_read_source", { path: "linked/external.tsx" })).rejects.toThrow(/escapes/);
    await symlink(outside, join(cwd, "90 Descartable"), process.platform === "win32" ? "junction" : "dir");
    const source = await tools.call("syka_read_source", { path: "index.tsx" }) as ReadSource;
    await expect(tools.call("syka_edit_source", { path: "index.tsx", expectedSha256: source.sha256, content: "edit" })).rejects.toThrow(/History path/);
    expect(await readFile(join(cwd, "index.tsx"), "utf8")).toBe(original);
  });
});
