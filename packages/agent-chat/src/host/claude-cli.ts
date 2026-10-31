/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isAbsolute, join } from "node:path";
import { acpEnvironment } from "./acp";
import { killTree, type HostEnv } from "./env";
import { QuestionBox, newItemId, collectResult, summarizeInput, type Harness, type HarnessSession, type OpenOptions, type Emit, type ResumeCursor, type TurnOutcome } from "./harness";
import type { HarnessInfo, RequestResponse, Question } from "../protocol";
import { startEditorToolBridge } from "./editor-tool-bridge";
import { profileScope, advanceProfileScope } from "./harness-profile";
import { ClaudeUsageTracker, claudeCumulativeUsage } from './claude-usage';
import { runCliLogin } from './cli-login';
import { harnessTraceFor } from './harness-telemetry';

export type ClaudeCliConfig = { id: "claude"; command: string; args?: string[]; profileDir: string };
export function claudeModels(raw: unknown): HarnessInfo['models'] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap(item => {
    if (!item || typeof item.value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/\[\]-]{0,199}$/.test(item.value)
      || typeof item.displayName !== 'string' || !item.displayName.trim() || seen.has(item.value)) return [];
    seen.add(item.value);
    const label = item.value === 'default' ? `Predeterminado · ${item.resolvedModel || item.displayName}` : item.displayName;
    const efforts: string[] = item.supportsEffort === true && Array.isArray(item.supportedEffortLevels)
      ? [...new Set<string>(item.supportedEffortLevels.filter((level: unknown): level is string => typeof level === 'string' && /^[a-z][a-z0-9_-]{0,31}$/.test(level)))] : [];
    return [{ id: item.value, label, ...(efforts.length ? { efforts } : {}) }];
  });
}

