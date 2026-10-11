/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// How the app's MCP server is written into each agent's config, as pure
// text transforms: no file system, no Electron, so the merge rules are
// testable. `mcp-install.ts` decides which files and does the I/O.

/**
 * The two ways to reach the app. Agents that speak Streamable HTTP get the
 * URL, which is the same on every machine; the rest get the bundled `dapi`
 * binary in stdio proxy mode. On Windows that binary is a `.cmd`, which
 * nothing can spawn without a shell, so the command is `cmd` and the shim's
 * path rides in `args`.
 */
export type McpServerSpec = { url: string; command: string; args: string[] };

/**
 * The key our entry lives under in every agent's server map, and so the
 * namespace an agent shows us under: `mcp__diffusion__<tool>` and
 * `/diffusion:<prompt>`. The same word as our URL scheme and the CLI's
 * primary name (`dapi` still works there too, as an alias).
 */
export const SERVER_NAME = "syka";

/** One agent's config entry: what its file format spells a server as. */
export type ServerEntry = Record<string, string | string[] | boolean>;

/** The stable id an agent is addressed by over IPC and in the UI. */
export type AgentId =
  | "claude-code"
  | "claude-desktop"
  | "cursor"
  | "vscode"
  | "codex"
  | "antigravity"
  | "gemini-cli"
  | "windsurf"
  | "opencode";

/** How a config file spells its server map: JSON under `mcpServers` (or VS Code's `servers`, or OpenCode's `mcp`), or Codex's TOML tables. */
export type ConfigFormat = "mcpServers" | "servers" | "mcp" | "toml";

/**
 * A path under one of the two per-user roots. `appData` is where desktop apps
 * keep their files (Electron's `appData`: ~/Library/Application Support on
 * macOS, %APPDATA% on Windows), which keeps this table the same on every
 * platform; `mcp-install.ts` knows where the roots are.
 */
export type AgentPath = { root: "home" | "appData"; path: string };

export type AgentTarget = {
  id: AgentId;
  /** Human name, for the UI. */
  label: string;
  /** Path whose presence means the agent is set up on this machine. */
  marker: AgentPath;
  /** Path of the config file our entry goes into. */
  config: AgentPath;
  format: ConfigFormat;
  /** The entry for this agent: which transport it gets, under the keys its format uses. */
  entry(spec: McpServerSpec): ServerEntry;
};

const http = (key: string, extra: ServerEntry = {}) => (spec: McpServerSpec): ServerEntry => ({ ...extra, [key]: spec.url });
const stdio = (spec: McpServerSpec): ServerEntry => ({ command: spec.command, args: [...spec.args] });

const home = (path: string): AgentPath => ({ root: "home", path });
const appData = (path: string): AgentPath => ({ root: "appData", path });

// Agents whose MCP config we know how to write, in the order the UI lists
// them. Claude Code's user scope is the top-level `mcpServers` of
// ~/.claude.json, the same file `claude mcp add --scope user` edits. VS Code
// keeps its user-level servers under `servers` in the profile's mcp.json.
// Antigravity shares one config across its IDE and CLI, and only accepts
// `serverUrl`. Claude Desktop's file takes stdio commands only, so it gets
// the proxy.
export const AGENT_TARGETS: readonly AgentTarget[] = [
  { id: "claude-code", label: "Claude Code", marker: home(".claude"), config: home(".claude.json"), format: "mcpServers", entry: http("url", { type: "http" }) },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    marker: appData("Claude"),
    config: appData("Claude/claude_desktop_config.json"),
    format: "mcpServers",
    entry: stdio,
  },
  { id: "cursor", label: "Cursor", marker: home(".cursor"), config: home(".cursor/mcp.json"), format: "mcpServers", entry: http("url") },
  {
    id: "vscode",
    label: "VS Code (Copilot)",
    marker: appData("Code"),
    config: appData("Code/User/mcp.json"),
    format: "servers",
    entry: http("url", { type: "http" }),
  },
  { id: "codex", label: "Codex", marker: home(".codex"), config: home(".codex/config.toml"), format: "toml", entry: http("url") },
  { id: "antigravity", label: "Antigravity", marker: home(".gemini/antigravity"), config: home(".gemini/config/mcp_config.json"), format: "mcpServers", entry: http("serverUrl") },
  { id: "gemini-cli", label: "Gemini CLI", marker: home(".gemini"), config: home(".gemini/settings.json"), format: "mcpServers", entry: http("httpUrl") },
  { id: "windsurf", label: "Devin (Windsurf)", marker: home(".codeium/windsurf"), config: home(".codeium/windsurf/mcp_config.json"), format: "mcpServers", entry: http("serverUrl") },
  { id: "opencode", label: "OpenCode", marker: home(".config/opencode"), config: home(".config/opencode/opencode.json"), format: "mcp", entry: http("url", { type: "remote", enabled: true }) },
];

