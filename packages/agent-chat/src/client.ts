/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The browser side of the wire: one WebSocket, request/response by id,
// per-chat subscriptions, and reconnection with backoff. The endpoint is
// re-resolved on every attempt, which covers a host that came back on a
// new port. On reconnect every subscribed chat is re-opened, and its
// listener gets the fresh snapshot — there is no replay protocol.

import type {
  ChatEvent,
  ChatSnapshot,
  ClientMsg,
  HarnessInfo,
  HostError,
  HostMsg,
  Method,
  MethodParams,
  MethodResult,
  ProjectTokenUsage,
} from "./protocol";

export type ConnectionState = "connecting" | "open" | "closed" | "unavailable";

export type ChatListener = (message: { type: "snapshot"; snapshot: ChatSnapshot } | { type: "event"; seq: number; event: ChatEvent }) => void;

export class AgentChatError extends Error {
  readonly code: HostError["code"] | "disconnected";

  constructor(code: AgentChatError["code"], message: string) {
    super(message);
    this.name = "AgentChatError";
    this.code = code;
  }
}

type Pending = { resolve(value: unknown): void; reject(error: Error): void };

type BufferedEvent = { seq: number; event: ChatEvent };
type Opening = { socket: WebSocket; events: BufferedEvent[] };

type Subscription = {
  listener: ChatListener;
  /** Seq of the last snapshot or event delivered; older events are skipped. */
  seq: number;
  /** Set once the snapshot has been delivered for the current socket. */
  opened: boolean;
  /** Events can arrive before the chats.open response or its continuation. */
  opening: Opening | null;
};

export type AgentChatClientOptions = {
  /** Where the host is right now; null when there is none (web build without a host). */
  resolveEndpoint(): Promise<string | null>;
  /** For tests and Node: defaults to the global WebSocket. */
  WebSocket?: typeof WebSocket;
  minBackoffMs?: number;
  maxBackoffMs?: number;
};

const REQUEST_TIMEOUT_MS = 60_000;

export class AgentChatClient {
  private readonly options: AgentChatClientOptions;
  private socket: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private subscriptions = new Map<string, Subscription>();
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private harnessListeners = new Set<(harnesses: HarnessInfo[]) => void>();
  private usageListeners = new Set<(usage: ProjectTokenUsage) => void>();
  private backoff: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private nextId = 0;
  private _state: ConnectionState = "closed";
  private _harnesses: HarnessInfo[] = [];

  constructor(options: AgentChatClientOptions) {
    this.options = options;
    this.backoff = options.minBackoffMs ?? 500;
  }

  get state(): ConnectionState {
    return this._state;
  }

  get harnesses(): HarnessInfo[] {
    return this._harnesses;
  }

  onState(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => void this.stateListeners.delete(listener);
  }

  onHarnesses(listener: (harnesses: HarnessInfo[]) => void): () => void {
    this.harnessListeners.add(listener);
    return () => void this.harnessListeners.delete(listener);
  }

  onUsage(listener: (usage: ProjectTokenUsage) => void): () => void {
    this.usageListeners.add(listener);
    return () => void this.usageListeners.delete(listener);
  }

  /** Starts connecting; idempotent. */
  connect(): void {
    if (!this.stopped) return;
    this.stopped = false;
    void this.attempt();
  }

  /** Closes the socket and stops reconnecting. Subscriptions are kept for a later `connect()`. */
  close(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    this.resetSubscriptions();
    this.failPending(new AgentChatError("disconnected", "Agent host disconnected"));
    socket?.close();
    this.setState("closed");
  }

  /** Subscribes to a chat. The listener gets a snapshot first, then events; on reconnect, a snapshot again. */
  open(chatId: string, listener: ChatListener): () => void {
    const previous = this.subscriptions.get(chatId);
    if (previous) this.resetSubscription(previous);
    const subscription: Subscription = { listener, seq: -1, opened: false, opening: null };
    this.subscriptions.set(chatId, subscription);
    if (this._state === "open") void this.openOne(chatId, subscription);
    return () => {
      if (this.subscriptions.get(chatId) !== subscription) return;
      this.subscriptions.delete(chatId);
      this.resetSubscription(subscription);
      if (this._state === "open") void this.request("chats.close", { chatId }).catch(() => {});
    };
  }

  /** A subscription's listener applies the snapshot; this is what lets `turn.send` auto-subscribe a new chat. */
  subscribed(chatId: string): boolean {
    return this.subscriptions.has(chatId);
  }