/** Initialize the official CLI control protocol without a user prompt or inference. */
export async function discoverClaudeModels(config: ClaudeCliConfig, env: HostEnv, signal?: AbortSignal): Promise<HarnessInfo['models']> {
  const child = start(config, ['--print', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--settings', '{"disableAllHooks":true}'], env, config.profileDir);
  const requestId = randomUUID();
  return new Promise(resolve => {
    let buffer = '', done = false;
    const finish = (models: HarnessInfo['models'] = []) => {
      if (done) return;
      done = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      void killTree(child).finally(() => resolve(models));
    };
    const abort = () => finish();
    const timer = setTimeout(abort, 30_000);
    signal?.addEventListener('abort', abort, { once: true });
    child.stderr!.resume(); child.stdin!.on('error', abort);
    child.once('error', abort); child.once('close', abort);
    child.stdout!.setEncoding('utf8');
    child.stdout!.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > 1_000_000) return finish();
      let index: number;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        try {
          const message = JSON.parse(line);
          if (message.type === 'control_response' && message.response?.request_id === requestId) finish(claudeModels(message.response?.response?.models));
        } catch { /* Only the matching structured control response is a catalog. */ }
      }
    });
    if (signal?.aborted) return abort();
    child.stdin!.write(JSON.stringify({ type: 'control_request', request_id: requestId, request: { subtype: 'initialize' } }) + '\n');
  });
}
export function claudeEnvironment(config: ClaudeCliConfig, env: HostEnv): Record<string, string> {
  const isolated = acpEnvironment(config.profileDir, env.env);
  // Claude has its own supported config directory. Isolating Windows/browser
  // directories too causes OAuth to open Brave without the user's cookies.
  for (const name of ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) if (env.env[name]) isolated[name] = env.env[name]!;
  return { ...isolated, CLAUDE_CONFIG_DIR: config.profileDir };
}
/** `mcp__syka__gate` reads as `gate`, the way Codex shows MCP calls; native tools keep their name. */
export function claudeToolTitle(name: string): string {
  return /^mcp__[^_]+(?:_[^_]+)*__(.+)$/.exec(name)?.[1] ?? name;
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
  private models: HarnessInfo['models'] = [];
  private readonly contextWindows = new Map<string,number>();
  constructor(config: ClaudeCliConfig) { this.config = config; }
  private async refreshModels(env: HostEnv, signal?: AbortSignal) {
    const discovered = await discoverClaudeModels(this.config,env,signal);
    // A slow/aborted metadata request must not erase the last native catalog.
    if(discovered.length)this.models=discovered;
    return this.models;
  }
  async probe(env: HostEnv, signal: AbortSignal): Promise<HarnessInfo> {
    const base = { id: this.id, label: "Claude Code", models: [] };
    try {
      const version = await output(this.config, ["--version"], env, signal);
      if (!/\d+\.\d+\.\d+.*Claude Code/i.test(version)) return { ...base, status: "error", detail: "El ejecutable configurado no se identifica como Claude Code. Revisá el path; no se ejecutó un turno." };
      this.cumulativeUsage = claudeCumulativeUsage(version);
      const status = JSON.parse(await output(this.config, ["auth", "status"], env, signal));
      if (status.loggedIn !== true) { this.models=[];this.contextWindows.clear();return { ...base, status: "signed-out", authMethods: [{ id: "cli-login", label: "Login oficial de Claude Code" }], detail: "Conectá Claude Code en el perfil propio de Syka." }; }
      await this.refreshModels(env, signal);
      return { ...base, status: "ready", authMethods: [{ id: "cli-login", label: "Login oficial de Claude Code" }], version: version.trim(),
        models: this.models.length ? this.models : [{ id: "__cli_default__", label: "Predeterminado de Claude Code" }],
        defaultModel: this.models.find(model => model.id === 'default')?.id ?? this.models[0]?.id ?? '__cli_default__',
        detail: this.models.length ? 'Modelos anunciados por Claude Code. La disponibilidad depende de tu cuenta.' : 'Sesión conectada. Claude Code no devolvió su catálogo; volvé a comprobar la conexión para actualizarlo.' };
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
    return new ClaudeCliSession(this.config, options, profile, cumulativeUsage, ()=>this.models, signal=>this.refreshModels(options.env,signal), this.contextWindows);
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
  private readonly models: ()=>HarnessInfo['models'];
  private readonly refreshModels: (signal:AbortSignal)=>Promise<HarnessInfo['models']>;
  private readonly contextWindows: Map<string,number>;
  private catalogAbort?: AbortController;
  private readonly contextScope: string;
  constructor(config: ClaudeCliConfig, options: OpenOptions, profile: string, cumulativeUsage: boolean, models: ()=>HarnessInfo['models'], refreshModels:(signal:AbortSignal)=>Promise<HarnessInfo['models']>, contextWindows:Map<string,number>) {
    this.models = models;this.refreshModels=refreshModels;this.contextWindows=contextWindows;
    this.contextScope=profile;
    this.cumulativeUsage = cumulativeUsage;
    this.config = config; this.options = options; this.emit = options.emit;
    this.sessionId = options.resume && "claude" in options.resume ? options.resume.claude.sessionId : randomUUID();
    this.hasSession = !!options.resume;
    this.resume = { claude: { sessionId: this.sessionId, profile } };
    this.box = new QuestionBox(e => this.emit(e));
  }
  send(text: string, model: string, emit: Emit, effort?: string, fast?: boolean): Promise<TurnOutcome> {
    if (this.closed || this.active) return Promise.resolve({ status: "failed", error: "Sesión cerrada u ocupada." });
    this.emit = emit; this.cancelled = false;
    this.catalogAbort=new AbortController();
    this.active = this.validateAndRun(text,model,effort,fast).finally(() => { this.active = null;this.catalogAbort=undefined; });
    return this.active;
  }
  private async validateAndRun(text:string,model:string,effort?:string,fast?:boolean):Promise<TurnOutcome> {
    if(fast)return {status:'failed',error:'Claude Code no tiene modo rápido habilitado por esta integración.'};
    const supported=()=>{const selected=this.models().find(item=>item.id===model);return (model==='__cli_default__'||!!selected)&&(effort===undefined||!!selected?.efforts?.includes(effort));};
    if(!supported())await this.refreshModels(this.catalogAbort!.signal);
    if(this.cancelled||this.closed)return {status:'interrupted'};
    const selected=this.models().find(item=>item.id===model);
    if(model!=='__cli_default__'&&!selected)return {status:'failed',error:`Claude Code no confirmó el modelo «${model}» al actualizar su catálogo. Volvé a comprobar la conexión; no se cambió de modelo.`};
    if(effort!==undefined&&!selected?.efforts?.includes(effort))return {status:'failed',error:`Claude Code no anunció el esfuerzo «${effort}» para «${model}». Elegí uno de los esfuerzos disponibles; no se redujo automáticamente.`};
    return this.run(text,model,effort);
  }
  private async run(text: string, model: string, effort?: string): Promise<TurnOutcome> {
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
      // Syka runs trusted local agents with full access, as its Codex adapter does.
      // Keep AskUserQuestion interactive; it is not a tool permission request.
      return { behavior: "allow", updatedInput: args.input ?? {} };
    });
    try {
      if (this.cancelled) return { status: "interrupted" };
      const mcpServers: Record<string, unknown> = { syka_workspace: { type: "http", url: bridge.url } };
      if (this.options.mcp) mcpServers.syka = { type: "http", url: this.options.mcp.url };
      const args = ["--print", "--output-format", "stream-json", "--verbose", "--strict-mcp-config", "--mcp-config", JSON.stringify({ mcpServers }),
        "--dangerously-skip-permissions", "--permission-prompt-tool", "mcp__syka_workspace__permission", this.hasSession ? "--resume" : "--session-id", this.sessionId];
      if (this.options.instructions) args.push("--append-system-prompt", this.options.instructions);
      if (model !== '__cli_default__') args.push('--model', model);
      if (effort !== undefined) args.push('--effort', effort);
      const trace = harnessTraceFor(this.options);
      if (this.options.instructions) trace?.payload('claude_cli', 'instructions', this.options.instructions);
      trace?.payload('claude_cli', 'user', text);
      trace?.payload('claude_cli', 'wire_request', {args,input:text});
      trace?.instructions('per_invocation_unverified_persistence');
      const child = start(this.config, args, this.options.env, this.options.cwd); this.child = child;
      return await new Promise<TurnOutcome>((resolveResult) => {
        let buffer = "", timedOut=false, oversized=false; let outcome: TurnOutcome | undefined;
        const tools = new Map<string, { name: string; title: string; detail?: string }>();
        const usage = new ClaudeUsageTracker(this.sessionId, this.cumulativeUsage, report => this.emit({ type: 'usage.reported', usage: report }), {windows:this.contextWindows,scope:JSON.stringify([this.contextScope,model]),emit:context=>this.emit({type:'context.updated',usage:context})});
        const timer = setTimeout(() => { timedOut=true;void killTree(child); }, 30 * 60_000);
        child.stderr!.resume();
        child.stdout!.setEncoding("utf8");
        child.stdout!.on("data", chunk => {
          buffer += chunk.toString();
          if (buffer.length > 4_000_000) { oversized=true;void killTree(child); return; }
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
                if (part.type === "tool_use") {
                  trace?.nativeTool(part.id, part.name, 'claude_cli', 'running', undefined, part.input);
                  const started = { name: String(part.name), title: claudeToolTitle(String(part.name)), detail: summarizeInput(part.input) };
                  tools.set(part.id, started);
                  this.emit({ type: "item.started", item: { id: part.id, kind: "tool", ...started, status: "running" } });
                }
              }
              if (message.type === "user") for (const part of message.message?.content ?? []) if (part.type === "tool_result") {
                const parts = typeof part.content === "string" ? [{ type: "text", text: part.content }] : part.content ?? [];
                trace?.nativeTool(part.tool_use_id, 'native_tool', 'claude_cli', part.is_error ? 'failed' : 'done', {content:parts});
                if (part.is_error) trace?.error('Native tool failed');
                // The result names no tool; its call did.
                const started = tools.get(part.tool_use_id) ?? { name: "tool", title: "Herramienta" };
                tools.delete(part.tool_use_id);
                this.emit({ type: "item.completed", item: { id: part.tool_use_id, kind: "tool", ...started, status: part.is_error ? "failed" : "done", ...collectResult(parts) } });
              }
              if (message.type === "result") {
                if(message.is_error)trace?.error(typeof message.result==='string'?message.result:'Claude Code did not complete the turn');
                outcome = message.is_error ? { status: "failed", error: "Claude Code no completó el turno. No se cambió de proveedor." } : { status: "completed" };
              }
            } catch { /* Ignore non-protocol output; never surface raw stderr/credentials. */ }
          }
        });
        child.once("error", () => { clearTimeout(timer); resolveResult({ status: "failed", error: "No se pudo iniciar Claude Code." }); });
        child.once("close", (exitCode) => {
          clearTimeout(timer);usage.finish();
          const final:TurnOutcome=this.cancelled?{status:'interrupted'}:timedOut?{status:'failed',error:'Claude Code superó el tiempo de espera. No se reintentó automáticamente.'}:oversized?{status:'failed',error:'Claude Code excedió el límite de salida; no se confirmó el resultado.'}:typeof exitCode==='number'&&exitCode!==0?{status:'failed',error:'Claude Code terminó con un error de ejecución. No se confirmó el resultado.'}:outcome??{status:'failed',error:'Claude Code salió sin completar el turno. Revisá login y ejecutable.'};
          if(final.error)trace?.error(final.error);
          resolveResult(final);
        });
        child.stdin!.on("error", () => {}); child.stdin!.end(text);
      });
    } finally { this.child = null; this.box.cancelAll(); await bridge.close(); }
  }
  respond(id: string, response: RequestResponse) { this.box.settle(id, response); }
  async interrupt() { this.cancelled = true;this.catalogAbort?.abort(); this.box.cancelAll(); if (this.child) await killTree(this.child); await this.active; }
  async close() { this.closed = true; await this.interrupt(); }
}