export function agentTarget(id: AgentId): AgentTarget {
  const target = AGENT_TARGETS.find((candidate) => candidate.id === id);
  if (!target) throw new Error(`Unknown agent: ${id}`);
  return target;
}

/** Whether the agent runs our entry over stdio, and so needs the `dapi` binary. */
export function needsBinary(target: AgentTarget): boolean {
  return "command" in target.entry({ url: "http://x", command: "x", args: [] });
}

/**
 * The config with our entry set, leaving everything else as it was. `text`
 * is the file's current content, or null when there is none yet. Throws
 * when the file cannot be parsed: a config we cannot read is not one we
 * should overwrite.
 */
export function upsertServer(text: string | null, format: ConfigFormat, entry: ServerEntry): string {
  return format === "toml" ? upsertToml(text, entry) : upsertJson(text, format, entry);
}

/**
 * The config with our entry taken out, everything else untouched; null when
 * the file has no entry of ours (or cannot be parsed), so there is nothing
 * to write back. Other servers and unrelated keys stay as they were.
 */
export function removeServer(text: string | null, format: ConfigFormat): string | null {
  if (readServer(text, format) === null) return null;
  return format === "toml" ? removeToml(text as string) : removeJson(text as string, format);
}

/** Where our entry currently points, whatever keys the agent spells it with; null when there is none. */
export type Registered = { url?: string; command?: string; args?: string[] };

export function readServer(text: string | null, format: ConfigFormat): Registered | null {
  if (text === null) return null;
  const entry = format === "toml" ? readToml(text) : readJson(text, format);
  if (!entry) return null;
  const url = entry.url ?? entry.httpUrl ?? entry.serverUrl;
  const command = entry.command;
  if (typeof url !== "string" && typeof command !== "string") return null;
  const args = Array.isArray(entry.args) ? entry.args.filter((arg): arg is string => typeof arg === "string") : null;
  return {
    ...(typeof url === "string" ? { url } : {}),
    ...(typeof command === "string" ? { command } : {}),
    ...(typeof command === "string" && args ? { args } : {}),
  };
}

// What a path to our proxy has in it: the app's name inside a macOS bundle
// (or the translocated mount a quarantined bundle ran from), the Squirrel
// package id in the Windows shim folder.
const OUR_PATHS = ["Syka Studio", "\\SykaStudio\\", "Syka Clips", "\\SykaClips\\"];

/**
 * Whether a stdio entry runs our proxy — from wherever the app was when the
 * entry was written — rather than something the user put under our name by
 * hand. The path is the command itself, or on Windows an argument to `cmd`.
 */
export function runsOurProxy(registered: Registered): boolean {
  return [registered.command ?? "", ...(registered.args ?? [])].some((part) =>
    OUR_PATHS.some((marker) => part.includes(marker)),
  );
}

