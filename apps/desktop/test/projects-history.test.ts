/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatSource } from "@diffusionstudio/jsx";

const bridge = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock("../src/main-manager", () => ({ mainBridge: bridge }));
vi.mock("electron", () => ({ app: { isPackaged: false }, dialog: {}, shell: {} }));
import { compileProject, projectEditHistory, unwatchAll, watchProject, writeProject } from "../src/projects";
import { commitSourceEdit, getSourceHistoryStatus } from "../../../packages/agent-chat/src/host/edit-journal";
import { SourceTools } from "../../../packages/agent-chat/src/host/source-tools";

const qaRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.runtime/diffusion/qa");
const initial = 'export default () => <scene id="scene"><video id="video" src="assets/video.mp4" /></scene>;\n';
const video = formatSource("index.tsx", "video");
const scene = formatSource("index.tsx", "scene");
let fixture: string;
let dir: string;
let file: string;
const source = (): Promise<string> => readFile(file, "utf8");
const metadata = async () => JSON.parse(await readFile(join(dir, ".syka/edit-history/journal.json"), "utf8"));

beforeEach(async () => {
  await mkdir(qaRoot, { recursive: true });
  fixture = await mkdtemp(join(qaRoot, "project-history-"));
  dir = join(fixture, "Proyecto 🧩 con espacios");
  await mkdir(dir);
  file = join(dir, "index.tsx");
  await writeFile(file, initial);
  bridge.emit.mockReset();
});
afterEach(async () => {
  unwatchAll();
  const rel = relative(qaRoot, resolve(fixture));
  if (!rel || rel === ".." || rel.startsWith(".." + sep)) throw new Error("Invalid QA cleanup target");
  await rm(fixture, { recursive: true, force: true });
});

