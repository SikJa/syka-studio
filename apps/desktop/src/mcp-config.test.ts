/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { describe, expect, it } from "vitest";
import {
  AGENT_TARGETS,
  agentTarget,
  needsBinary,
  readServer,
  removeServer,
  runsOurProxy,
  sameCommand,
  upsertServer,
} from "./mcp-config";

const spec = {
  url: "http://127.0.0.1:3275/mcp",
  command: "/Applications/Syka Clips.app/Contents/Resources/cli/bin/dapi",
  args: ["mcp"],
};

describe("per-agent entries", () => {
  it("spells the URL the way each agent expects", () => {
    expect(agentTarget("claude-code").entry(spec)).toEqual({ type: "http", url: spec.url });
    expect(agentTarget("cursor").entry(spec)).toEqual({ url: spec.url });
    expect(agentTarget("vscode").entry(spec)).toEqual({ type: "http", url: spec.url });
    expect(agentTarget("codex").entry(spec)).toEqual({ url: spec.url });
    expect(agentTarget("antigravity").entry(spec)).toEqual({ serverUrl: spec.url });
    expect(agentTarget("gemini-cli").entry(spec)).toEqual({ httpUrl: spec.url });
    expect(agentTarget("windsurf").entry(spec)).toEqual({ serverUrl: spec.url });
    expect(agentTarget("opencode").entry(spec)).toEqual({ type: "remote", enabled: true, url: spec.url });
  });

  it("gives Claude Desktop the stdio proxy, and nobody else", () => {
    expect(agentTarget("claude-desktop").entry(spec)).toEqual({ command: spec.command, args: ["mcp"] });
    expect(AGENT_TARGETS.filter(needsBinary).map((t) => t.id)).toEqual(["claude-desktop"]);
  });

  it("has a unique id per agent", () => {
    expect(new Set(AGENT_TARGETS.map((t) => t.id)).size).toBe(AGENT_TARGETS.length);
  });
});

describe("json configs", () => {
  it("creates the file from nothing", () => {
    const text = upsertServer(null, "mcpServers", { type: "http", url: spec.url });
    expect(JSON.parse(text)).toEqual({ mcpServers: { syka: { type: "http", url: spec.url } } });
    expect(text.endsWith("\n")).toBe(true);
  });

  it("uses VS Code's root key", () => {
    const text = upsertServer(null, "servers", { type: "http", url: spec.url });
    expect(JSON.parse(text)).toEqual({ servers: { syka: { type: "http", url: spec.url } } });
    expect(readServer(text, "servers")).toEqual({ url: spec.url });
    // The same file read under the other root key has nothing of ours.
    expect(readServer(text, "mcpServers")).toBeNull();
  });

  it("uses OpenCode's root key and keeps the boolean flag", () => {
    const text = upsertServer(null, "mcp", { type: "remote", enabled: true, url: spec.url });
    expect(JSON.parse(text)).toEqual({ mcp: { syka: { type: "remote", enabled: true, url: spec.url } } });
    expect(readServer(text, "mcp")).toEqual({ url: spec.url });
  });

  it("keeps other servers and unrelated keys", () => {
    const before = JSON.stringify({
      numStartups: 12,
      mcpServers: { other: { command: "x", args: [] } },
      projects: { "/a": { allowedTools: [] } },
    });
    const after = JSON.parse(upsertServer(before, "mcpServers", { url: spec.url }));
    expect(after.numStartups).toBe(12);
    expect(after.projects).toEqual({ "/a": { allowedTools: [] } });
    expect(after.mcpServers.other).toEqual({ command: "x", args: [] });
    expect(after.mcpServers.syka).toEqual({ url: spec.url });
  });

  it("replaces a stdio entry with a URL entry, and reads either", () => {
    const before = upsertServer(null, "mcpServers", { command: "/old/dapi", args: ["mcp"] });
    expect(readServer(before, "mcpServers")).toEqual({ command: "/old/dapi", args: ["mcp"] });
    const after = upsertServer(before, "mcpServers", { type: "http", url: spec.url });
    expect(readServer(after, "mcpServers")).toEqual({ url: spec.url });
    expect(JSON.parse(after).mcpServers.syka.command).toBeUndefined();
  });

  it("reads the URL under each agent's key", () => {
    for (const key of ["url", "httpUrl", "serverUrl"]) {
      expect(readServer(upsertServer(null, "mcpServers", { [key]: spec.url }), "mcpServers")).toEqual({ url: spec.url });
    }
  });

  it("refuses to overwrite a file it cannot parse", () => {
    expect(() => upsertServer("{ not json", "mcpServers", { url: spec.url })).toThrow();
    expect(() => upsertServer("[1, 2]", "mcpServers", { url: spec.url })).toThrow();
    expect(readServer("{ not json", "mcpServers")).toBeNull();
  });

  it("treats an empty file as no config", () => {
    expect(readServer("", "mcpServers")).toBeNull();
    expect(JSON.parse(upsertServer("  \n", "mcpServers", { url: spec.url }))).toEqual({ mcpServers: { syka: { url: spec.url } } });
  });

  it("removes our entry and nothing else", () => {
    const before = JSON.stringify({
      numStartups: 12,
      mcpServers: { other: { command: "x", args: [] }, syka: { type: "http", url: spec.url } },
    });
    const after = removeServer(before, "mcpServers");
    expect(after).not.toBeNull();
    expect(JSON.parse(after as string)).toEqual({ numStartups: 12, mcpServers: { other: { command: "x", args: [] } } });
    expect(readServer(after, "mcpServers")).toBeNull();
  });

  it("has nothing to remove from a config without our entry", () => {
    expect(removeServer(null, "mcpServers")).toBeNull();
    expect(removeServer("", "mcpServers")).toBeNull();
    expect(removeServer(JSON.stringify({ mcpServers: { other: { url: "u" } } }), "mcpServers")).toBeNull();
    expect(removeServer("{ not json", "mcpServers")).toBeNull();
  });
});

