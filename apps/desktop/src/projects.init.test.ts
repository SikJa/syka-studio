/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// What `open` writes into a folder, and what it refuses: the promise the
// tool reference makes is that a folder opened from anywhere on disk stays
// the user's, gaining an entry and the record and nothing else.

import { tmpdir } from "node:os";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { isPackaged: false, getPath: () => tmpdir() },
  dialog: {},
  shell: {},
  ipcMain: { on: () => { } },
}));

const { initProject } = await import("./projects");

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "init-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("initProject", () => {
  it("turns a missing folder into a project with an entry and a record, nothing else", async () => {
    const dir = join(root, "fresh");
    const project = await initProject(null, dir);
    expect(project.id).toMatch(/^[\w-]{21}$/);
    expect(project.name).toBe("fresh");
    expect(project.entry).toBe("index.tsx");
    expect((await readdir(dir)).sort()).toEqual(["index.tsx", "package.json"]);
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    expect(pkg).toMatchObject({ projectId: project.id, displayName: "fresh", main: "index.tsx" });
  });

  it("leaves a folder that is already a project untouched", async () => {
    const dir = join(root, "kept");
    await initProject(null, dir);
    const before = await readFile(join(dir, "package.json"), "utf8");
    await writeFile(join(dir, "notes.txt"), "mine");
    const again = await initProject(null, dir);
    expect(again.id).toBe(JSON.parse(before).projectId);
    expect(await readFile(join(dir, "package.json"), "utf8")).toBe(before);
    expect((await readdir(dir)).sort()).toEqual(["index.tsx", "notes.txt", "package.json"]);
  });

  it("keeps what a package.json already says and only adds the record fields", async () => {
    const dir = join(root, "partial");
    await mkdir(dir);
    await writeFile(join(dir, "main.tsx"), "export default () => <stage />;\n");
    await writeFile(join(dir, "package.json"), JSON.stringify({ name: "partial", main: "main.tsx", scripts: { build: "x" } }, null, 2) + "\n");
    const project = await initProject(null, dir);
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    expect(pkg.name).toBe("partial");
    expect(pkg.main).toBe("main.tsx");
    expect(pkg.scripts).toEqual({ build: "x" });
    expect(pkg.projectId).toBe(project.id);
    expect((await readdir(dir)).sort()).toEqual(["main.tsx", "package.json"]);
  });

  it("leaves a JavaScript project entirely alone", async () => {
    const dir = join(root, "js");
    await mkdir(dir);
    await writeFile(join(dir, "index.jsx"), "export default () => null;\n");
    const project = await initProject(null, dir);
    expect(project.id).toBe("");
    expect(await readdir(dir)).toEqual(["index.jsx"]);
  });

  it("refuses a relative path and a path that is a file", async () => {
    await expect(initProject(null, "relative/project")).rejects.toThrow(/absolute path/);
    const file = join(root, "a-file");
    await writeFile(file, "");
    await expect(initProject(null, file)).rejects.toThrow(/not a folder/);
    expect(await readFile(file, "utf8")).toBe("");
  });
});
