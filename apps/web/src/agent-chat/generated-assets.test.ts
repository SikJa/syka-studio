/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetLibrary, type Manifest, type ProjectFS } from "@diffusionstudio/assets";
import type { Item } from "@diffusionstudio/agent-chat";
import { generatedImageOutput, registerGeneratedImage } from "./generated-assets";

const project = "D:/Syka Media/Prueba";
const path = "03 Assets reutilizables/Generados/Codex/codex-9df30299-bbcf-4347-8091-093d55fa76cc.png";
const source = `${project}/${path}`;
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 1, 2, 3, 4]);
const nativeItem = (): Item => ({ id: "image-1", kind: "tool", name: "imageGeneration", title: "Imagen", status: "done", output: JSON.stringify({ path, absolutePath: source, bytes: bytes.length, provider: "Codex subscription" }) });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };

function fixture() {
  let manifest: Manifest = { version: 1, folders: ["Manual"], assets: [{ id: "manual-asset", path: "Manual/original.png", source: `${project}/manual.png`, createdAt: "2026-09-29", type: "IMAGE", mimeType: "image/png", width: 8, height: 8, stat: { size: 2, mtime: 1 } }] };
  let readGate: Promise<void> | undefined;
  let onRead = () => {};
  const files = new Map([[source, new File([bytes], "codex.png", { type: "image/png" })]]);
  const writes = vi.fn();
  const absolute = (value: string) => /^[a-z]:[\\/]/i.test(value) ? value.replaceAll("\\", "/") : `${project}/${value}`;
  const fs: ProjectFS = {
    readManifest: async () => { const read = structuredClone(manifest); onRead(); if (readGate) await readGate; return read; },
    writeManifest: async value => { manifest = structuredClone(value); },
    list: async () => [],
    stat: async value => absolute(value) === `${project}/manual.png` ? { size: 2, mtime: 1 } : files.has(absolute(value)) ? { size: files.get(absolute(value))!.size, mtime: 1 } : null,
    file: async value => { const file = files.get(absolute(value)); if (!file) throw new Error("Missing file"); return file; },
    write: writes,
    remove: async () => {},
    realPath: async value => absolute(value),
    absolute,
  };
  // A project root is already absolute; it is not a file but realPath can resolve it.
  fs.realPath = async value => value === project ? project : absolute(value);
  return { fs, files, writes, manifest: () => manifest, gate: (value?: Promise<void>) => { readGate = value; }, observeRead: (action: () => void) => { onRead = action; } };
}

beforeEach(() => vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 32, height: 32, close() {} }))));
afterEach(() => vi.unstubAllGlobals());

describe("native generated image registration", () => {
  it("accepts only successful native host output, excluding model prose and browser tools", () => {
    expect(generatedImageOutput(nativeItem())?.absolutePath).toBe(source);
    expect(generatedImageOutput({ id: "a", kind: "assistant", text: JSON.stringify({ absolutePath: source }) })).toBeNull();
    for (const override of [{ name: "syka_browser_screenshot" }, { status: "failed" }, { output: JSON.stringify({ path, absolutePath: source, bytes: bytes.length, provider: "Other" }) }]) {
      expect(generatedImageOutput({ ...nativeItem(), ...override } as Item)).toBeNull();
    }
  });

  it("waits for initial loading, preserves manual assets, and deduplicates concurrent/reopened chat imports", async () => {
    const test = fixture();
    const library = new AssetLibrary(test.fs);
    const gate = deferred();
    test.gate(gate.promise);
    const loading = library.load();
    const imports = [registerGeneratedImage(library, project, nativeItem()), registerGeneratedImage(library, project, nativeItem())];
    gate.resolve();
    await loading;
    const [image, duplicate] = await Promise.all(imports);
    expect(image?.id).toBe(duplicate?.id);
    expect(image?.path).toMatch(/^Generados\/Codex\//);
    expect(test.manifest().assets).toHaveLength(2);
    expect(test.manifest().assets.find(asset => asset.id === "manual-asset")?.path).toBe("Manual/original.png");
    expect(test.writes).not.toHaveBeenCalled();
    expect(test.files.get(source)?.size).toBe(bytes.length);
    await library.dispose();
    test.gate();
    const reopened = new AssetLibrary(test.fs);
    await registerGeneratedImage(reopened, project, nativeItem());
    expect(test.manifest().assets).toHaveLength(2);
    await reopened.dispose();
  });

  it("rejects a junction escape and altered bytes without registering them", async () => {
    const escaped = fixture();
    escaped.fs.realPath = async value => value === project ? project : "C:/Outside/image.png";
    const library = new AssetLibrary(escaped.fs);
    await expect(registerGeneratedImage(library, project, nativeItem())).rejects.toThrow("carpeta autorizada");
    expect(escaped.manifest().assets).toHaveLength(1);
    await library.dispose();
    const modified = fixture();
    modified.files.set(source, new File([new Uint8Array(100)], "changed.png"));
    const other = new AssetLibrary(modified.fs);
    await expect(registerGeneratedImage(other, project, nativeItem())).rejects.toThrow("cambió");
    await other.dispose();
  });

  it("does not accept a successful native output from another project", async () => {
    const test = fixture();
    const library = new AssetLibrary(test.fs);
    await expect(registerGeneratedImage(library, `${project}/Other`, nativeItem())).rejects.toThrow("otro proyecto");
    await library.dispose();
  });

  it("serializes reloads during an import and preserves a manual rename during a manifest read", async () => {
    const test = fixture();
    const library = new AssetLibrary(test.fs);
    await library.load();
    const bitmapGate = deferred();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { await bitmapGate.promise; return { width: 32, height: 32, close() {} }; }));
    const importing = library.import([source], { folder: "Generados/Codex" });
    const reload = library.load();
    bitmapGate.resolve();
    await importing;
    await reload;
    expect(library.assets()).toHaveLength(2);
    const readGate = deferred();
    const entered = deferred();
    test.gate(readGate.promise);
    test.observeRead(entered.resolve);
    const reading = library.load();
    await entered.promise;
    library.rename(library.get("manual-asset")!, "renamed.png");
    readGate.resolve();
    await reading;
    await library.flush();
    expect(library.get("manual-asset")?.path).toBe("Manual/renamed.png");
    expect(test.manifest().assets).toHaveLength(2);
    expect(test.manifest().assets.find(asset => asset.id === "manual-asset")?.path).toBe("Manual/renamed.png");
    await library.dispose();
  });

  it("keeps recursive folder imports inside the queue without deadlocking a pending reload", async () => {
    const test = fixture();
    const folder = `${project}/Folder`;
    const nested = `${folder}/nested.png`;
    test.files.set(nested, new File([bytes], "nested.png", { type: "image/png" }));
    test.fs.list = async value => value === folder ? [{ name: "nested.png", kind: "file", size: bytes.length, mtime: 1 }] : [];
    const library = new AssetLibrary(test.fs);
    const imported = library.import([folder]);
    const reload = library.load();
    expect((await imported).failed).toHaveLength(0);
    await reload;
    expect(library.assets().find(asset => asset.source === nested)?.path).toBe("Folder/nested.png");
    await library.dispose();
  });
});
