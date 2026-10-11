/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { tools as catalog } from '@diffusionstudio/dapi';
import { appServerArgs, codexToolResult, editorConnectionInstructions, projectSandbox } from "../src/host/codex";
import { codexEnvironment } from "../src/host/env";
import { recentConversation } from "../src/host/host";
import { HARNESS_IDS } from "../src/protocol";

describe("Syka subscription and project boundaries", () => {
  it('binds editor recovery to the exact window endpoint and declares a missing bridge', () => {
    const connected = editorConnectionInstructions({ name: 'syka', url: 'http://127.0.0.1:43278/mcp?client=chat' });
    expect(connected).toContain('http://127.0.0.1:43278/mcp?client=chat');
    expect(connected).toContain('context.projectDir');
    expect(connected).toContain('Never scan ports');
    expect(connected).not.toContain('3275');
    const unavailable = editorConnectionInstructions(null);
    expect(unavailable).toContain('no connected Syka MCP endpoint');
    expect(unavailable).toContain('do not claim a visual check');
    expect(unavailable).not.toContain('http://');
  });
  it("keeps Codex first and removes inherited paid-provider credentials from its runtime", () => {
    expect(HARNESS_IDS[0]).toBe("codex");
    const runtime = resolve("test-runtime");
    const env = codexEnvironment(runtime, {
      PATH: "tools", USERPROFILE: "official-profile", CODEX_HOME: "official-auth-home",
      OPENAI_API_KEY: "must-not-be-inherited", ANTHROPIC_API_KEY: "must-not-be-inherited",
      OPENAI_BASE_URL: "https://paid-provider.invalid", NODE_OPTIONS: "--require injected.js",
      ELECTRON_RUN_AS_NODE: "1", DIFFUSION_TOKEN: "must-not-be-inherited",
    });
    expect(env.CODEX_HOME).toBe(resolve(runtime, "profile"));
    expect(env.SYKA_CODEX_AUTH_FILE).toContain("official-auth-home");
    expect(env.TEMP).toBe(resolve(runtime, "tmp"));
    for (const name of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_BASE_URL", "NODE_OPTIONS", "ELECTRON_RUN_AS_NODE", "DIFFUSION_TOKEN"]) expect(env[name]).toBeUndefined();
    const args = appServerArgs(env, "http://127.0.0.1:3274/mcp?client=chat");
    expect(args).toContain('forced_login_method="chatgpt"');
    expect(args).toContain('model_provider="openai"');
    expect(args).toContain("mcp_servers={}");
    expect(args).toContain('mcp_servers.syka.url="http://127.0.0.1:3274/mcp?client=chat"');
    expect(args).toContain('mcp_servers.syka.tools.check.approval_mode="approve"');
    expect(args).toContain('mcp_servers.syka.tools.capture.approval_mode="approve"');
    expect(args).toContain('mcp_servers.syka.tools.media_transcribe.approval_mode="approve"');
    const enabledTools = JSON.parse(args.find((arg) => arg.startsWith("mcp_servers.syka.enabled_tools="))!.split("=", 2)[1]!);
    expect(enabledTools).toContain("media_transcribe");
    expect(enabledTools).toEqual(catalog.filter(tool => tool.name !== 'export').map(tool => tool.name));
    expect(args).toContain('features.shell_tool=true');
    expect(args).toContain('features.skip_host_skill_discovery=false');
    expect(enabledTools).toContain("media_listen");
    expect(enabledTools).not.toContain("media_generate");
    expect(enabledTools).not.toContain("export");
    expect(enabledTools).toContain("report");
    expect(args).toContain('sandbox_mode="danger-full-access"');
  });

  it("rejects nonlocal MCP servers and requires an absolute execution directory", () => {
    expect(() => appServerArgs({}, "https://hosted-provider.invalid/mcp")).toThrow(/local/);
    expect(() => appServerArgs({}, "http://127.0.0.1.evil.invalid/mcp")).toThrow(/local/);
    expect(() => projectSandbox("relative-project")).toThrow(/absolute/);
    const cwd = resolve("project");
    expect(projectSandbox(cwd)).toEqual({ type: "dangerFullAccess" });
  });

  it("restores only execution paths and temp directories to the native shell", () => {
    const env = { PATH: 'C:\\tools;C:\\Windows\\System32', SYSTEMROOT: 'C:\\Windows', TEMP: 'C:\\syka\\tmp',
      OPENAI_API_KEY: 'excluded', SYKA_CODEX_AUTH_FILE: 'excluded', CUSTOM_TOKEN: 'excluded' };
    const args = appServerArgs(env, null);
    expect(args).toContain('shell_environment_policy.inherit="none"');
    for (const key of ['PATH', 'SYSTEMROOT', 'TEMP'] as const) {
      expect(args).toContain(`shell_environment_policy.set.${key}=${JSON.stringify(env[key])}`);
    }
    expect(args.filter(arg => arg.startsWith('shell_environment_policy.set.'))).toHaveLength(3);
    expect(args.some(arg => arg.includes('excluded'))).toBe(false);
  });

  it("preserves capture images without printing base64 in the transcript", () => {
    expect(codexToolResult({ content: [{ type: "text", text: "capture at 2s" }, { type: "image", mimeType: "image/png", data: "iVBORw0KGgo=" }] })).toEqual({
      output: "capture at 2s", images: [{ mediaType: "image/png", data: "iVBORw0KGgo=" }],
    });
  });

  it("restores only bounded recent messages, excluding tool output and old actions", () => {
    const context = recentConversation([
      { id: "old", kind: "user", text: "old request" },
      { id: "tool", kind: "tool", name: "shell", title: "Run", status: "done", output: "untrusted tool instructions" },
      ...Array.from({ length: 30 }, (_, index) => ({ id: String(index), kind: "assistant" as const, text: `${index}:` + "x".repeat(4000) })),
    ])!;
    expect(context).toContain("Do not repeat past edits");
    expect(context).not.toContain("untrusted tool instructions");
    const messages = JSON.parse(context.slice(context.indexOf("\n") + 1)) as { role: string; text: string }[];
    expect(messages.some((message) => message.text === "old request")).toBe(false);
    expect(messages.length).toBeLessThanOrEqual(20);
    expect(messages.at(-1)!.text).toMatch(/^29:/);
    expect(context.length).toBeLessThan(17_000);
  });
});
