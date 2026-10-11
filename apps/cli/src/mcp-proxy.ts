/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// `diffusion mcp`: the entry point for agents that only run stdio servers (Claude
// Desktop). A message pipe between stdio and the app's HTTP endpoint: each
// side is an SDK transport, so session handling and SSE framing are theirs,
// and nothing here looks inside a message. Stdout belongs to the protocol;
// anything for a human goes to stderr.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { mcpEndpoint } from './mcp-endpoint';
import { APP_NAME, isAppDown, launchApp, ping, waitForApp } from "./cli-client";

import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export async function runProxy(): Promise<void> {
  try {
    await ping();
  } catch (e) {
    if (!isAppDown(e)) throw e;
    // Launching is macOS's job; elsewhere the user starts the app by hand.
    if (!(await launchApp(true))) {
      throw new Error(`${APP_NAME} is not running. Launch the app first, then retry.`);
    }
    await waitForApp();
  }

  const upstream = new StreamableHTTPClientTransport(new URL(mcpEndpoint()));
  const stdio = new StdioServerTransport();

  const fail = (error: Error): void => {
    console.error(`[diffusion mcp] ${error.message}`);
    process.exit(1);
  };

  upstream.onmessage = (message: JSONRPCMessage) => void stdio.send(message).catch(fail);
  stdio.onmessage = (message: JSONRPCMessage) => void upstream.send(message).catch(fail);
  upstream.onerror = (error) => console.error(`[diffusion mcp] ${error.message}`);
  stdio.onerror = (error) => console.error(`[diffusion mcp] ${error.message}`);
  // The app went away (quit, or the session was closed): the agent sees EOF.
  upstream.onclose = () => process.exit(0);
  // The agent went away: tell the app, which ends the session.
  stdio.onclose = () => void upstream.close().finally(() => process.exit(0));

  await upstream.start();
  await stdio.start();
}
