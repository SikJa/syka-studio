/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Registers the app's MCP server with the agents on this machine, one agent
// at a time as the settings page asks: the fixed loopback URL for agents
// that speak HTTP, the bundled `dapi mcp` proxy for the rest. No PATH
// symlink and no admin prompt — that is `cli-install.ts`, for people who
// type `diffusion` (or its `dapi` alias).

import { isPackagedBuild } from './app-mode';
import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { MCP_URL } from "@diffusionstudio/dapi";
import { inheritedEnv, which } from "@diffusionstudio/agent-chat/host/env";
import { shimPath } from "./cli-windows";
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

import type { AgentPath, AgentTarget, McpServerSpec } from "./mcp-config";
import type { McpAgentStatus, McpApplyRequest, McpApplyResult, McpStatus } from "./main-channels";

/**
 * The bundled `dapi` binary, or null when none is available (an unstaged dev
 * build). On Windows it is the shim outside the install folder, the one path
 * that survives an update; a packaged app writes it on every launch, so it
 * counts as there even in the moment before that write lands.
 */
export function dapiBinary(): string | null {
  if (process.platform === "win32") {
    const shim = shimPath();
    return isPackagedBuild() || existsSync(shim) ? shim : null;
  }
  if (!isPackagedBuild()) {
    // `npm run link` may use Apple Silicon/Intel Homebrew, ~/.local/bin or
    // another npm prefix on PATH. The shared resolver checks executable files.
    return which("dapi", inheritedEnv());
  }
  const command = join(process.resourcesPath, "cli", "bin", "dapi");
  return existsSync(command) ? command : null;
}

function spec(url = MCP_URL): McpServerSpec {
  const binary = dapiBinary();
  if (!binary) {
    return { url, command: "", args: [] };
  }
  // A `.cmd` only runs through a shell, and the agents spawn without one.
  if (process.platform === "win32") {
    return { url, command: "cmd", args: ["/c", binary, "mcp"] };
  }

  return { url, command: binary, args: ["mcp"] };
}

function resolvePath(location: AgentPath): string {
  if (location.root === "home") {
    return join(homedir(), location.path);
  }
  if (location.root === "appData") {
    return join(app.getPath("appData"), location.path);
  }

  throw new Error(`Unknown agent path root: ${location.root}`);
}

function readConfig(target: AgentTarget): string | null {
  const path = resolvePath(target.config);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function writeConfig(target: AgentTarget, text: string): void {
  const path = resolvePath(target.config);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/**
 * Why this agent cannot be connected from this build, or null when it can.
 * Only the stdio agents have reasons: a build without the `diffusion` binary has
 * nothing for them to run, and a quarantined first launch runs from a
 * translocated read-only mount whose path won't survive the next launch —
 * registering it would dangle.
 */
function unavailableReason(target: AgentTarget, current: McpServerSpec): string | null {
  if (!needsBinary(target)) return null;
  if (current.url !== MCP_URL) return "Esta instancia usa un puerto propio. Conectá por la URL HTTP de esta ventana; el proxy CLI corresponde a la instancia principal.";
  if (current.command === "") return "Necesita el CLI de Syka (dapi). Instalalo o agregalo al PATH y volvé a abrir Syka.";
  if (isPackagedBuild() && current.command.includes("/AppTranslocation/")) {
    return "Mové Syka Studio a la carpeta Aplicaciones y volvé a abrirlo primero.";
  }
  return null;
}

function agentStatus(target: AgentTarget, current: McpServerSpec, connectionError: string | null): McpAgentStatus {
  const registered = readServer(readConfig(target), target.format);
  return {
    id: target.id,
    label: target.label,
    detected: existsSync(resolvePath(target.marker)),
    connected: registered !== null && (registered.url === current.url || (!registered.url && current.url === MCP_URL && sameCommand(registered, target.entry(current)))),
    config: resolvePath(target.config),
    unavailable: connectionError ?? unavailableReason(target, current),
  };
}

/** Every agent we know, with whether it is on this machine and whether its config carries our entry. */
type McpConnection = Pick<McpStatus, 'url' | 'available' | 'error'>;
const defaultConnection: McpConnection = { url: MCP_URL, available: true, error: null };

export function mcpStatus(connection: McpConnection = defaultConnection): McpStatus {
  const current = spec(connection.url);
  const error = connection.available ? null : connection.error ?? 'Las herramientas de esta ventana no están disponibles. Reiniciá esta instancia para volver a conectarlas.';
  return { ...connection, error, agents: AGENT_TARGETS.map((target) => agentStatus(target, current, error)) };
}

/**
 * Writes our entry into the configs of `add` and takes it out of the configs
 * of `remove`, one file at a time, so one unreadable config does not stop
 * the rest. Other servers in the same file are left alone either way.
 */
export function applyMcp(request: McpApplyRequest, connection: McpConnection = defaultConnection): McpApplyResult {
  const current = spec(connection.url);
  const result: McpApplyResult = { added: [], removed: [], failures: [] };

  for (const id of request.add) {
    const target = agentTarget(id);
    const reason = !connection.available
      ? connection.error ?? 'Las herramientas de esta ventana no están disponibles; no se cambió la configuración del agente.'
      : unavailableReason(target, current);
    if (reason) {
      result.failures.push({ id, error: reason });
      continue;
    }
    try {
      writeConfig(target, upsertServer(readConfig(target), target.format, target.entry(current)));
      result.added.push(id);
    } catch (e) {
      result.failures.push({ id, error: `${target.config.path}: ${(e as Error).message}` });
    }
  }

  for (const id of request.remove) {
    const target = agentTarget(id);
    try {
      const next = removeServer(readConfig(target), target.format);
      if (next !== null) writeConfig(target, next);
      result.removed.push(id);
    } catch (e) {
      result.failures.push({ id, error: `${target.config.path}: ${(e as Error).message}` });
    }
  }

  return result;
}

/**
 * Launch-time self-heal for the stdio agents: an entry that still runs the
 * proxy from a bundle that moved (or was translocated when it was written)
 * is rewritten to the binary this build has. Entries the user wrote by hand
 * for something else are left alone.
 */
export function healMcpRegistrations(): void {
  if (!isPackagedBuild()) return;
  const current = spec();
  if (current.command === "" || current.command.includes("/AppTranslocation/")) return;

  for (const target of AGENT_TARGETS) {
    const text = readConfig(target);
    const registered = readServer(text, target.format);
    if (!registered?.command) continue;
    if (!runsOurProxy(registered)) continue;
    const entry = target.entry(current);
    if (sameCommand(registered, entry)) continue;

    try {
      writeConfig(target, upsertServer(text, target.format, entry));
    } catch {
      // best effort — the settings page remains as a manual fix
    }
  }
}
