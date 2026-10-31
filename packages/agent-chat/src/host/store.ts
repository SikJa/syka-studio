/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// One folder per chat under the data dir: `meta.json` (the summary plus
// the cwd and the resume cursor, written whole through a temp file) and
// `events.jsonl` (append-only; no deltas). There is no index: listing
// reads every meta, which is cheap at hundreds of chats and can never go
// out of sync.

import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { emptyTranscript, foldEvents } from "../reduce";
import { ProjectUsageStore } from './project-usage';

import type { ChatEvent, ChatSummary, MessageQueue, PendingRequest, ModelRef, ToolImage } from "../protocol";

// Tool screenshots used to live as base64 inside events.jsonl (87% of the
// history on a real profile). They are files now; events keep a short ref.
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
export const CHAT_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const IMAGE_REF = /^[a-f0-9]{32}\.(png|jpg|webp|gif)$/;
export const IMAGE_MEDIA_TYPES = Object.fromEntries(Object.entries(IMAGE_TYPES).map(([type, ext]) => [ext, type]));
import type { Transcript } from "../reduce";
import type { ResumeCursor } from "./harness";

export type ChatMeta = ChatSummary & {
  cwd: string; resume: ResumeCursor | null; queue?: MessageQueue;
  /** Non-secret unanswered questions survive the provider turn and app restarts. */
  pendingQuestion?: PendingRequest;
  lastModel?: ModelRef;
};

export class ChatStore {
  readonly usage: ProjectUsageStore;
  private readonly root: string;
  private readonly writes = new Map<string, Promise<unknown>>();

  constructor(dataDir: string) {
    this.usage = new ProjectUsageStore(dataDir);
    this.root = join(dataDir, "chats");
  }

  /** Drain accepted writes before shutting down or removing the test workspace. */
  async flush(): Promise<void> { await Promise.all([...this.writes.values(), this.usage.flush()]); }

  private dir(chatId: string): string {
    return join(this.root, chatId);
  }

  /** Every chat's meta, whatever its project; unreadable ones are skipped. */
  async list(): Promise<ChatMeta[]> {
    let entries: string[];
    try {
      entries = await readdir(this.root);
    } catch {
      return [];
    }
    const metas = await Promise.all(entries.map((id) => this.readMeta(id)));
    return metas.filter((meta): meta is ChatMeta => meta !== null);
  }

  async readMeta(chatId: string): Promise<ChatMeta | null> {
    try {
      const raw = await readFile(join(this.dir(chatId), "meta.json"), "utf8");
      const meta = JSON.parse(raw) as ChatMeta;
      return meta && typeof meta.id === "string" ? meta : null;
    } catch {
      return null;
    }
  }

  /** Atomic: the whole file lands under a temp name, then moves into place. */
  writeMeta(meta: ChatMeta): Promise<void> {
    return this.serialize(meta.id, async () => {
      const dir = this.dir(meta.id);
      await mkdir(dir, { recursive: true });
      const tmp = join(dir, `meta.json.${process.pid}.tmp`);
      await writeFile(tmp, JSON.stringify(meta), "utf8");
      await rename(tmp, join(dir, "meta.json"));
    });
  }

  append(chatId: string, event: ChatEvent): Promise<void> {
    return this.serialize(chatId, async () => {
      await mkdir(this.dir(chatId), { recursive: true });
      await appendFile(join(this.dir(chatId), "events.jsonl"), JSON.stringify(event) + "\n", "utf8");
    });
  }

