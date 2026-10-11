/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ChatStore } from "../src/host/store";

import type { ChatMeta } from "../src/host/store";

let dir: string;
let store: ChatStore;

const meta = (id: string): ChatMeta => ({
  id,
  projectId: "p",
  title: "t",
  harness: "claude",
  model: "m",
  status: "idle",
  createdAt: 1,
  updatedAt: 2,
  cwd: "/p",
  resume: null,
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "agent-chat-store-"));
  store = new ChatStore(dir);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("ChatStore", () => {
  it("lists nothing when the folder does not exist yet", async () => {
    expect(await store.list()).toEqual([]);
    expect(await store.readTranscript("nope")).toEqual({ items: [], pending: null, turnId: null, chat: null });
  });

  it("round-trips meta atomically and lists it", async () => {
    await store.writeMeta(meta("a"));
    await store.writeMeta({ ...meta("a"), title: "renamed" });
    await store.writeMeta(meta("b"));
    const listed = await store.list();
    expect(listed.map((entry) => [entry.id, entry.title]).sort()).toEqual([
      ["a", "renamed"],
      ["b", "t"],
    ]);
    expect(readFileSync(join(dir, "chats", "a", "meta.json"), "utf8")).not.toContain(".tmp");
  });

  it("folds the event log into a transcript and skips a torn trailing line", async () => {
    await store.writeMeta(meta("a"));
    await store.append("a", { type: "turn.started", turnId: "t", model: "m", user: { id: "u", kind: "user", text: "hi" } });
    await store.append("a", { type: "item.completed", item: { id: "x", kind: "assistant", text: "hello" } });
    await store.append("a", { type: "turn.completed", turnId: "t", status: "completed" });
    appendFileSync(join(dir, "chats", "a", "events.jsonl"), '{"type":"item.comp');
    const transcript = await store.readTranscript("a");
    expect(transcript.items.map((item) => item.id)).toEqual(["u", "x"]);
    expect(transcript.turnId).toBeNull();
  });

  it("removes a chat's folder", async () => {
    await store.writeMeta(meta("a"));
    await store.remove("a");
    expect(await store.list()).toEqual([]);
    expect(await store.readMeta("a")).toBeNull();
  });
});
