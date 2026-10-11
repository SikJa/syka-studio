/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { describe, expect, it } from "vitest";

import { emptyTranscript, isPersistedEvent, reduce, reduceAll } from "../src/reduce";
import { titleFor } from "../src/protocol";

import type { ChatEvent, Item } from "../src/protocol";

const user: Item = { id: "u1", kind: "user", text: "hi" };

describe("reduce", () => {
  it("appends the user item on turn.started and clears it on turn.completed", () => {
    let state = reduce(emptyTranscript(), { type: "turn.started", turnId: "t1", model: "m", user });
    expect(state.items).toEqual([user]);
    expect(state.turnId).toBe("t1");
    state = reduce(state, { type: "turn.completed", turnId: "t1", status: "completed" });
    expect(state.turnId).toBeNull();
  });

  it("streams deltas into an open assistant item and replaces it when completed", () => {
    const events: ChatEvent[] = [
      { type: "item.started", item: { id: "a1", kind: "assistant", text: "" } },
      { type: "item.delta", itemId: "a1", text: "Hel" },
      { type: "item.delta", itemId: "a1", text: "lo" },
    ];
    let state = reduceAll(emptyTranscript(), events);
    expect(state.items).toEqual([{ id: "a1", kind: "assistant", text: "Hello" }]);
    state = reduce(state, { type: "item.completed", item: { id: "a1", kind: "assistant", text: "Hello!" } });
    expect(state.items).toEqual([{ id: "a1", kind: "assistant", text: "Hello!" }]);
  });

  it("ignores deltas for unknown or non-text items", () => {
    const tool: Item = { id: "t1", kind: "tool", name: "Read", title: "Read", status: "running" };
    const state = reduce(reduce(emptyTranscript(), { type: "item.started", item: tool }), { type: "item.delta", itemId: "t1", text: "x" });
    expect(state.items).toEqual([tool]);
    expect(reduce(state, { type: "item.delta", itemId: "nope", text: "x" })).toBe(state);
  });

  it("re-emitting item.started with the same id replaces in place", () => {
    const first: Item = { id: "t1", kind: "tool", name: "Bash", title: "Bash", status: "running" };
    const second: Item = { ...first, detail: "ls" };
    const state = reduceAll(emptyTranscript(), [
      { type: "item.started", item: first },
      { type: "item.started", item: { id: "a1", kind: "assistant", text: "" } },
      { type: "item.started", item: second },
    ]);
    expect(state.items.map((item) => item.id)).toEqual(["t1", "a1"]);
    expect(state.items[0]).toEqual(second);
  });

  it("fails running tools when a turn is interrupted", () => {
    const state = reduceAll(emptyTranscript(), [
      { type: "item.started", item: { id: "t1", kind: "tool", name: "Bash", title: "Bash", status: "running" } },
      { type: "item.completed", item: { id: "t2", kind: "tool", name: "Read", title: "Read", status: "done" } },
      { type: "turn.completed", turnId: "t", status: "interrupted" },
    ]);
    expect(state.items.map((item) => item.kind === "tool" && item.status)).toEqual(["failed", "done"]);
  });

  it("tracks the pending request until it is resolved or the turn ends", () => {
    const request = { id: "q1", type: "question" as const, questions: [] };
    let state = reduce(emptyTranscript(), { type: "request.opened", request });
    expect(state.pending).toEqual(request);
    expect(reduce(state, {type: 'turn.completed', turnId: 't', status: 'completed'}).pending).toEqual(request);
    expect(reduce(state, { type: "request.resolved", requestId: "other", outcome: "answered" }).pending).toEqual(request);
    state = reduce(state, { type: "request.resolved", requestId: "q1", outcome: "answered" });
    expect(state.pending).toBeNull();
    state = reduce(reduce(state, { type: "request.opened", request }), { type: "turn.completed", turnId: "t", status: "interrupted" });
    expect(state.pending).toBeNull();
  });

  it("persists only turn boundaries and completed items", () => {
    expect(isPersistedEvent({ type: "turn.started", turnId: "t", model: "m", user })).toBe(true);
    expect(isPersistedEvent({ type: "item.completed", item: user })).toBe(true);
    expect(isPersistedEvent({ type: "turn.completed", turnId: "t", status: "completed" })).toBe(true);
    expect(isPersistedEvent({ type: "item.delta", itemId: "a", text: "x" })).toBe(false);
    expect(isPersistedEvent({ type: "item.started", item: user })).toBe(false);
    expect(isPersistedEvent({ type: "request.opened", request: { id: "q", type: "question", questions: [] } })).toBe(false);
  });
});

describe("titleFor", () => {
  it("collapses whitespace and truncates to 60 characters", () => {
    expect(titleFor("  make   a\n\nvideo ")).toBe("make a video");
    const long = "x".repeat(100);
    expect(titleFor(long)).toHaveLength(60);
    expect(titleFor(long).endsWith("…")).toBe(true);
    expect(titleFor("   ")).toBe("New chat");
  });
});
