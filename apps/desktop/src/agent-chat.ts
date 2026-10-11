/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The agent chat host as a utility process: forked from the ESM bundle
// esbuild puts in dist/, configured over parentPort (never argv, which
// every process can read), restarted with backoff when it dies. The
// renderer asks for the endpoint over the existing IPC and talks to the
// host over its own WebSocket from there.

import { isPackagedBuild } from './app-mode';
import { ffmpegPath } from "./syka-agent-settings";
import { agentToolEnvironment } from './syka-dependencies';
import { backgroundEnvironment } from './background-removal';
import { app, utilityProcess } from "electron";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { randomUUID } from 'node:crypto';
import type { AgentNoticeEvent } from '../../../packages/agent-chat/src/notifications';

import type { UtilityProcess } from "electron";

type AgentChatOptions = { dataDir: string; mcpUrl: string | null; version: string; docsDir?: string | null; onNotice?: (event: AgentNoticeEvent) => void };
const answers = new Map<string, { resolve(): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
const activityRequests = new Map<string, { resolve(busy: boolean): void; timer: ReturnType<typeof setTimeout> }>();
function rejectAnswers() { for (const entry of answers.values()) { clearTimeout(entry.timer); entry.reject(Error('El agente se reinició. Tu respuesta sigue en el borrador.')); } answers.clear(); }

const DEV_ORIGIN = process.env.SYKA_DEV_URL || "http://localhost:5188";
const RESTART_DELAYS_MS = [1000, 2000, 5000, 10_000];
const STOP_GRACE_MS = 3000;

let child: UtilityProcess | null = null;
let endpoint: { url: string } | null = null;
let options: AgentChatOptions | null = null;
let token = "";
let restarts = 0;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

function spawn(): void {
  if (!options || stopped) return;
  const path = join(app.getAppPath(), "dist", "agent-host.mjs");
  const proc = utilityProcess.fork(path, [], { serviceName: "Agent Chat", stdio: "inherit", env: { ...agentToolEnvironment(), ...backgroundEnvironment(), SYKA_ONBOARDING_DIR: join(app.getPath('userData'), 'brand-kits') } });
  child = proc;

  proc.on("spawn", () => {
    proc.postMessage({
      type: "start",
      config: {
        token,
        dataDir: options!.dataDir,
        runtimeDir: join(process.env.SYKA_RUNTIME_ROOT || options!.dataDir, "codex-runtime"),
        browserModulesRoot: isPackagedBuild() ? join(process.resourcesPath, "runtime") : undefined,
        docsDir: options!.docsDir ?? undefined,
        codeGraphRoot: process.env.SYKA_CODE_GRAPH_ROOT || (isPackagedBuild() ? undefined : resolve(app.getAppPath(), '../..')),
        mcp: options!.mcpUrl ? { name: "syka", url: options!.mcpUrl } : null,
        version: options!.version,
        ffmpegPath: ffmpegPath(),
        allowedOrigins: isPackagedBuild() ? ["file://", "null"] : ["file://", "null", DEV_ORIGIN],
      },
    });
  });

  proc.on("message", (message: { type?: string; url?: string; message?: string; event?: AgentNoticeEvent; id?: string; error?: string; busy?: boolean }) => {
    if (child !== proc) return;
    if (message?.type === 'activity.status' && message.id) {
      const pending = activityRequests.get(message.id);
      if (pending) { clearTimeout(pending.timer); activityRequests.delete(message.id); pending.resolve(message.busy !== false); }
    }
    if (message?.type === 'notification.event' && message.event) options?.onNotice?.(message.event);
    if (message?.type === 'notification.answered' && message.id) {
      const pending = answers.get(message.id);
      if (pending) { clearTimeout(pending.timer); answers.delete(message.id); if (message.error) pending.reject(Error(message.error)); else pending.resolve(); }
    }
    if (message?.type === "listening" && typeof message.url === "string") {
      endpoint = { url: message.url };
      restarts = 0;
      console.log(`[agent-chat] host listening at ${message.url.replace(/token=.*$/, "token=…")}`);
    } else if (message?.type === "error") {
      console.error(`[agent-chat] host failed to start: ${message.message}`);
    }
  });

  proc.on("exit", (code) => {
    if (child !== proc) return;
    child = null;
    rejectAnswers();
    endpoint = null;
    if (stopped) return;
    const delay = RESTART_DELAYS_MS[Math.min(restarts, RESTART_DELAYS_MS.length - 1)]!;
    restarts += 1;
    console.error(`[agent-chat] host exited (${code}); restarting in ${delay} ms`);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      spawn();
    }, delay);
  });
}

/** Generates the token and forks the host. Call once, after `whenReady`. */
export function startAgentChat(next: AgentChatOptions): void {
  options = next;
  token = randomBytes(32).toString("base64url");
  stopped = false;
  restarts = 0;
  spawn();
}

/** Where the host is right now: null while it is (re)starting. */
export function agentChatEndpoint(): { url: string } | null {
  return endpoint;
}

/** Fail closed if the utility process is starting, unavailable or unresponsive. */
export function isAgentChatBusy(): Promise<boolean> {
  if (!child || !endpoint) return Promise.resolve(true);
  const id = randomUUID();
  return new Promise(resolve => {
    const timer = setTimeout(() => { activityRequests.delete(id); resolve(true); }, 2000);
    activityRequests.set(id, { resolve, timer });
    try { child!.postMessage({ type: 'activity.status', id }); }
    catch { clearTimeout(timer); activityRequests.delete(id); resolve(true); }
  });
}

export function answerAgentNotice(chatId: string, requestId: string, values: Record<string, string[]>, attachments: string[] = []): Promise<void> {
  if (!child || !endpoint) return Promise.reject(Error('El agente se está reiniciando. Probá de nuevo.'));
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { answers.delete(id); reject(Error('El agente tardó en confirmar. Revisá el chat antes de volver a enviar.')); }, 30_000);
    answers.set(id, { resolve, reject, timer });
    try { child!.postMessage({ type: 'notification.answer', id, chatId, requestId, answers: values, attachments }); }
    catch (error) { clearTimeout(timer); answers.delete(id); reject(error); }
  });
}

/** Best effort: a host that is down or restarting leaves the chats behind. They aren't trashed with the folder. */
export function deleteProjectChats(projectId: string): void {
  if (projectId && endpoint) child?.postMessage({ type: "deleteProject", projectId });
}

/** Asks the host to stop (it kills its harness trees), then kills it after a grace period. */
export function stopAgentChat(): void {
  for (const pending of activityRequests.values()) { clearTimeout(pending.timer); pending.resolve(true); }
  activityRequests.clear();
  rejectAnswers();
  stopped = true;
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = null;
  const proc = child;
  child = null;
  endpoint = null;
  if (!proc) return;
  try {
    proc.postMessage({ type: "stop" });
  } catch {
    // Already gone.
  }
  const timer = setTimeout(() => proc.kill(), STOP_GRACE_MS);
  proc.once("exit", () => clearTimeout(timer));
}
