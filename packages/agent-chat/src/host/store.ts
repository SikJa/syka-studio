/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// One folder per chat under the data dir: `meta.json` (the summary plus
// the cwd and the resume cursor, written whole through a temp file) and
// `events.jsonl` (append-only; no deltas). There is no index: listing
// reads every meta, which is cheap at hundreds of chats and can never go
// out of sync.

import { appendFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { emptyTranscript, reduce } from "../reduce";
import { ProjectUsageStore } from './project-usage';

import type { ChatEvent, ChatSummary, MessageQueue, PendingRequest, ModelRef } from "../protocol";
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
  private readonly writes = new Map<string, Promise<void>>();

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
    let state = emptyTranscript();
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      let event: ChatEvent;
      try {
        event = JSON.parse(line) as ChatEvent;
      } catch {
        continue;
      }
      state = reduce(state, event);
    }
    return state;
  }

  remove(chatId: string): Promise<void> {
    return this.serialize(chatId, () => rm(this.dir(chatId), { recursive: true, force: true }));
  }

  /** Writes to one chat happen in order, so an append never overtakes the meta it belongs with. */
  private serialize(chatId: string, task: () => Promise<void>): Promise<void> {
    const previous = this.writes.get(chatId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    this.writes.set(chatId, next);
    next.finally(() => {
      if (this.writes.get(chatId) === next) this.writes.delete(chatId);
    }).catch(() => {});
    return next;
  }
}
