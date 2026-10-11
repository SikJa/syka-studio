/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { z } from "zod";
import type { GenericTool } from "./tool";

/**
 * The JSON Schema dialect a tool's schemas are published in over MCP. The
 * spec recommends 2020-12, and the validators clients run (Claude Code's
 * among them) accept nothing older: a `$schema` naming draft-07 fails every
 * tool call before it reaches the app. The MCP SDK's own conversion defaults
 * to draft-07, so the server publishes these instead.
 */
export const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";

export type ToolJsonSchemas = {
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
};

/** A tool's input and output as JSON Schema 2020-12, the way `tools/list` reports them. */
export function toolJsonSchemas(tool: GenericTool): ToolJsonSchemas {
  return {
    inputSchema: z.toJSONSchema(tool.input, { target: "draft-2020-12", io: "input" }) as Record<string, unknown>,
    outputSchema: z.toJSONSchema(tool.output, { target: "draft-2020-12", io: "output" }) as Record<string, unknown>,
  };
}
