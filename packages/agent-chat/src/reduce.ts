/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The one reducer both sides share: the host folds it over `events.jsonl`
// for snapshots, the UI folds it over the live stream. Pure, and cheap
// enough to run per delta — item lookups are by id from the end, where
// the open items are.

import type { ChatEvent, ChatSummary, Item, PendingRequest, MessageQueue } from "./protocol";

export type Transcript = {
  queue?: MessageQueue;
  contextUsage?: { usedTokens: number; maxTokens: number };
  items: Item[];
  /** The question the harness is waiting on, if any. */
  pending: PendingRequest | null;
  /** The running turn, if any. */
  turnId: string | null;
  /** The chat summary as of the last `chat.updated`; null until one arrives. */
  chat: ChatSummary | null;
};

export const EMPTY_TRANSCRIPT: Transcript = Object.freeze({
  items: [],
  pending: null,
  turnId: null,
  chat: null,
}) as Transcript;

export function emptyTranscript(): Transcript {
  return { items: [], pending: null, turnId: null, chat: null };
}

function findLast(items: Item[], id: string): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]!.id === id) return i;
  }
  return -1;
}

/** Puts `item` at the index its id already holds, or appends it. */
function upsert(items: Item[], item: Item): Item[] {
  const index = findLast(items, item.id);
  if (index < 0) return [...items, item];
  const next = items.slice();
  next[index] = item;
  return next;
}

export function reduce(state: Transcript, event: ChatEvent): Transcript {
  switch (event.type) {
    case "usage.reported":
      return state; // Accounting lives outside the transcript and survives deleting a chat.
    case "queue.updated":
      return { ...state, queue: event.queue };
    case "context.updated":
      return { ...state, contextUsage: event.usage };
    case "turn.started":
      return { ...state, contextUsage: undefined, items: upsert(state.items, event.user), turnId: event.turnId, pending: null };

    case "item.started":
      return { ...state, items: upsert(state.items, event.item) };

    case "item.delta": {
      const index = findLast(state.items, event.itemId);
      if (index < 0) return state;
      const item = state.items[index]!;
      if (item.kind !== "assistant" && item.kind !== "reasoning") return state;
      const next = state.items.slice();
      next[index] = { ...item, text: item.text + event.text };
      return { ...state, items: next };
    }

    case "item.completed":
      return { ...state, items: upsert(state.items, event.item) };

    case "turn.completed": {
      // Whatever was still running when the turn ended did not finish.
      let items = state.items;
      if (event.status !== "completed") {
        items = items.map((item) =>
          item.kind === "tool" && item.status === "running" ? { ...item, status: "failed" } : item,
        );
      }
      // An asynchronous question can outlive the model's final message. Only
      // an explicit resolution, interruption or failure closes that card.
      return { ...state, items, turnId: null, pending: event.status === "completed" ? state.pending : null };
    }

    case "request.opened":
      return { ...state, pending: event.request };

    case "request.resolved":
      return state.pending?.id === event.requestId ? { ...state, pending: null } : state;

    case "chat.updated":
      return { ...state, chat: event.chat };
  }
}

/** Folds many events, in order. */
export function reduceAll(state: Transcript, events: Iterable<ChatEvent>): Transcript {
  let next = state;
  for (const event of events) next = reduce(next, event);
  return next;
}

/** Whether an event belongs in the on-disk log (deltas and requests do not). */
export function isPersistedEvent(event: ChatEvent): boolean {
  return event.type === "context.updated" || event.type === "turn.started" || event.type === "item.completed" || event.type === "turn.completed";
}