  /** The transcript, folded from the log. A trailing line a crash cut short is skipped. */
  async readTranscript(chatId: string): Promise<Transcript> {
    let raw: string;
    try {
      raw = await readFile(join(this.dir(chatId), "events.jsonl"), "utf8");
    } catch {
      return emptyTranscript();
    }
    const events: ChatEvent[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line) as ChatEvent);
      } catch {
        continue;
      }
    }
    return foldEvents(events);
  }

  /** Bytes on disk for diagnostics; `inlineImages` marks a log not migrated yet. */
  async sizes(chatId: string): Promise<{ historyBytes: number; imageBytes: number; inlineImages: boolean }> {
    const dir = this.dir(chatId);
    const historyBytes = await stat(join(dir, "events.jsonl")).then(info => info.size, () => 0);
    let imageBytes = 0;
    try { for (const name of await readdir(join(dir, "images"))) imageBytes += await stat(join(dir, "images", name)).then(info => info.size, () => 0); } catch { /* No images. */ }
    // A log over ~1 MB without its backup has not been migrated: estimate, never read it whole here.
    const inlineImages = historyBytes > 1024 * 1024 && !existsSync(join(dir, "events.jsonl.inline-images.bak"));
    return { historyBytes, imageBytes, inlineImages };
  }

  /** Absolute path of a stored image, or null for anything that is not one. */
  imagePath(chatId: string, ref: string): string | null {
    return CHAT_ID.test(chatId) && IMAGE_REF.test(ref) ? join(this.dir(chatId), "images", ref) : null;
  }

  /**
   * Writes inline images as files (synchronously, so the file exists before
   * the event that names it is appended) and returns refs without the bytes.
   * Unknown types stay inline: nothing is dropped.
   */
  externalizeImages(chatId: string, images: ToolImage[]): ToolImage[] {
    if (!CHAT_ID.test(chatId)) return images;
    return images.map(image => {
      const ext = IMAGE_TYPES[image.mediaType];
      if (!ext || !image.data || image.ref) return image;
      const bytes = Buffer.from(image.data, "base64");
      const ref = `${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}.${ext}`;
      const dir = join(this.dir(chatId), "images"), path = join(dir, ref);
      try {
        if (!existsSync(path)) {
          mkdirSync(dir, { recursive: true });
          const temporary = `${path}.${process.pid}.tmp`;
          writeFileSync(temporary, bytes);
          renameSync(temporary, path);
        }
      } catch { return image; }
      return { mediaType: image.mediaType, data: "", ref };
    });
  }

  /**
   * One-time rewrite of a chat whose log still holds inline images. The
   * original log is kept beside it as events.jsonl.inline-images.bak.
   */
  migrateImages(chatId: string): Promise<boolean> {
    return this.serializeResult(chatId, async () => {
      const file = join(this.dir(chatId), "events.jsonl");
      let raw: string;
      try { raw = await readFile(file, "utf8"); } catch { return false; }
      if (!raw.includes('"images":[{')) return false;
      let changed = false;
      const lines = raw.split("\n").map(line => {
        if (!line.includes('"images":[{')) return line;
        try {
          const event = JSON.parse(line) as ChatEvent;
          if ((event.type === "item.completed" || event.type === "item.started") && event.item.kind === "tool" && event.item.images?.some(image => image.data)) {
            const item = event.item, original = item.images!;
            const images = this.externalizeImages(chatId, original);
            if (images.some((image, index) => image !== original[index])) {
              changed = true;
              return JSON.stringify({ ...event, item: { ...item, images } });
            }
          }
        } catch { /* A line a crash cut short stays as it was. */ }
        return line;
      });
      if (!changed) return false;
      const temporary = `${file}.${process.pid}.tmp`, backup = `${file}.inline-images.bak`;
      await writeFile(temporary, lines.join("\n"), "utf8");
      if (!existsSync(backup)) await rename(file, backup);
      await rename(temporary, file);
      return true;
    });
  }

  remove(chatId: string): Promise<void> {
    return this.serialize(chatId, () => rm(this.dir(chatId), { recursive: true, force: true }));
  }

  /** Writes to one chat happen in order, so an append never overtakes the meta it belongs with. */
  private serialize(chatId: string, task: () => Promise<void>): Promise<void> {
    return this.serializeResult(chatId, task);
  }

  private serializeResult<T>(chatId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.writes.get(chatId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    this.writes.set(chatId, next);
    next.finally(() => {
      if (this.writes.get(chatId) === next) this.writes.delete(chatId);
    }).catch(() => {});
    return next;
  }
}
