/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isAbsolute, join } from "node:path";
import { acpEnvironment } from "./acp";
import { killTree, type HostEnv } from "./env";
import { QuestionBox, newItemId, collectResult, type Harness, type HarnessSession, type OpenOptions, type Emit, type ResumeCursor, type TurnOutcome } from "./harness";
import type { HarnessInfo, RequestResponse, Question } from "../protocol";
import { startEditorToolBridge } from "./editor-tool-bridge";
import { profileScope, advanceProfileScope } from "./harness-profile";
import { ClaudeUsageTracker, claudeCumulativeUsage } from './claude-usage';
import { runCliLogin } from './cli-login';

export type ClaudeCliConfig = { id: "claude"; command: string; args?: string[]; profileDir: string };
export function claudeEnvironment(config: ClaudeCliConfig, env: HostEnv): Record<string, string> {
  const isolated = acpEnvironment(config.profileDir, env.env);
  // Claude has its own supported config directory. Isolating Windows/browser
  // directories too causes OAuth to open Brave without the user's cookies.
  for (const name of ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) if (env.env[name]) isolated[name] = env.env[name]!;
  return { ...isolated, CLAUDE_CONFIG_DIR: config.profileDir };
}
function start(config: ClaudeCliConfig, args: string[], env: HostEnv, cwd: string): ChildProcess {
  if (!isAbsolute(config.command) || !isAbsolute(config.profileDir) || /\.(cmd|bat)$/i.test(config.command)) throw Error("Configurá el ejecutable absoluto de Claude Code, sin shell ni shims cmd.");
  return spawn(config.command, [...(config.args ?? []), ...args], { env: claudeEnvironment(config, env), cwd, stdio: "pipe", windowsHide: true, shell: false });
}
async function output(config: ClaudeCliConfig, args: string[], env: HostEnv, signal?: AbortSignal, timeout = 15_000): Promise<string> {
  await mkdir(join(config.profileDir, 'tmp'), { recursive: true });
  const child = start(config, args, env, config.profileDir);
  return new Promise((resolveOutput, reject) => {
    let text = "";
    const abort = () => { void killTree(child); };
    const timer = setTimeout(abort, timeout);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout!.setEncoding("utf8");
    child.stdout!.on("data", chunk => { if (text.length < 100_000) text += chunk.toString(); });
    child.stderr!.resume(); child.stdin!.on("error", () => {}); child.stdin!.end();
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); };
    child.once("error", () => { cleanup(); reject(Error("No se pudo ejecutar Claude Code en la ruta configurada.")); });
    child.once("close", () => { cleanup(); resolveOutput(text); });
  });
}

export class ClaudeCliHarness implements Harness {
  readonly id = "claude" as const;
  readonly codeGraphTools = true;
  private readonly config: ClaudeCliConfig;
  private cumulativeUsage: boolean | undefined;
  constructor(config: ClaudeCliConfig) { this.config = config; }
  async probe(env: HostEnv, signal: AbortSignal): Promise<HarnessInfo> {
    const base = { id: this.id, label: "Claude Code", models: [] };
    try {
      const version = await output(this.config, ["--version"], env, signal);
      if (!/\d+\.\d+\.\d+.*Claude Code/i.test(version)) return { ...base, status: "error", detail: "El ejecutable configurado no se identifica como Claude Code. Revisá el path; no se ejecutó un turno." };
      this.cumulativeUsage = claudeCumulativeUsage(version);
      const status = JSON.parse(await output(this.config, ["auth", "status"], env, signal));
      if (status.loggedIn !== true) return { ...base, status: "signed-out", authMethods: [{ id: "cli-login", label: "Login oficial de Claude Code" }], detail: "Conectá Claude Code en el perfil propio de Syka." };
      return { ...base, status: "ready", authMethods: [{ id: "cli-login", label: "Login oficial de Claude Code" }], version: version.trim(), models: [{ id: "__cli_default__", label: "Predeterminado de Claude Code" }], defaultModel: "__cli_default__", detail: "Modelo elegido por tu CLI. No se inventa un catálogo ni se acredita cuota por estar conectado." };
    } catch { return { ...base, status: "error", detail: "No se pudo verificar ejecutable y sesión de Claude Code. Revisá ruta, versión y perfil." }; }
  }
  async authenticate(env: HostEnv, methodId: string, signal: AbortSignal, hooks?: import('./harness').AuthHooks) {
    if (methodId !== "cli-login") throw Error("Método no soportado");
    const probe = await this.probe(env, signal);
    if (probe.status !== "signed-out" && probe.status !== "ready") throw Error("Verificá el ejecutable de Claude antes de conectar la cuenta.");
    await runCliLogin({ provider: 'claude', command: this.config.command, args: [...(this.config.args ?? []), 'auth', 'login'], cwd: this.config.profileDir, env: claudeEnvironment(this.config, env), signal, hooks, verify: async () => (await this.probe(env, signal)).status === 'ready' });
    if ((await this.probe(env, signal)).status !== "ready") throw Error("El login de Claude Code no se completó.");
    await advanceProfileScope(this.config.profileDir);
  }
  async open(options: OpenOptions): Promise<HarnessSession> {
    const profile = await profileScope(this.config.profileDir);
    if (options.resume && (!("claude" in options.resume) || options.resume.claude.profile !== profile)) throw Error("El chat pertenece a otro perfil o es histórico. Se conserva; creá uno nuevo para este login.");
    const cumulativeUsage = this.cumulativeUsage ??= claudeCumulativeUsage(await output(this.config, ['--version'], options.env));
    return new ClaudeCliSession(this.config, options, profile, cumulativeUsage);
  }
}