  request<M extends Method>(method: M, params: MethodParams<M>): Promise<MethodResult<M>> {
    const socket = this.socket;
    if (!socket || socket.readyState !== socket.OPEN) {
      return Promise.reject(new AgentChatError("disconnected", "Agent host is not connected"));
    }
    const id = String(++this.nextId);
    const message: ClientMsg = { t: "req", id, method, params };
    return new Promise<MethodResult<M>>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) reject(new AgentChatError("internal", `${method} timed out`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as MethodResult<M>);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      socket.send(JSON.stringify(message));
    });
  }

  private setState(state: ConnectionState): void {
    if (this._state === state) return;
    this._state = state;
    for (const listener of this.stateListeners) listener(state);
  }

  private async attempt(): Promise<void> {
    if (this.stopped) return;
    this.setState("connecting");
    let url: string | null = null;
    try {
      url = await this.options.resolveEndpoint();
    } catch {
      url = null;
    }
    if (this.stopped) return;
    if (!url) {
      this.setState("unavailable");
      this.scheduleReconnect();
      return;
    }
    const WS = this.options.WebSocket ?? globalThis.WebSocket;
    let socket: WebSocket;
    try {
      socket = new WS(url);
    } catch {
      this.setState("closed");
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.backoff = this.options.minBackoffMs ?? 500;
      this.setState("open");
      for (const [chatId, subscription] of this.subscriptions) {
        void this.openOne(chatId, subscription);
      }
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      this.handle(String(event.data));
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.resetSubscriptions();
      this.failPending(new AgentChatError("disconnected", "Agent host disconnected"));
      this.setState("closed");
      this.scheduleReconnect();
    };
    socket.onerror = () => {
      // `onclose` follows and does the work.
    };
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, this.options.maxBackoffMs ?? 5000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.attempt();
    }, delay);
  }

  private failPending(error: Error): void {
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const entry of pending) entry.reject(error);
  }

  private resetSubscription(subscription: Subscription): void {
    subscription.opened = false;
    if (subscription.opening) subscription.opening.events.length = 0;
    subscription.opening = null;
  }

  private resetSubscriptions(): void {
    for (const subscription of this.subscriptions.values()) this.resetSubscription(subscription);
  }

  private async openOne(chatId: string, subscription: Subscription): Promise<void> {
    const socket = this.socket;
    if (!socket) return;
    this.resetSubscription(subscription);
    const opening: Opening = { socket, events: [] };
    subscription.opening = opening;
    const current = () => this.socket === socket
      && this.subscriptions.get(chatId) === subscription
      && subscription.opening === opening;
    try {
      const snapshot = await this.request("chats.open", { chatId });
      if (!current()) return;
      subscription.seq = snapshot.seq;
      subscription.listener({ type: "snapshot", snapshot });
      // Keep buffering until the snapshot callback and the queue finish. A
      // listener may unsubscribe, replace itself, or receive more events.
      for (const message of opening.events) {
        if (!current()) return;
        this.deliverEvent(subscription, message);
      }
      if (!current()) return;
      subscription.opening = null;
      subscription.opened = true;
    } catch (error) {
      if (!current()) return;
      this.resetSubscription(subscription);
      // A deleted chat, or a socket that went away: the next reconnect retries, a
      // `not-found` means the subscription is dead.
      if (error instanceof AgentChatError && error.code === "not-found") {
        this.subscriptions.delete(chatId);
      }
    }
  }

  private deliverEvent(subscription: Subscription, message: BufferedEvent): void {
    if (message.seq <= subscription.seq) return;
    subscription.seq = message.seq;
    subscription.listener({ type: "event", seq: message.seq, event: message.event });
  }

  private handle(raw: string): void {
    let message: HostMsg;
    try {
      message = JSON.parse(raw) as HostMsg;
    } catch {
      return;
    }
    switch (message.t) {
      case 'usage':
        for (const listener of this.usageListeners) listener(message.usage);
        return;
      case "res": {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        if (message.ok) entry.resolve(message.data);
        else entry.reject(new AgentChatError(message.error.code, message.error.message));
        return;
      }
      case "event": {
        const subscription = this.subscriptions.get(message.chatId);
        if (!subscription) return;
        if (!subscription.opened) {
          // Only an active request owns a buffer. Errors/timeouts clear it, so
          // events cannot accumulate indefinitely after a failed opening.
          if (subscription.opening?.socket === this.socket) subscription.opening.events.push(message);
          return;
        }
        this.deliverEvent(subscription, message);
        return;
      }
      case "harnesses": {
        this._harnesses = message.harnesses;
        for (const listener of this.harnessListeners) listener(message.harnesses);
        return;
      }
    }
  }
}
