/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The WebSocket door. Every chat is a full-access agent running as the
// user, and browsers apply no CORS to WebSockets, so a page on another
// origin must not get in: loopback bind, a random port, a token compared
// in constant time, and an Origin allow-list.

import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import type { WebSocket } from "ws";
import type { HostMsg } from "../protocol";
import type { AgentHost } from "./host";

export type ServerOptions = {
  host: string;
  port: number;
  token: string;
  allowedOrigins: string[];
  agentHost: AgentHost;
  log?: (message: string) => void;
};

export type RunningServer = { port: number; url: string; close(): Promise<void> };

export const DEFAULT_ORIGINS = ["file://", "null", "http://localhost:5173"];

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** `file://` matches any file origin; anything else must match whole. */
export function originAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (origin === undefined) return allowed.includes("null");
  return allowed.some((entry) => (entry === "file://" ? origin === "file://" || origin.startsWith("file://") : entry === origin));
}

export function startServer(options: ServerOptions): Promise<RunningServer> {
  const http: Server = createServer((_req, res) => {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  });
  const wss = new WebSocketServer({ noServer: true });

  const reject = (socket: Duplex, status: number, reason: string) => {
    socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  };

  http.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", `http://${options.host}`);
    const token = url.searchParams.get("token") ?? "";
    if (!safeEqual(token, options.token)) return reject(socket, 401, "Unauthorized");
    if (!originAllowed(req.headers.origin, options.allowedOrigins)) return reject(socket, 403, "Forbidden");
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws: WebSocket) => {
    const link = options.agentHost.connect({
      send(message: HostMsg) {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
      },
    });
    ws.on("message", (data) => link.receive(data.toString()));
    ws.on("close", () => link.disconnect());
    ws.on("error", (error) => options.log?.(`socket error: ${error.message}`));
  });

  return new Promise((resolve, rejectStart) => {
    http.once("error", rejectStart);
    http.listen(options.port, options.host, () => {
      http.off("error", rejectStart);
      const address = http.address();
      const port = typeof address === "object" && address ? address.port : options.port;
      resolve({
        port,
        url: `ws://${options.host}:${port}/?token=${encodeURIComponent(options.token)}`,
        close: () =>
          new Promise<void>((done) => {
            for (const client of wss.clients) client.terminate();
            wss.close(() => http.close(() => done()));
          }),
      });
    });
  });
}