class ClaudeCliSession implements HarnessSession {
  readonly resume: ResumeCursor;
  private readonly config: ClaudeCliConfig;
  private readonly options: OpenOptions;
  private sessionId: string;
  private hasSession: boolean;
  private child: ChildProcess | null = null;
  private active: Promise<TurnOutcome> | null = null;
  private cancelled = false;
  private closed = false;
  private emit: Emit;
  private box: QuestionBox;
  private readonly cumulativeUsage: boolean;
  constructor(config: ClaudeCliConfig, options: OpenOptions, profile: string, cumulativeUsage: boolean) {
    this.cumulativeUsage = cumulativeUsage;
    this.config = config; this.options = options; this.emit = options.emit;
    this.sessionId = options.resume && "claude" in options.resume ? options.resume.claude.sessionId : randomUUID();
    this.hasSession = !!options.resume;
    this.resume = { claude: { sessionId: this.sessionId, profile } };
    this.box = new QuestionBox(e => this.emit(e));
  }
  send(text: string, model: string, emit: Emit, effort?: string, fast?: boolean): Promise<TurnOutcome> {
    if (this.closed || this.active) return Promise.resolve({ status: "failed", error: "Sesión cerrada u ocupada." });
    if (model !== "__cli_default__" || effort || fast) return Promise.resolve({ status: "failed", error: "Opción no anunciada por el CLI." });
    this.emit = emit; this.cancelled = false;
    this.active = this.run(text).finally(() => { this.active = null; });
    return this.active;
  }
  private async run(text: string): Promise<TurnOutcome> {
    const bridge = await startEditorToolBridge(this.options, async raw => {
      const args = raw as { tool_name?: string; input?: Record<string, unknown> };
      if (this.cancelled) return { behavior: "deny", message: "Turno cancelado." };
      if (args.tool_name === "AskUserQuestion" && Array.isArray(args.input?.questions)) {
        const questions: Question[] = args.input.questions.slice(0, 4).filter(q => typeof q?.question === "string").map(q => ({
          id: q.question, question: q.question, header: typeof q.header === "string" ? q.header : "Pregunta", multiSelect: q.multiSelect === true, allowOther: true, secret: false,
          options: (Array.isArray(q.options) ? q.options : []).filter((o: { label?: unknown }) => typeof o?.label === "string").map((o: { label: string; description?: string }) => ({ label: o.label, description: o.description ?? "" })),
        }));
        if (!questions.length) return { behavior: "deny", message: "Pregunta inválida." };
        const response = await this.box.ask(questions);
        return typeof response === "object" && !this.cancelled ? { behavior: "allow", updatedInput: { ...args.input, answers: Object.fromEntries(Object.entries(response.answers).map(([key, values]) => [key, values.join(", ")])) } }
          : { behavior: "deny", message: "Pregunta cancelada u omitida." };
      }
      const response = await this.box.ask([{ id: "permission", header: "Permiso", question: `Claude solicita usar ${args.tool_name ?? "una herramienta"}: ${JSON.stringify(args.input ?? {}).slice(0, 1500)}`, multiSelect: false, allowOther: false, secret: false,
        options: [{ label: "Permitir una vez", description: "Ejecutar esta acción" }, { label: "Rechazar", description: "No ejecutar" }] }]);
      return typeof response === "object" && response.answers.permission?.[0] === "Permitir una vez" && !this.cancelled
        ? { behavior: "allow", updatedInput: args.input ?? {} } : { behavior: "deny", message: "El usuario no autorizó esta acción." };
    });
    try {
      if (this.cancelled) return { status: "interrupted" };
      const mcpServers: Record<string, unknown> = { syka_workspace: { type: "http", url: bridge.url } };
      if (this.options.mcp) mcpServers.syka = { type: "http", url: this.options.mcp.url };
      const args = ["--print", "--output-format", "stream-json", "--verbose", "--strict-mcp-config", "--mcp-config", JSON.stringify({ mcpServers }),
        "--permission-prompt-tool", "mcp__syka_workspace__permission", this.hasSession ? "--resume" : "--session-id", this.sessionId];
      if (this.options.instructions) args.push("--append-system-prompt", this.options.instructions);
      const child = start(this.config, args, this.options.env, this.options.cwd); this.child = child;
      return await new Promise<TurnOutcome>((resolveResult) => {
        let buffer = ""; let outcome: TurnOutcome | undefined;
        const usage = new ClaudeUsageTracker(this.sessionId, this.cumulativeUsage, report => this.emit({ type: 'usage.reported', usage: report }));
        const timer = setTimeout(() => { void killTree(child); }, 30 * 60_000);
        child.stderr!.resume();
        child.stdout!.setEncoding("utf8");
        child.stdout!.on("data", chunk => {
          buffer += chunk.toString();
          if (buffer.length > 4_000_000) { void killTree(child); return; }
          let index;
          while ((index = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
            try {
              const message = JSON.parse(line);
              usage.observe(message);
              if (typeof message.session_id === 'string' && message.session_id && (message.type === 'result' || message.type === 'system' && message.subtype === 'init')) {
                this.sessionId = message.session_id;
                if ('claude' in this.resume) this.resume.claude.sessionId = this.sessionId;
              }
              if (message.type === "system" && message.subtype === "init") this.hasSession = true;
              if (message.type === "assistant" && !message.parent_tool_use_id) for (const part of message.message?.content ?? []) {
                if (part.type === "text") this.emit({ type: "item.completed", item: { id: newItemId("claude"), kind: "assistant", text: part.text } });
                if (part.type === "tool_use") this.emit({ type: "item.started", item: { id: part.id, kind: "tool", name: part.name, title: part.name, status: "running" } });
              }
              if (message.type === "user") for (const part of message.message?.content ?? []) if (part.type === "tool_result") {
                const parts = typeof part.content === "string" ? [{ type: "text", text: part.content }] : part.content ?? [];
                this.emit({ type: "item.completed", item: { id: part.tool_use_id, kind: "tool", name: "tool", title: "Herramienta", status: part.is_error ? "failed" : "done", ...collectResult(parts) } });
              }
              if (message.type === "result") outcome = message.is_error ? { status: "failed", error: "Claude Code no completó el turno. No se cambió de proveedor." } : { status: "completed" };
            } catch { /* Ignore non-protocol output; never surface raw stderr/credentials. */ }
          }
        });
        child.once("error", () => { clearTimeout(timer); resolveResult({ status: "failed", error: "No se pudo iniciar Claude Code." }); });
        child.once("close", () => { clearTimeout(timer); usage.finish(); resolveResult(this.cancelled ? { status: "interrupted" } : outcome ?? { status: "failed", error: "Claude Code salió sin completar el turno. Revisá login y ejecutable." }); });
        child.stdin!.on("error", () => {}); child.stdin!.end(text);
      });
    } finally { this.child = null; this.box.cancelAll(); await bridge.close(); }
  }
  respond(id: string, response: RequestResponse) { this.box.settle(id, response); }
  async interrupt() { this.cancelled = true; this.box.cancelAll(); if (this.child) await killTree(this.child); await this.active; }
  async close() { this.closed = true; await this.interrupt(); }
}
