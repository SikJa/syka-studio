/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Where the app serves MCP over Streamable HTTP: a fixed loopback port, so
// the URL is the same on every machine and can be written into an agent's
// config once. Syka uses its own port to coexist with upstream Diffusion.
// Loopback only; no token
// — the server checks the Host header, which is what keeps browser pages
// out, and anything else running as the user can already reach the app.
export const MCP_HOST = "127.0.0.1";
export const MCP_PORT = 3275;
export const MCP_PATH = "/mcp";
export const MCP_URL = `http://${MCP_HOST}:${MCP_PORT}${MCP_PATH}`;
