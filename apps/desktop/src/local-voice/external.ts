/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Models another app already downloaded (Whispera, Syka Code) or a folder the
 * person picked: used where they are, never copied and never deleted by Syka.
 * A file counts only with the exact size and SHA-256 of the pinned asset; the
 * hash is checked once and remembered by size and modification time.
 */
import { createHash } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ModelAsset } from "./assets";

/** Where other apps keep their speech models, per platform. */
export function knownModelDirs(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env): string[] {
  const home = env.USERPROFILE || env.HOME || homedir();
  if (platform === "win32") {
    const roaming = env.APPDATA || join(home, "AppData", "Roaming");
    return [join(home, ".whispera", "desktop", "models"), join(roaming, "atelier", "voice"), join(roaming, "Syka", "voice")];
  }
  if (platform === "darwin") {
    const support = join(home, "Library", "Application Support");
    return [join(support, "app.whispera.desktop", "desktop", "models"), join(support, "Whispera", "desktop", "models"), join(support, "atelier", "voice")];
  }
  return [join(home, ".whispera", "desktop", "models"), join(env.XDG_CONFIG_HOME || join(home, ".config"), "atelier", "voice")];
}

type Verdict = { size: number; mtimeMs: number; ok: boolean };

export class ExternalModels {
  readonly #cacheFile: string;
  readonly #dirs: () => readonly string[];
  #cache: Record<string, Verdict> | null = null;

  constructor(options: { cacheFile: string; dirs: () => readonly string[] }) {
    this.#cacheFile = options.cacheFile;
    this.#dirs = options.dirs;
  }

  /** The first verified copy of the asset in the known or chosen folders, or null. */
  async find(asset: ModelAsset): Promise<string | null> {
    for (const dir of this.#dirs()) {
      const path = join(dir, asset.file);
      if (await this.verified(path, asset)) return path;
    }
    return null;
  }

  async verified(path: string, asset: ModelAsset): Promise<boolean> {
    let info: { size: number; mtimeMs: number };
    try { const stat = statSync(path); if (!stat.isFile()) return false; info = stat; } catch { return false; }
    if (info.size !== asset.sizeBytes) return false;
    const cache = await this.#load();
    // Keyed by the expected hash too: the same file is judged against each pinned asset.
    const key = `${path}|${asset.sha256}`;
    const known = cache[key];
    if (known && known.size === info.size && known.mtimeMs === info.mtimeMs) return known.ok;
    const ok = await sha256(path) === asset.sha256;
    cache[key] = { size: info.size, mtimeMs: info.mtimeMs, ok };
    await mkdir(dirname(this.#cacheFile), { recursive: true });
    await writeFile(this.#cacheFile, JSON.stringify(cache)).catch(() => undefined);
    return ok;
  }

  async #load(): Promise<Record<string, Verdict>> {
    if (this.#cache) return this.#cache;
    try { this.#cache = JSON.parse(await readFile(this.#cacheFile, "utf8")) as Record<string, Verdict>; }
    catch { this.#cache = {}; }
    return this.#cache;
  }
}

function sha256(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path).on("data", chunk => hash.update(chunk)).on("error", reject).on("end", () => resolve(hash.digest("hex")));
  });
}

/** The folders the person added with «Elegir carpeta», saved next to Syka's own models. */
export class ChosenDirs {
  readonly #file: string;
  #dirs: string[] = [];
  constructor(file: string) { this.#file = file; }
  get list(): readonly string[] { return this.#dirs; }
  async load(): Promise<void> {
    try { const saved = JSON.parse(await readFile(this.#file, "utf8")) as unknown; if (Array.isArray(saved)) this.#dirs = saved.filter((dir): dir is string => typeof dir === "string"); }
    catch { this.#dirs = []; }
  }
  async add(dir: string): Promise<void> {
    if (this.#dirs.includes(dir)) return;
    this.#dirs = [dir, ...this.#dirs].slice(0, 8);
    await mkdir(dirname(this.#file), { recursive: true });
    await writeFile(this.#file, JSON.stringify(this.#dirs));
  }
}
