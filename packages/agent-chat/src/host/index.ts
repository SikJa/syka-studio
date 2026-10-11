/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The Node side, in one call: `startAgentHost(config)` hydrates the
// environment, opens the store, wires the harnesses and listens. Electron
// runs this in a utility process, a sandbox runs it under plain `node`;
// neither is imported here.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { codexEnvironment, hydrateEnv } from "./env";
import { AgentHost } from "./host";
import { CodexHarness } from "./codex";
import { DEFAULT_ORIGINS, startServer } from "./server";
import { ChatStore } from "./store";
import { NativeUsageRecovery } from './native-usage';
import { resolveLocalTool } from './local-tools';
import { loadExternalHarnesses, readHarnessSettings, saveHarnessSettings } from './external-harnesses';
import { startCodeGraph } from './code-graph';

import type { Harness, McpConfig } from "./harness";

export type AgentHostConfig = {
  onNotice?: (event: import('../notifications').AgentNoticeEvent) => void;
  /** default "127.0.0.1" */
  host?: string;
  /** default 0 (random) */
  port?: number;
  /** required; 32 random bytes, base64url */
  token: string;
  /** chat storage root */
  dataDir: string;
  /** default: file://, null, http://localhost:5173 */
  allowedOrigins?: string[];
  /** injected into every session */
  mcp: McpConfig | null;
  /** appended to each harness's system/developer prompt */
  instructions?: string;
  version: string;
  /** Process-local runtime/cache paths. Never changes the user's Codex auth or config. */
  runtimeDir?: string;
  ffmpegPath?: string;
  /** Packaged external modules are staged under resources/runtime. */
  browserModulesRoot?: string;
  docsDir?: string;
  /** Explicit public application repository; never derived from an editorial project. */
  codeGraphRoot?: string;
  /** For tests: replaces the real harnesses. */
  harnesses?: Harness[];
  log?: (message: string) => void;
};

export type RunningAgentHost = {
  isBusy(): boolean;
  answer(chatId: string, requestId: string, response: import('../protocol').RequestResponse): Promise<void>;
  url: string;
  port: number;
  deleteChats(projectId: string): Promise<void>;
  stop(): Promise<void>;
};

export async function createAgentHost(config: AgentHostConfig): Promise<RunningAgentHost> {
  if (!config.token) throw new Error("agent host: a token is required");
  const log = config.log ?? ((message: string) => console.error(`[agent-chat] ${message}`));
  const runtimeDir = config.runtimeDir ?? join(config.dataDir, "codex-runtime");
  await Promise.all(["tmp", "cache", "logs", "isolated-state", "profile"].map((name) => mkdir(join(runtimeDir, name), { recursive: true })));
  const env = hydrateEnv().then((host) => {
    const ffmpeg = config.ffmpegPath ?? resolveLocalTool('ffmpeg', { env: host.env, roots: [join(runtimeDir, '..', 'tools')], extraDirs: host.extraDirs }).path;
    const videoPaths=Object.fromEntries(([['yt-dlp','SYKA_YTDLP_PATH'],['ffprobe','SYKA_FFPROBE_PATH'],['node','SYKA_NODE_PATH']] as const).flatMap(([tool,key])=>{const path=resolveLocalTool(tool,{env:host.env,roots:[join(runtimeDir,'..','tools')],extraDirs:host.extraDirs}).path;return path?[[key,path]]:[]}));
    return { ...host, env: { ...codexEnvironment(runtimeDir, host.env),
      ...(host.env.HERMES_HOME ? { SYKA_HERMES_HOME: host.env.HERMES_HOME } : {}),
      SYKA_AGENT_CONFIG: join(runtimeDir, '..', 'agent-settings.json'), SYKA_RESOURCE_CONFIG: join(runtimeDir, '..', 'resource-libraries.json'),
      ...(ffmpeg ? { SYKA_FFMPEG_PATH: ffmpeg } : {}),
      ...videoPaths,
      ...(config.browserModulesRoot ? { SYKA_BROWSER_MODULES_ROOT: config.browserModulesRoot } : {}),
      ...(config.docsDir ? { SYKA_REFERENCE_DOCS_DIR: config.docsDir } : {}),
      ...(config.codeGraphRoot ? { SYKA_CODE_GRAPH_ROOT: config.codeGraphRoot } : {}),
    } };
  });
  const store = new ChatStore(config.dataDir);
  const recovery = new NativeUsageRecovery(runtimeDir, store, log);
  const harnesses = config.harnesses ?? [new CodexHarness(config.version), ...await loadExternalHarnesses(join(runtimeDir, '..', 'harnesses.json'), join(runtimeDir, '..', 'harness-profiles'))];
  const agentHost = new AgentHost({
    recoverUsage: config.harnesses ? undefined : ids => recovery.recover(ids),
    onNotice: config.onNotice,
    store,
    harnesses,
    env,
    mcp: config.mcp,
    instructions: config.instructions,
    version: config.version,
    providerSettings: config.harnesses ? undefined : {
      read: () => readHarnessSettings(join(runtimeDir, '..', 'harnesses.json'), join(runtimeDir, '..', 'harness-profiles')),
      save: async entry => {
        const configFile = join(runtimeDir, '..', 'harnesses.json'), profilesRoot = join(runtimeDir, '..', 'harness-profiles');
        const settings = await saveHarnessSettings(configFile, profilesRoot, entry);
        const harness = (await loadExternalHarnesses(configFile, profilesRoot)).find(h => h.id === entry.id)!;
        return { settings, harness };
      },
    },
    log,
  });
  await agentHost.start();
  const server = await startServer({
    host: config.host ?? "127.0.0.1",
    port: config.port ?? 0,
    token: config.token,
    allowedOrigins: config.allowedOrigins ?? DEFAULT_ORIGINS,
    agentHost,
    log,
  });
  const stopCodeGraph = config.codeGraphRoot ? startCodeGraph(config.codeGraphRoot, log) : async () => {};
  return {
    isBusy: () => agentHost.isBusy(),
    answer: (chatId, requestId, response) => agentHost.handle({ send: () => {} }, 'request.respond', { chatId, requestId, response }),
    url: server.url,
    port: server.port,
    deleteChats(projectId) {
      return agentHost.deleteChats(projectId);
    },
    async stop() {
      try { await agentHost.stop(); await server.close(); }
      finally { await stopCodeGraph(); }
    },
  };
}

export { AgentHost, HostError } from "./host";
export { ChatStore } from "./store";
export { FakeHarness } from "./fake";
export { CodexHarness } from "./codex";
export { AcpHarness } from "./acp";
export { ClaudeCliHarness } from "./claude-cli";
export { hydrateEnv, inheritedEnv, which, resolveBinary, killTree } from "./env";
export type { Harness, HarnessSession, McpConfig, ResumeCursor, OpenOptions } from "./harness";
export type { HostEnv } from "./env";