describe("toml configs (codex)", () => {
  it("appends a table to an existing config", () => {
    const before = 'model = "o3"\n\n[mcp_servers.other]\ncommand = "x"\n';
    const after = upsertServer(before, "toml", { url: spec.url });
    expect(after).toBe('model = "o3"\n\n[mcp_servers.other]\ncommand = "x"\n\n[mcp_servers.syka]\nurl = "http://127.0.0.1:3275/mcp"\n');
    expect(readServer(after, "toml")).toEqual({ url: spec.url });
  });

  it("replaces our table in place and leaves the next one alone", () => {
    const before = '[mcp_servers.syka]\ncommand = "/old/dapi"\nargs = ["mcp"]\n\n[mcp_servers.other]\ncommand = "x"\n';
    expect(readServer(before, "toml")).toEqual({ command: "/old/dapi", args: ["mcp"] });
    const after = upsertServer(before, "toml", { url: spec.url });
    expect(after).toBe('[mcp_servers.syka]\nurl = "http://127.0.0.1:3275/mcp"\n[mcp_servers.other]\ncommand = "x"\n');
    expect(readServer(after, "toml")).toEqual({ url: spec.url });
  });

  it("starts a file from nothing", () => {
    const text = upsertServer(null, "toml", { url: spec.url });
    expect(text).toBe('[mcp_servers.syka]\nurl = "http://127.0.0.1:3275/mcp"\n');
  });

  it("escapes quotes and backslashes in stdio paths", () => {
    const odd = { command: 'C:\\Apps\\"Diffusion"\\dapi', args: ["mcp"] };
    const text = upsertServer(null, "toml", odd);
    expect(text).toContain('command = "C:\\\\Apps\\\\\\"Diffusion\\"\\\\dapi"');
    expect(readServer(text, "toml")).toEqual({ command: odd.command, args: ["mcp"] });
  });

  it("reads nothing from a config without our table", () => {
    expect(readServer('model = "o3"\n', "toml")).toBeNull();
    expect(removeServer('model = "o3"\n', "toml")).toBeNull();
  });

  it("removes our table from the end of a config", () => {
    const before = 'model = "o3"\n\n[mcp_servers.other]\ncommand = "x"\n';
    const connected = upsertServer(before, "toml", { url: spec.url });
    expect(removeServer(connected, "toml")).toBe(before);
  });

  it("removes our table from between others without leaving a gap", () => {
    const before = 'model = "o3"\n\n[mcp_servers.syka]\nurl = "u"\n\n[mcp_servers.other]\ncommand = "x"\n';
    expect(removeServer(before, "toml")).toBe('model = "o3"\n\n[mcp_servers.other]\ncommand = "x"\n');
  });

  it("empties a config that held only our table", () => {
    expect(removeServer(upsertServer(null, "toml", { url: spec.url }), "toml")).toBe("");
  });
});

describe("stdio entries across platforms", () => {
  const shim = "C:\\Users\\Example\\AppData\\Local\\SykaClips\\bin\\dapi.cmd";
  const windows = { url: spec.url, command: "cmd", args: ["/c", shim, "mcp"] };

  it("keeps desktop apps' configs under appData and the dotfile agents under home", () => {
    expect(agentTarget("claude-desktop").config).toEqual({ root: "appData", path: "Claude/claude_desktop_config.json" });
    expect(agentTarget("vscode").config).toEqual({ root: "appData", path: "Code/User/mcp.json" });
    expect(AGENT_TARGETS.filter((t) => t.config.root === "appData").map((t) => t.id)).toEqual(["claude-desktop", "vscode"]);
  });

  it("round-trips the Windows shape, where the shim rides in args", () => {
    const entry = agentTarget("claude-desktop").entry(windows);
    expect(entry).toEqual({ command: "cmd", args: ["/c", shim, "mcp"] });
    const registered = readServer(upsertServer(null, "mcpServers", entry), "mcpServers");
    expect(registered).toEqual({ command: "cmd", args: ["/c", shim, "mcp"] });
    expect(sameCommand(registered!, entry)).toBe(true);
  });

  it("recognises our proxy by its path, as the command or as an argument", () => {
    expect(runsOurProxy({ command: spec.command, args: ["mcp"] })).toBe(true);
    expect(runsOurProxy({ command: "/private/var/folders/x/AppTranslocation/y/d/cli/bin/dapi" })).toBe(false);
    expect(runsOurProxy({ command: "cmd", args: ["/c", shim, "mcp"] })).toBe(true);
    expect(runsOurProxy({ command: "cmd", args: ["/c", "C:\\tools\\other.cmd"] })).toBe(false);
    expect(runsOurProxy({ command: "/opt/homebrew/bin/dapi", args: ["mcp"] })).toBe(false);
  });

  it("sees a moved shim as a different command", () => {
    const moved = { command: "cmd", args: ["/c", shim.replace("Example", "OtherExample"), "mcp"] };
    expect(sameCommand(moved, agentTarget("claude-desktop").entry(windows))).toBe(false);
    expect(sameCommand({ command: spec.command, args: ["mcp"] }, agentTarget("claude-desktop").entry(spec))).toBe(true);
  });
});
