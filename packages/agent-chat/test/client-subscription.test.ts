/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentChatClient } from "../src/client";
import { emptyTranscript, reduce } from "../src/reduce";
import type { ChatListener } from "../src/client";
import type { ChatSnapshot, ClientMsg, HostMsg, Method } from "../src/protocol";

// Every frame and connection transition is controlled by the test. No server,
// provider, polling or wall-clock delay participates in the subscription race.
class ControlledSocket {
  static instances: ControlledSocket[] = [];
  readonly OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly sent: ClientMsg[] = [];
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    ControlledSocket.instances.push(this);
  }

  open(): void {
    this.readyState = this.OPEN;
    this.onopen?.();
  }

  send(raw: string): void {
    this.sent.push(JSON.parse(raw) as ClientMsg);
  }

  close(): void {
    this.readyState = 3;
    // Native sockets report onclose asynchronously, after close() returns.
  }

  disconnect(): void {
    this.close();
    this.onclose?.();
  }

  receive(message: HostMsg): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  request(method: Method): ClientMsg {
    const request = this.sent.findLast((message) => message.method === method);
    if (!request) throw new Error(`No ${method} request was sent`);
    return request;
  }

  reply(request: ClientMsg, data: unknown): void {
    this.receive({ t: "res", id: request.id, ok: true, data });
  }

  delta(seq: number, text: string): void {
    this.receive({ t: "event", chatId: "chat", seq, event: { type: "item.delta", itemId: "assistant", text } });
  }
}

const clients: AgentChatClient[] = [];

beforeEach(() => {
  ControlledSocket.instances = [];
  vi.useFakeTimers();
});

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
  vi.useRealTimers();
});

async function connect() {
  const client = new AgentChatClient({
    resolveEndpoint: async () => "ws://controlled.invalid",
    WebSocket: ControlledSocket as unknown as typeof WebSocket,
    minBackoffMs: 5,
  });
  clients.push(client);
  client.connect();
  await Promise.resolve();
  const socket = ControlledSocket.instances.at(-1)!;
  socket.open();
  return { client, socket };
}

function snapshot(seq = 1, text = "Hello"): ChatSnapshot {
  return {
    chat: { id: "chat", projectId: "project", title: "Chat", harness: "codex", model: "fake", status: "running", createdAt: 1, updatedAt: 1 },
    items: [{ id: "assistant", kind: "assistant", text }],
    seq,
    pending: null,
  };
}

