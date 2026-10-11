/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { SOURCE_TOOLS, SourceTools } from "./source-tools";
import { WORKSPACE_TOOLS, WorkspaceTools } from "./workspace-tools";
import { motionReviewPreviews, type motionReview } from './motion-review';
import type {ToolImage} from '../protocol';
import type { OpenOptions } from "./harness";
import {USER_QUESTION_TOOL,parseUserQuestions,userQuestionResult} from './user-questions';

/** Per-session MCP bridge for the same reversible source/workspace tools Codex uses.
 * Random loopback port and unguessable URL; never starts or contacts DAPI 3275.
 */
export async function startEditorToolBridge(options: OpenOptions, permission?: (args: unknown) => Promise<unknown>) {
  if (options.mcp) {
    const url = new URL(options.mcp.url);
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password) throw Error("El MCP del editor debe ser local.");
  }
  const source = new SourceTools(options.cwd, options.env.env.SYKA_REFERENCE_DOCS_DIR);
  const workspace = new WorkspaceTools(options.cwd, options.env.env.SYKA_REFERENCE_DOCS_DIR, undefined, options.env.env.SYKA_RESOURCE_CONFIG, options.env.env.SYKA_CODE_GRAPH_ROOT, options.env.env, options.notify);
  const definitions = [...(options.askUser?[USER_QUESTION_TOOL]:[]), ...SOURCE_TOOLS, ...WORKSPACE_TOOLS].map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  if (permission) definitions.push({ name: "permission", description: "Ask the user for a native Claude Code permission decision.", inputSchema: { type: "object", properties: { tool_name: { type: "string" }, input: { type: "object" } }, required: ["tool_name", "input"], additionalProperties: true } });
  const secretPath = `/mcp/${randomBytes(24).toString("hex")}`;
  const server = createServer(async (req, res) => {
    if (req.url !== secretPath || req.headers.origin) { res.writeHead(403).end(); return; }
    if (req.method !== "POST") { res.writeHead(405).end(); return; }
    let body = "";
    req.setEncoding("utf8");
    try {
      for await (const chunk of req) { body += chunk.toString(); if (Buffer.byteLength(body) > 2_000_000) { res.writeHead(413).end(); return; } }
      const message = JSON.parse(body);
      if (message.id === undefined) { res.writeHead(202).end(); return; }
      let result: unknown;
      switch (message.method) {
        case "initialize": result = { protocolVersion: ["2024-11-05", "2025-03-26", "2025-06-18"].includes(message.params?.protocolVersion) ? message.params.protocolVersion : "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "syka-workspace", version: "1.0.0" } }; break;
        case "ping": result = {}; break;
        case "tools/list": result = { tools: definitions }; break;
        case "tools/call": {
          const name = message.params?.name;
          if (!definitions.some(t => t.name === name)) throw Error("Unknown tool");
          try {
            const value = name==='syka_ask_user' && options.askUser ? userQuestionResult(await options.askUser(parseUserQuestions(message.params.arguments)))
              : name === "permission" && permission ? await permission(message.params.arguments)
              : SOURCE_TOOLS.some(t => t.name === name) ? await source.call(name, message.params.arguments)
              : await workspace.call(name, message.params.arguments);
            const evidence=name==='syka_reference_video'?value as {output:unknown;images?:ToolImage[]}:null;
            const previews = evidence?.images??(name === 'syka_motion_review' ? await motionReviewPreviews(value as Awaited<ReturnType<typeof motionReview>>) : []);
            result = { content: [{ type: "text", text: JSON.stringify(evidence?.output??value) }, ...previews.map(i => ({ type: 'image', mimeType: i.mediaType, data: i.data }))] };
          } catch (error) { result = { isError: true, content: [{ type: "text", text: (error as Error).message }] }; }
          break;
        }
        default: res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } })); return;
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
    } catch { res.writeHead(400).end(); }
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("MCP bridge did not bind");
  return { url: `http://127.0.0.1:${address.port}${secretPath}`, close: async () => {await workspace.close();await new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); });} };
}