/** Whether a stdio entry already is what `entry` would write. */
export function sameCommand(registered: Registered, entry: ServerEntry): boolean {
  const args = Array.isArray(entry.args) ? entry.args : [];
  return (
    registered.command === entry.command &&
    (registered.args ?? []).length === args.length &&
    (registered.args ?? []).every((arg, index) => arg === args[index])
  );
}

// --- JSON ------------------------------------------------------------------

type JsonFormat = Exclude<ConfigFormat, "toml">;
type JsonConfig = Record<string, unknown>;

function parseJson(text: string | null): JsonConfig {
  if (text === null || text.trim() === "") return {};
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("expected a JSON object at the top level");
  }
  return parsed as JsonConfig;
}

function serverMap(config: JsonConfig, root: JsonFormat): Record<string, unknown> {
  const servers = config[root];
  return typeof servers === "object" && servers !== null && !Array.isArray(servers)
    ? (servers as Record<string, unknown>)
    : {};
}

function upsertJson(text: string | null, root: JsonFormat, entry: ServerEntry): string {
  const config = parseJson(text);
  config[root] = { ...serverMap(config, root), [SERVER_NAME]: entry };
  return `${JSON.stringify(config, null, 2)}\n`;
}

function removeJson(text: string, root: JsonFormat): string {
  const config = parseJson(text);
  const { [SERVER_NAME]: _ours, ...servers } = serverMap(config, root);
  config[root] = servers;
  return `${JSON.stringify(config, null, 2)}\n`;
}

function readJson(text: string, root: JsonFormat): Record<string, unknown> | null {
  let config: JsonConfig;
  try {
    config = parseJson(text);
  } catch {
    return null;
  }
  const entry = serverMap(config, root)[SERVER_NAME];
  return typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : null;
}

// --- TOML (Codex) ----------------------------------------------------------

// Our table, from its header up to the next table header or the end. A
// header line is `[...]` at column 0; indented or commented ones are not.
const TOML_TABLE = new RegExp(String.raw`^\[mcp_servers\.${SERVER_NAME}\][^\n]*\n(?:(?!\[)[^\n]*\n?)*`, "m");

function tomlString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function tomlValue(value: string | string[] | boolean): string {
  if (typeof value === "boolean") return String(value);
  return Array.isArray(value) ? `[${value.map(tomlString).join(", ")}]` : tomlString(value);
}

function tomlTable(entry: ServerEntry): string {
  const lines = Object.entries(entry).map(([key, value]) => `${key} = ${tomlValue(value)}`);
  return [`[mcp_servers.${SERVER_NAME}]`, ...lines, ""].join("\n");
}

function upsertToml(text: string | null, entry: ServerEntry): string {
  const current = text ?? "";
  const table = tomlTable(entry);
  if (TOML_TABLE.test(current)) return current.replace(TOML_TABLE, table);
  const separator = current === "" || current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n";
  return `${current}${separator}${table}`;
}

// Drops our table, then the blank lines it used to sit between so the file
// does not end in (or contain) a growing gap after a connect/disconnect cycle.
function removeToml(text: string): string {
  const rest = text.replace(TOML_TABLE, "").replace(/\n{3,}/g, "\n\n").trimEnd();
  return rest === "" ? "" : `${rest}\n`;
}

function readToml(text: string): Record<string, unknown> | null {
  const table = text.match(TOML_TABLE)?.[0];
  if (!table) return null;
  const entry: Record<string, unknown> = {};
  for (const line of table.split("\n").slice(1)) {
    const scalar = line.match(/^(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/);
    if (scalar) {
      entry[scalar[1]] = untomlString(scalar[2]);
      continue;
    }
    const list = line.match(/^(\w+)\s*=\s*\[([^\]]*)\]\s*$/);
    if (list) entry[list[1]] = [...list[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => untomlString(m[1]));
  }
  return entry;
}

function untomlString(value: string): string {
  return value.replaceAll('\\"', '"').replaceAll("\\\\", "\\");
}
