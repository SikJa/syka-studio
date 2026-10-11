/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { Item } from "@diffusionstudio/agent-chat";
import type { AssetLibrary, ImageAsset } from "@diffusionstudio/assets";

const GENERATED_DIRECTORY = "03 Assets reutilizables/Generados/Codex";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const pending = new WeakMap<AssetLibrary, Map<string, Promise<ImageAsset>>>();

export type GeneratedImageOutput = { path: string; absolutePath: string; bytes: number };

const normalized = (path: string): string => {
  const value = path.replaceAll("\\", "/").replace(/\/+$/, "");
  return /^[a-z]:\//i.test(value) ? value.toLowerCase() : value;
};

/** Only host-verified native generation results, never a model's prose or browser output. */
export function generatedImageOutput(item: Item): GeneratedImageOutput | null {
  if (item.kind !== "tool" || item.name !== "imageGeneration" || item.status !== "done" || !item.output || item.output.length > 8192) return null;
  try {
    const result = JSON.parse(item.output) as Record<string, unknown>;
    if (result.provider !== "Codex subscription" || typeof result.path !== "string" || typeof result.absolutePath !== "string"
      || !Number.isSafeInteger(result.bytes) || (result.bytes as number) < 12 || (result.bytes as number) > MAX_IMAGE_BYTES) return null;
    if (!new RegExp(`^${GENERATED_DIRECTORY}/codex-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(png|jpg|webp)$`, "i").test(result.path)) return null;
    if (!/^(?:[a-z]:[\\/]|\/)/i.test(result.absolutePath) || /(?:^|[\\/])\.{1,2}(?:[\\/]|$)/.test(result.absolutePath)) return null;
    return { path: result.path, absolutePath: result.absolutePath, bytes: result.bytes as number };
  } catch {
    return null;
  }
}

/** Link the immutable project image, preserving the live library and its manual edits. */
export async function registerGeneratedImage(library: AssetLibrary, projectDir: string, item: Item): Promise<ImageAsset | null> {
  const output = generatedImageOutput(item);
  if (!output) return null;
  const expected = `${projectDir.replace(/[\\/]+$/, "")}/${output.path}`;
  if (normalized(output.absolutePath) !== normalized(expected)) throw new Error("La imagen pertenece a otro proyecto; no se importó.");
  let imports = pending.get(library);
  if (!imports) { imports = new Map(); pending.set(library, imports); }
  const key = normalized(output.absolutePath);
  const active = imports.get(key);
  if (active) return active;
  const registration = (async (): Promise<ImageAsset> => {
    // Initial loading and watcher reloads must finish before a new manifest entry is added.
    await library.whenReady();
    const fs = library.fs;
    if (!fs.realPath) throw new Error("No se pudo verificar la ubicación de la imagen local.");
    const [root, source] = await Promise.all([fs.realPath(projectDir), fs.realPath(output.absolutePath)]);
    if (!root || !source || normalized(source) !== normalized(`${root}/${output.path}`)) throw new Error("La imagen sale de la carpeta autorizada del proyecto.");
    const stat = await fs.stat(source);
    if (!stat || stat.size !== output.bytes) throw new Error("La imagen cambió o ya no está disponible.");
    const file = await fs.file(source);
    if (file.size !== output.bytes) throw new Error("La imagen cambió durante la importación.");
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => head[i] === byte);
    const jpeg = head[0] === 255 && head[1] === 216 && head[2] === 255;
    const webp = new TextDecoder().decode(head.slice(0, 4)) === "RIFF" && new TextDecoder().decode(head.slice(8, 12)) === "WEBP";
    if (!png && !jpeg && !webp) throw new Error("El resultado no contiene una imagen compatible.");
    const existing = library.assets().find(asset => normalized(fs.absolute?.(asset.source) ?? asset.source) === normalized(source));
    const report = existing ? { assets: [existing], failed: [] } : await library.import([source], { folder: "Generados/Codex" });
    if (report.failed.length) throw report.failed[0]!.error;
    const asset = report.assets[0];
    if (!asset || asset.type !== "IMAGE") throw new Error("El resultado no pudo registrarse como imagen.");
    await library.flush();
    return asset;
  })();
  imports.set(key, registration);
  try { return await registration; }
  finally { if (imports.get(key) === registration) imports.delete(key); }
}