describe("chat subscription ordering", () => {
  it("applies the snapshot before every newer delta received while opening", async () => {
    const { client, socket } = await connect();
    let transcript = emptyTranscript();
    const messages: Parameters<ChatListener>[0][] = [];
    client.open("chat", (message) => {
      messages.push(message);
      transcript = message.type === "snapshot"
        ? { ...emptyTranscript(), items: message.snapshot.items, chat: message.snapshot.chat, pending: message.snapshot.pending }
        : reduce(transcript, message.event);
    });

    socket.delta(1, "already in snapshot");
    socket.delta(2, " world");
    socket.delta(2, "duplicate");
    socket.reply(socket.request("chats.open"), snapshot());
    // A response resolves the promise, but its continuation has not run yet.
    socket.delta(3, "!");
    await Promise.resolve();

    expect(transcript.items).toEqual([{ id: "assistant", kind: "assistant", text: "Hello world!" }]);
    expect(messages.map((message) => message.type === "snapshot" ? "snapshot" : message.seq)).toEqual(["snapshot", 2, 3]);
    socket.delta(3, "duplicate live event");
    socket.delta(4, " Still here.");
    expect(transcript.items[0]).toMatchObject({ text: "Hello world! Still here." });
  });

  it("drops an unsubscribed opening and its queued events", async () => {
    const { client, socket } = await connect();
    const listener = vi.fn<ChatListener>();
    const unsubscribe = client.open("chat", listener);
    const opening = socket.request("chats.open");
    socket.delta(2, "must be discarded");

    unsubscribe();
    socket.reply(opening, snapshot());
    socket.reply(socket.request("chats.close"), undefined);
    socket.delta(3, "still unsubscribed");
    await Promise.resolve();

    expect(listener).not.toHaveBeenCalled();
    expect(client.subscribed("chat")).toBe(false);
  });

  it("does not let an older opening's not-found error delete its replacement", async () => {
    const { client, socket } = await connect();
    const oldListener = vi.fn<ChatListener>();
    const stopOld = client.open("chat", oldListener);
    const oldOpening = socket.request("chats.open");
    socket.delta(2, "old subscription");
    const listener = vi.fn<ChatListener>();
    client.open("chat", listener);
    const opening = socket.request("chats.open");

    socket.receive({ t: "res", id: oldOpening.id, ok: false, error: { code: "not-found", message: "Old opening failed" } });
    socket.delta(3, "new subscription");
    socket.reply(opening, snapshot(2, "Fresh"));
    await Promise.resolve();
    stopOld();

    expect(client.subscribed("chat")).toBe(true);
    expect(oldListener).not.toHaveBeenCalled();
    expect(listener.mock.calls.map(([message]) => message.type === "snapshot" ? "snapshot" : message.seq)).toEqual(["snapshot", 3]);
    expect(socket.sent.filter((request) => request.method === "chats.close")).toHaveLength(0);
  });

  it("stops draining when the snapshot listener unsubscribes", async () => {
    const { client, socket } = await connect();
    const messages: Parameters<ChatListener>[0][] = [];
    const unsubscribe = client.open("chat", (message) => {
      messages.push(message);
      if (message.type === "snapshot") unsubscribe();
    });
    socket.delta(2, "must not follow an unsubscribe");
    socket.delta(3, "neither may this");
    socket.reply(socket.request("chats.open"), snapshot());
    await Promise.resolve();

    expect(messages.map((message) => message.type)).toEqual(["snapshot"]);
    expect(client.subscribed("chat")).toBe(false);
  });

  it("includes events received reentrantly by the snapshot callback in order", async () => {
    const { client, socket } = await connect();
    const messages: Parameters<ChatListener>[0][] = [];
    client.open("chat", (message) => {
      messages.push(message);
      if (message.type === "snapshot") socket.delta(3, "arrived during snapshot");
    });
    socket.delta(2, "already queued");
    socket.reply(socket.request("chats.open"), snapshot());
    await Promise.resolve();

    expect(messages.map((message) => message.type === "snapshot" ? "snapshot" : message.seq)).toEqual(["snapshot", 2, 3]);
  });

  it("reconnects with a fresh snapshot and ignores the old socket and continuation", async () => {
    const { client, socket } = await connect();
    const listener = vi.fn<ChatListener>();
    client.open("chat", listener);
    socket.delta(2, "old socket");
    socket.reply(socket.request("chats.open"), snapshot(1, "Old"));
    // Drop the socket before the resolved request's continuation can run.
    socket.disconnect();
    await vi.advanceTimersByTimeAsync(5);
    const next = ControlledSocket.instances.at(-1)!;
    expect(next).not.toBe(socket);
    next.open();
    next.delta(11, "new socket");
    next.reply(next.request("chats.open"), snapshot(10, "New"));
    socket.delta(100, "stale socket must not advance seq");
    await Promise.resolve();
    next.delta(12, "still subscribed");

    expect(client.state).toBe("open");
    expect(listener.mock.calls.map(([message]) => message.type === "snapshot" ? message.snapshot.items[0] : message.seq)).toEqual([
      { id: "assistant", kind: "assistant", text: "New" }, 11, 12,
    ]);
  });

  it.each(["error", "timeout"] as const)("discards an opening after %s and retries cleanly on reconnect", async (failure) => {
    const { client, socket } = await connect();
    const listener = vi.fn<ChatListener>();
    client.open("chat", listener);
    const opening = socket.request("chats.open");
    socket.delta(2, "failed opening");
    if (failure === "error") {
      socket.receive({ t: "res", id: opening.id, ok: false, error: { code: "internal", message: "Opening failed" } });
      await Promise.resolve();
    } else {
      await vi.advanceTimersByTimeAsync(60_000);
    }
    socket.delta(3, "after failed opening");
    socket.reply(opening, snapshot(1, "Late response"));
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();
    expect(client.subscribed("chat")).toBe(true);

    socket.disconnect();
    await vi.advanceTimersByTimeAsync(5);
    const next = ControlledSocket.instances.at(-1)!;
    next.open();
    next.delta(4, "fresh event");
    next.reply(next.request("chats.open"), snapshot(3, "Fresh"));
    await Promise.resolve();

    expect(listener.mock.calls.map(([message]) => message.type === "snapshot" ? message.snapshot.seq : message.seq)).toEqual([3, 4]);
  });

  it("removes a current not-found subscription", async () => {
    const { client, socket } = await connect();
    const listener = vi.fn<ChatListener>();
    client.open("chat", listener);
    socket.delta(2, "deleted chat");
    socket.receive({ t: "res", id: socket.request("chats.open").id, ok: false, error: { code: "not-found", message: "Chat deleted" } });
    await Promise.resolve();

    expect(client.subscribed("chat")).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it("rejects pending requests immediately on close and keeps subscriptions for connect", async () => {
    const { client, socket } = await connect();
    const listener = vi.fn<ChatListener>();
    client.open("chat", listener);
    const request = client.request("harnesses.list", {});
    const rejected = expect(request).rejects.toMatchObject({ code: "disconnected" });
    socket.delta(2, "before close");
    client.close();
    await rejected;

    expect(client.state).toBe("closed");
    expect(vi.getTimerCount()).toBe(0);
    expect(client.subscribed("chat")).toBe(true);
    client.connect();
    await Promise.resolve();
    const next = ControlledSocket.instances.at(-1)!;
    next.open();
    next.reply(next.request("chats.open"), snapshot(5, "Restarted"));
    socket.reply(socket.request("chats.open"), snapshot(1, "Old"));
    await Promise.resolve();

    expect(listener).toHaveBeenCalledExactlyOnceWith({ type: "snapshot", snapshot: snapshot(5, "Restarted") });
  });
});
