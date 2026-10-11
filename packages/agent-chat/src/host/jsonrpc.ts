/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// JSON-RPC 2.0 over a child's stdio, one message per line: what `codex
// app-server` speaks. Both directions carry requests, so the peer answers
// the child's (approvals, questions) as well as asking its own.

import type { ChildProcess } from "node:child_process";

export type JsonRpcError = { code: number; message: string; data?: unknown };

export class RpcError extends Error {
  readonly code: number;
  readonly data: unknown;

  constructor(error: JsonRpcError) {
    super(error.message);
    this.name = "RpcError";
    this.code = error.code;
    this.data = error.data;
  }
}

type Pending = { resolve(value: unknown): void; reject(error: Error): void };

export type ServerRequestHandler = (method: string, params: unknown) => Promise<unknown>;
export type NotificationHandler = (method: string, params: unknown) => void;

export class JsonRpcPeer {
  private readonly child: ChildProcess;
  private readonly pending = new Map<number, Pending>();
  private buffer = "";
  private nextId = 1;
  private closed = false;
  private diagnostic = "";

  onNotification: NotificationHandler = () => {};
  onRequest: ServerRequestHandler = async (method) => {
    throw new RpcError({ code: -32601, message: `Unhandled request ${method}` });
  };
  onClose: (code: number | null) => void = () => {};

  constructor(child: ChildProcess) {
    this.child = child;
    child.stdout!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => this.feed(chunk));
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      this.diagnostic = (this.diagnostic + chunk)
        .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
        .replace(/\b(?:sk-|gsk_|sess-)[a-zA-Z0-9_-]+/g, "[redacted]")
        .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[redacted]")
        .slice(-1600);
    });
    child.on("exit", (code) => this.end(code));
    child.on("error", (error: Error) => { this.diagnostic = error.message.slice(0, 1600); this.end(null); });
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.closed) return Promise.reject(new Error("JSON-RPC peer is closed"));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.write({ jsonrpc: "2.0", id, method, params: params ?? {} });
    });
  }

  notify(method: string, params?: unknown): void {
    if (this.closed) return;
    this.write({ jsonrpc: "2.0", method, params: params ?? {} });
  }

  private write(message: unknown): void {
    try {
      this.child.stdin!.write(JSON.stringify(message) + "\n");
    } catch {
      // stdin gone: `exit` follows and fails the pending requests.
    }
  }

  private feed(chunk: string): void {
    this.buffer += chunk;
    let index: number;
    while ((index = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (line) this.handle(line);
    }
  }

  private handle(line: string): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }
    if (typeof message !== "object" || message === null) return;
    const { id, method } = message;
    if (typeof method === "string") {
      if (id === undefined || id === null) {
        this.onNotification(method, message.params);
        return;
      }
      this.onRequest(method, message.params).then(
        (result) => this.write({ jsonrpc: "2.0", id, result: result ?? {} }),
        (error: unknown) =>
          this.write({
            jsonrpc: "2.0",
            id,
            error: error instanceof RpcError ? { code: error.code, message: error.message } : { code: -32603, message: String((error as Error)?.message ?? error) },
          }),
      );
      return;
    }
    if (typeof id === "number") {
      const entry = this.pending.get(id);
      if (!entry) return;
      this.pending.delete(id);
      if (message.error) entry.reject(new RpcError(message.error as JsonRpcError));
      else entry.resolve(message.result);
    }
  }

  private end(code: number | null): void {
    if (this.closed) return;
    this.closed = true;
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const entry of pending) entry.reject(new Error(`Process exited${code === null ? "" : ` (${code})`}${this.diagnostic.trim() ? `: ${this.diagnostic.trim()}` : ""}`));
    this.onClose(code);
  }
}
