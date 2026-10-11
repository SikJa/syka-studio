/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GeneratedImages, imageFormat } from "../src/host/generated-images";
import { publicAddress, publicUrl, BrowserTools } from "../src/host/browser-tools";
import { appServerArgs } from "../src/host/codex";

const folders: string[] = [];
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2uoAAAAASUVORK5CYII=", "base64");
async function folder() { const dir = await mkdtemp(join(tmpdir(), "syka-image-test-")); folders.push(dir); return dir; }
afterEach(async () => { await Promise.all(folders.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe("Native subscription image results", () => {
  it("keeps native web/image and project shell tools without inheriting browser integrations", () => {
    const args = appServerArgs({}, null);
    expect(args).toContain('web_search="live"');
    expect(args).toContain("features.image_generation=true");
    expect(args).toContain("features.browser_use=false");
    expect(args).toContain("features.shell_tool=true");
    expect(args).toContain("features.unified_exec=true");
    expect(args).toContain("mcp_servers={}");
  });
  it("stores real image bytes in the project with a unique name and preview", async () => {
    const cwd = await folder();
    const images = new GeneratedImages(cwd);
    const first = await images.save(png.toString("base64"));
    const second = await images.save("data:image/png;base64," + png.toString("base64"));
    expect(first.path).toMatch(/^03 Assets reutilizables\/Generados\/Codex\/codex-/);
    expect(first.absolutePath).not.toBe(second.absolutePath);
    expect(await readFile(first.absolutePath)).toEqual(png);
    expect(first.images).toEqual([{ mediaType: "image/png", data: png.toString("base64") }]);
    expect(images.list().map((image) => image.absolutePath)).toEqual([first.absolutePath, second.absolutePath]);
  });
  it("rejects missing, nonimage and outside-project artifacts", async () => {
    const cwd = await folder();
    const outside = await folder();
    await writeFile(join(outside, "outside.png"), png);
    const images = new GeneratedImages(cwd);
    await expect(images.save(undefined)).rejects.toThrow(/did not provide/);
    await expect(images.save("YWJjZGVmZ2hpamtsbW5vcA==")).rejects.toThrow(/unsupported/);
    await expect(images.save(null, join(outside, "outside.png"))).rejects.toThrow(/outside/);
    expect(() => imageFormat(Buffer.alloc(21 * 1024 * 1024))).toThrow(/20 MiB/);
  });
  it("reads an existing completed image and preserves the original", async () => {
    const cwd = await folder();
    const path = join(cwd, "native.png");
    await writeFile(path, png);
    const saved = await new GeneratedImages(cwd).save(null, path);
    expect(await readFile(path)).toEqual(png);
    expect(await readFile(saved.absolutePath)).toEqual(png);
  });
  it("rejects an asset folder junction before writing files outside the project", async () => {
    const cwd = await folder();
    const outside = await folder();
    await symlink(outside, join(cwd, "03 Assets reutilizables"), process.platform === "win32" ? "junction" : "dir");
    await expect(new GeneratedImages(cwd).save(png.toString("base64"))).rejects.toThrow(/escapes/);
  });
});

describe("Public read-only browser boundaries", () => {
  it("rejects private, local, nonweb, credential and nonstandard port URLs", () => {
    for (const address of ["127.0.0.1", "10.0.0.1", "172.16.1.1", "192.168.1.1", "169.254.169.254", "100.64.1.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"]) expect(publicAddress(address)).toBe(false);
    for (const url of ["http://127.0.0.1", "http://localhost", "http://host.local", "file:///C:/private", "https://user:pass@example.com", "http://example.com:3275"]) expect(() => publicUrl(url)).toThrow();
    expect(publicUrl("https://example.com/docs").hostname).toBe("example.com");
    expect(publicAddress("8.8.8.8")).toBe(true);
  });
  it("does not expose evaluation, clicking, form submission or reading the personal browser", async () => {
    const tools = new BrowserTools(await folder(), await folder());
    await expect(tools.call("syka_browser_evaluate", { script: "alert(1)" })).rejects.toThrow(/Unknown/);
    await expect(tools.call("syka_browser_open", { url: "https://example.com", userDataDir: "personal" })).rejects.toThrow(/only/);
    await expect(tools.call("syka_browser_read", {})).rejects.toThrow(/Open/);
    await tools.close();
    await expect(tools.call("syka_browser_read", {})).rejects.toThrow(/closed/);
  });
});
