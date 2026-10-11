/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { ToolImage } from "../protocol";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const INLINE_IMAGE_BYTES = 2 * 1024 * 1024;
export const GENERATED_IMAGE_TOOLS = [{ type: "function", name: "syka_generated_images", description: "List the completed Codex image results saved by Syka in this chat, with verified project paths. Use after native image generation to obtain the durable asset location instead of its temporary Codex cache path.", inputSchema: { type: "object", properties: {}, additionalProperties: false } }];
const inside = (root: string, path: string) => { const rel = relative(root, path); return !!rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep); };

/** Only project-owned directories: existing junctions must stay inside the project. */
export async function projectOutputDir(cwd: string, names: string[]): Promise<string> {
  const root = await realpath(cwd);
  let dir = root;
  for (const name of names) {
    if (!name || name === "." || name === ".." || /[\\/]/.test(name)) throw new Error("Invalid output folder");
    const next = join(dir, name);
    await mkdir(next).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
    dir = await realpath(next);
    if (!inside(root, dir)) throw new Error("Image output folder escapes the open project");
  }
  return dir;
}

export function imageFormat(data: Buffer): { extension: string; mediaType: string } {
  if (data.length < 12 || data.length > MAX_IMAGE_BYTES) throw new Error("Image is empty or exceeds 20 MiB");
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: "png", mediaType: "image/png" };
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return { extension: "jpg", mediaType: "image/jpeg" };
  if (data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return { extension: "webp", mediaType: "image/webp" };
  throw new Error("Codex returned an unsupported image format");
}

export class GeneratedImages {
  private readonly cwd: string;
  private readonly saved: Array<{ path: string; absolutePath: string; bytes: number }> = [];
  constructor(cwd: string) { this.cwd = cwd; }

  list() { return this.saved.map((image) => ({ ...image })); }

  async save(result: unknown, savedPath?: string): Promise<{ path: string; absolutePath: string; bytes: number; images?: ToolImage[] }> {
    let data: Buffer;
    if (typeof result === "string" && result.length > 16 && result.length <= Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 128 && /^(?:data:image\/(?:png|jpeg|webp);base64,)?[A-Za-z0-9+/=\r\n]+$/.test(result)) {
      data = Buffer.from(result.replace(/^data:[^,]+,/, ""), "base64");
    } else if (savedPath) {
      const root = await realpath(this.cwd);
      const file = await realpath(resolve(root, savedPath));
      if (!inside(root, file)) throw new Error("Generated image was saved outside the open project; Syka did not import it");
      const info = await stat(file);
      if (!info.isFile() || info.size > MAX_IMAGE_BYTES) throw new Error("Generated image exceeds 20 MiB");
      data = await readFile(file);
    } else throw new Error("Codex did not provide image bytes or a local project image");
    const format = imageFormat(data);
    const directory = await projectOutputDir(this.cwd, ["03 Assets reutilizables", "Generados", "Codex"]);
    const absolutePath = join(directory, `codex-${randomUUID()}.${format.extension}`);
    await writeFile(absolutePath, data, { flag: "wx" });
    const record = { path: relative(await realpath(this.cwd), absolutePath).replaceAll("\\", "/"), absolutePath, bytes: data.length };
    this.saved.push(record);
    if (this.saved.length > 64) this.saved.shift();
    return {
      ...record,
      ...(data.length <= INLINE_IMAGE_BYTES ? { images: [{ mediaType: format.mediaType, data: data.toString("base64") }] } : {}),
    };
  }
}
