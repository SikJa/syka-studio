/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { JSON_SCHEMA_DIALECT, tools } from "@diffusionstudio/dapi";
import { serveCatalog } from "./tools-session";

let client: Client;
const calls: Array<{ name: string; args: unknown }> = [];

beforeAll(async () => {
  const session = new McpServer({ name: "test", version: "0.0.0" });
  serveCatalog(session, async (tool, args) => {
    calls.push({ name: tool.name, args });
    switch (tool.name) {
      case "voices":
        return { voices: [] };
      case "check":
        throw new Error("No project open — run open first");
      default:
        return {};
    }
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await session.connect(serverTransport);
  client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
});

afterAll(() => client.close());

describe("serveCatalog", () => {
  it('keeps rendered PNG files and metadata while preventing base64 text in progressive clients', async () => {
    const dir = await mkdtemp(join(tmpdir(),'syka-capture-delivery-'));
    const session = new McpServer({name:'progressive-test',version:'1'});
    const png = new Uint8Array([137,80,78,71]);
    serveCatalog(session, async () => [{timecode:'0f',png}], {inlineImages:false});
    const [a,b] = InMemoryTransport.createLinkedPair();
    await session.connect(b);
    const progressive = new Client({name:'progressive-test',version:'1'});
    try {
      await progressive.connect(a);
      const result = await progressive.callTool({name:'capture',arguments:{id:'index.tsx:main',output:dir}});
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual([{type:'text',text:expect.any(String)}]);
      const images = (result.structuredContent as {images:{path:string}[]}).images;
      expect(await readFile(images[0]!.path)).toEqual(Buffer.from(png));
      expect(JSON.stringify(result)).not.toContain(Buffer.from(png).toString('base64'));
    } finally {await progressive.close();await session.close();await rm(dir,{recursive:true,force:true});}
  });
  it('rejects cached export calls before they reach the renderer, while hiding the tool from agents',async()=>{
    expect((await client.listTools()).tools.map(t=>t.name)).not.toContain('export');
    const before=calls.length;
    const result=await client.callTool({name:'export',arguments:{id:'scene',path:'test.mp4'}});
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain('La exportación es manual');
    expect(calls).toHaveLength(before);
  });
  it("lists every tool with its schemas in JSON Schema 2020-12, the dialect clients validate", async () => {
    const listed = (await client.listTools()).tools;
    expect(listed.map((tool) => tool.name)).toEqual(tools.filter(tool=>tool.name !== 'export').map((tool) => tool.name));
    for (const tool of listed) {
      expect(tool.inputSchema.$schema, `${tool.name} input`).toBe(JSON_SCHEMA_DIALECT);
      expect(tool.outputSchema?.$schema, `${tool.name} output`).toBe(JSON_SCHEMA_DIALECT);
      expect(tool.description, tool.name).toBeTruthy();
    }
    const fonts = listed.find((tool) => tool.name === "fonts")!;
    expect(fonts.inputSchema.properties).toHaveProperty("family");
    expect(fonts.outputSchema?.properties).toHaveProperty("families");
  });

  it("keeps the verification loop loaded in Claude Code instead of behind its tool search", async () => {
    const listed = (await client.listTools()).tools;
    const loaded = listed.filter((tool) => tool._meta?.["anthropic/alwaysLoad"] === true).map((tool) => tool.name).sort();
    expect(loaded).toEqual(["capture", "check", "context", "gate"]);
  });

  it("validates arguments before the tool runs, and runs it with the parsed ones", async () => {
    const before = calls.length;
    const bad = await client.callTool({ name: "fonts", arguments: { limit: 0 } });
    expect(bad.isError).toBe(true);
    expect(JSON.stringify(bad.content)).toContain("limit");
    expect(calls.length).toBe(before);

    const result = await client.callTool({ name: "voices", arguments: {} });
    expect(result.structuredContent).toEqual({ voices: [] });
    expect(calls.at(-1)).toEqual({ name: "voices", args: {} });
  });

  it("returns a handler's failure as a readable error result, not a protocol error", async () => {
    const result = await client.callTool({ name: "check", arguments: { id: "intro" } });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "No project open — run open first" }]);
  });
});