describe("desktop writes and shared journal", () => {
  it("records the actual insert-audio + mute transform as one reversible batch", async () => {
    const result = await writeProject(dir, [
      { kind: "insert", source: "pending:audio", parent: scene, tag: "audio", props: { src: "assets/video.mp4" } },
      { kind: "set", source: video, props: { muted: true } },
    ], "separate-audio");
    expect(result.error).toBeUndefined(); expect(result.skipped).toEqual([]);
    expect(result.ids?.["pending:audio"]).toMatch(/^index\.tsx:/);
    const separated = await source();
    expect(separated).toContain("<audio"); expect(separated).toMatch(/<video[^>]+\bmuted(?:\s|\/)/);
    expect((await metadata()).entries).toHaveLength(1);
    expect(await projectEditHistory(dir, "undo")).toMatchObject({ ok: true, changed: true, canRedo: true });
    expect(await source()).toBe(initial);
    expect(await projectEditHistory(dir, "redo")).toMatchObject({ ok: true, changed: true });
    expect(await source()).toBe(separated);
  });

  it("merges successive batches from one gesture, while a distinct gesture stays separate", async () => {
    expect((await writeProject(dir, [{ kind: "set", source: video, props: { gain: 0.4 } }], "gesture-1")).error).toBeUndefined();
    expect((await writeProject(dir, [{ kind: "set", source: video, props: { gain: 0.6 } }], "gesture-1")).error).toBeUndefined();
    const gesture1 = await source();
    expect((await metadata()).entries).toHaveLength(1);
    await writeProject(dir, [{ kind: "set", source: video, props: { muted: true } }], "gesture-2");
    expect((await metadata()).entries).toHaveLength(2);
    await projectEditHistory(dir, "undo"); expect(await source()).toBe(gesture1);
    await projectEditHistory(dir, "undo"); expect(await source()).toBe(initial);
  });

  it("shares real manual → SourceTools chat → manual chronology after reopening tools", async () => {
    await writeProject(dir, [{ kind: "set", source: video, props: { gain: 0.5 } }]);
    const manual = await source();
    let tools = new SourceTools(dir);
    const read = await tools.call("syka_read_source", { path: "index.tsx" }) as { sha256: string };
    const chat = manual + "// Edición de Codex 🧩\n";
    await tools.call("syka_edit_source", { path: "index.tsx", expectedSha256: read.sha256, content: chat });
    await writeProject(dir, [{ kind: "set", source: video, props: { muted: true } }]);
    const final = await source();
    tools = new SourceTools(dir); // A new host instance does not reset history.
    expect((await tools.call("syka_read_source", { path: "index.tsx" }) as { content: string }).content).toBe(final);
    expect((await metadata()).entries.map((entry: { origin: string }) => entry.origin)).toEqual(["manual", "chat", "manual"]);
    for (const expected of [chat, manual, initial]) {
      expect(await projectEditHistory(dir, "undo")).toMatchObject({ ok: true, changed: true });
      expect(await source()).toBe(expected);
    }
    for (const expected of [manual, chat, final]) {
      expect(await projectEditHistory(dir, "redo")).toMatchObject({ ok: true, changed: true });
      expect(await source()).toBe(expected);
    }
  });

  it("saves a two-source batch as one shared undo/redo entry", async () => {
    const other = join(dir, "otro 🧩.tsx");
    const originalOther = 'export default () => <video id="other" src="other.mp4" />;\n';
    await writeFile(other, originalOther);
    const result = await writeProject(dir, [
      { kind: "set", source: video, props: { muted: true } },
      { kind: "set", source: formatSource("otro 🧩.tsx", "other"), props: { gain: 0.2 } },
    ]);
    expect(result.error).toBeUndefined(); expect(result.skipped).toEqual([]);
    const saved = await source(), savedOther = await readFile(other,'utf8');
    expect(saved).toContain('muted'); expect(savedOther).toContain('gain={0.2}');
    expect((await metadata()).entries).toHaveLength(1);
    await projectEditHistory(dir,'undo');
    expect(await source()).toBe(initial); expect(await readFile(other,'utf8')).toBe(originalOther);
    await projectEditHistory(dir,'redo');
    expect(await source()).toBe(saved); expect(await readFile(other,'utf8')).toBe(savedOther);
  });

  it("persists view-only selection without adding an undo entry or invalidating redo", async () => {
    await writeProject(dir, [{ kind: "set", source: video, props: { selected: true } }]);
    const selected = await source(); expect(selected).toMatch(/<video[^>]+\bselected(?:\s|\/)/);
    expect(await projectEditHistory(dir)).toMatchObject({ ok: true, canUndo: false });
    await writeProject(dir, [{ kind: "set", source: video, props: { gain: 0.5 } }]);
    await projectEditHistory(dir, "undo"); expect(await source()).toBe(selected);
    await writeProject(dir, [{ kind: "set", source: video, props: { selected: false } }]);
    expect(await projectEditHistory(dir)).toMatchObject({ ok: true, canRedo: true });
    expect((await metadata()).entries).toHaveLength(1);
    expect(await projectEditHistory(dir, "redo")).toMatchObject({ ok: true, changed: true });
  });

  it("returns an actionable external-edit conflict without changing the external source", async () => {
    await writeProject(dir, [{ kind: "set", source: video, props: { gain: 0.5 } }]);
    const external = (await source()) + "// Guardado desde otro editor\n";
    await writeFile(file, external);
    expect(await projectEditHistory(dir, "undo")).toMatchObject({ ok: false, error: expect.stringMatching(/outside shared history/) });
    expect((await writeProject(dir, [{ kind: "set", source: video, props: { muted: true } }])).error).toMatch(/outside shared history/);
    expect(await source()).toBe(external);
  });

  it("compiles a new unkeyed external element without stamping or resetting blocked undo", async () => {
    await writeProject(dir, [{ kind: "set", source: video, props: { gain: 0.5 } }]);
    const external = (await source()).replace("</scene>", "<text>Texto de otro editor</text></scene>");
    await writeFile(file, external);
    const compiled = await compileProject(dir);
    expect(compiled).toMatchObject({ ok: true, warning: expect.stringMatching(/edición externa/) });
    if (!compiled.ok) throw new Error(compiled.error);
    expect(compiled.code).toContain("Texto de otro editor");
    expect(await source()).toBe(external);
    expect(await projectEditHistory(dir, "undo")).toMatchObject({ ok: false, error: expect.stringMatching(/outside shared history/) });
    expect((await metadata()).entries).toHaveLength(1);
    expect(await source()).toBe(external);
  }, 20_000); // Cold Babel/esbuild compilation of a real project can exceed 5s on Windows.

  it("ignores journal files but reports chat edits and source restored through undo", async () => {
    watchProject(null, dir);
    await getSourceHistoryStatus(dir);
    await new Promise(resolve => setTimeout(resolve, 120));
    expect(bridge.emit).not.toHaveBeenCalled();
    await writeProject(dir, [{ kind: "set", source: video, props: { gain: 0.5 } }]);
    await new Promise(resolve => setTimeout(resolve, 120));
    expect(bridge.emit).not.toHaveBeenCalled(); // Manual source is already rendered.
    const before = await source();
    await commitSourceEdit({ projectDir: dir, filePath: "index.tsx", before, after: before + "// chat\n", origin: "chat" });
    await vi.waitFor(() => expect(bridge.emit).toHaveBeenCalledWith(null, "projects:changed", { dir, path: "index.tsx" }));
    bridge.emit.mockClear();
    await projectEditHistory(dir, "undo");
    await vi.waitFor(() => expect(bridge.emit).toHaveBeenCalledWith(null, "projects:changed", { dir, path: "index.tsx" }));
    expect(bridge.emit.mock.calls.every(([, , event]) => event.path === "index.tsx")).toBe(true);
  });
});
