/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { spawn } from "node:child_process";
import { tokenCounts } from './token-usage';
import { mkdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { HARNESS_LABELS, type HarnessId, type HarnessInfo, type Item, type RequestResponse } from "../protocol";
import { killTree, type HostEnv } from "./env";
import { JsonRpcPeer, RpcError } from "./jsonrpc";
import { startEditorToolBridge } from "./editor-tool-bridge";
import { profileScope, advanceProfileScope } from "./harness-profile";
import { acpMcpServers } from "./acp-mcp";
import { installedOpenCodeEnvironment } from './opencode';
import { newItemId, QuestionBox, truncateDetail, type Emit, type Harness, type HarnessSession, type OpenOptions, type ResumeCursor, type TurnOutcome } from "./harness";

export type AcpHarnessConfig = {
  id: Exclude<HarnessId, "codex" | "claude">;
  /** Absolute executable; use node + absolute JS entry point instead of a cmd shim. */
  command: string;
  args?: string[];
  /** Dedicated login/config/history profile. Never copy credentials into it. */
  profileDir: string;
  openCodeAccount?: 'installed' | 'syka';
  openCodeConfigDir?: string;
  /** Explicitly discovered existing account. Paths only; never copied tokens. */
  installedSession?: { userHome: string; appData?: string; localAppData?: string; hermesHome?: string };
};
type ObjectValue = Record<string, any>;
const object = (v: unknown): ObjectValue => v && typeof v === "object" && !Array.isArray(v) ? v as ObjectValue : {};
const text = (v: unknown): string => typeof v === "string" ? v : "";

/** No inherited provider keys, personal MCP config or app-server credentials. */
export function acpEnvironment(profile: string, source: Record<string, string>, installed?: AcpHarnessConfig['installedSession']): Record<string, string> {
  const env: Record<string, string> = {};
  const allowed = new Set(["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "PROGRAMFILES", "PROGRAMFILES(X86)", "LANG", "LC_ALL"]);
  for (const [key, value] of Object.entries(source)) if (allowed.has(key.toUpperCase())) env[key.toUpperCase()] = value;
  const isolated = { ...env, HOME: profile, USERPROFILE: profile, APPDATA: join(profile, "AppData", "Roaming"), LOCALAPPDATA: join(profile, "AppData", "Local"),
    TEMP: join(profile, "tmp"), TMP: join(profile, "tmp"), TMPDIR: join(profile, "tmp"), XDG_CONFIG_HOME: join(profile, "config"), XDG_CACHE_HOME: join(profile, "cache"),
    HERMES_HOME: join(profile, "hermes"), HERMES_ACP_SKIP_CONFIGURED_MCP: "1", SETTINGS_DIR: join(profile, "settings"), NO_COLOR: "1" };
  if (!installed) return isolated;
  if (!isAbsolute(installed.userHome) || installed.hermesHome && !isAbsolute(installed.hermesHome)) throw Error('Perfil instalado inválido.');
  const reused = { ...isolated, HOME: installed.userHome, USERPROFILE: installed.userHome,
    XDG_CONFIG_HOME: join(installed.userHome, '.config'), XDG_CACHE_HOME: join(installed.userHome, '.cache'),
    ...(installed.appData ? { APPDATA: installed.appData } : {}), ...(installed.localAppData ? { LOCALAPPDATA: installed.localAppData } : {}),
    ...(installed.hermesHome ? { HERMES_HOME: installed.hermesHome } : {}) };
  // Installed agents own their existing preferences/authentication directories.
  // Keep Syka temp/session identity and the configured-MCP exclusion separate.
  delete (reused as Record<string, string>).SETTINGS_DIR;
  return reused;
}

class AcpProcess {
  readonly peer: JsonRpcPeer;
  private readonly child;
  private closed = false;
  private exited = false;
  get isClosed() { return this.closed || this.exited; }
  onDispose: () => void = () => {};
  constructor(config: AcpHarnessConfig, env: HostEnv, cwd: string) {
    if (!isAbsolute(config.command) || !isAbsolute(config.profileDir) || /\.(cmd|bat)$/i.test(config.command)) throw Error("Configurá un ejecutable absoluto; para Node usá node.exe y el entrypoint JS, sin shell.");
    const childEnv = config.id === 'opencode' ? { ...installedOpenCodeEnvironment(config.profileDir, env.env, config.openCodeAccount), ...(config.openCodeConfigDir ? { OPENCODE_CONFIG_DIR: config.openCodeConfigDir } : {}) } : acpEnvironment(config.profileDir, env.env, config.installedSession);
    this.child = spawn(config.command, config.args ?? [], { cwd, env: childEnv, windowsHide: true, stdio: "pipe", shell: false });
    this.peer = new JsonRpcPeer(this.child);
    this.peer.onClose = () => { this.exited = true; };
    this.child.stdin.on("error", () => { void this.close(); });
  }
  async request<T = ObjectValue>(method: string, params: unknown, timeout = 30_000): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([this.peer.request<T>(method, params), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { void this.close(); reject(Error(`ACP: tiempo agotado en ${method}.`)); }, timeout);
      })]);
    } finally { clearTimeout(timer); }
  }
  async close(): Promise<void> { if (!this.closed) { this.closed = true; this.onDispose(); await killTree(this.child); } }
}

async function connect(config: AcpHarnessConfig, env: HostEnv, cwd: string, signal?: AbortSignal) {
  if (signal?.aborted) throw Error("ACP cancelado");
  await Promise.all([config.profileDir, join(config.profileDir, "tmp")].map(path => mkdir(path, { recursive: true })));
  const process = new AcpProcess(config, env, cwd);
  const abort = () => { void process.close(); };
  signal?.addEventListener("abort", abort, { once: true });
  process.onDispose = () => signal?.removeEventListener("abort", abort);
  if (signal?.aborted) { await process.close(); throw Error("ACP cancelado"); }
  try {
    const initialized = await process.request("initialize", { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: "syka-clips", version: "0.1.0" } });
    if (initialized.protocolVersion !== 1) throw Error("Versión ACP no compatible; se requiere v1.");
    const expected = { antigravity: /antigravity/i, hermes: /hermes/i, cursor: /cursor/i, grok: /grok/i, muse: /muse/i, opencode: /opencode/i }[config.id];
    if (!expected.test(text(initialized.agentInfo?.name))) throw Error("El ejecutable ACP no se identifica como el proveedor configurado.");
    return { process, initialized };
  } catch (error) { await process.close(); throw error; }
}

function modelsOf(session: ObjectValue): HarnessInfo["models"] {
  const legacy = object(session.models).availableModels;
  if (Array.isArray(legacy)) return legacy.filter(m => typeof m?.modelId === "string").map(m => ({ id: m.modelId, label: text(m.name) || m.modelId }));
  const config = Array.isArray(session.configOptions) ? session.configOptions.find(c => c?.category === "model") : undefined;
  const options: ObjectValue[] = (Array.isArray(config?.options) ? config.options : []).flatMap((o: ObjectValue) => Array.isArray(o.options) ? o.options : [o]);
  return options.filter(o => typeof o.value === "string").map(o => ({ id: o.value, label: text(o.name) || o.value }));
}
function loginMethods(init: ObjectValue): NonNullable<HarnessInfo["authMethods"]> {
  // Terminal-based authentication requires a terminal UI; do not pretend to support it.
  return (Array.isArray(init.authMethods) ? init.authMethods : []).filter(m => typeof m?.id === "string" && m.type !== "terminal" && !m._meta?.['terminal-auth'] && !/terminal/i.test(text(m.description)) && !/api[-_]?key|agent-platform/i.test(m.id) && !m._meta?.['api-key'])
    .map(m => ({ id: m.id, label: text(m.name) || m.id }));
}
function authError(error: unknown): boolean { return error instanceof RpcError && error.code === -32000 || /auth|sign.in|login|credential/i.test(String(error)); }

export class AcpHarness implements Harness {
  readonly codeGraphTools = true;
  readonly id: AcpHarnessConfig["id"];
  private readonly config: AcpHarnessConfig;
  constructor(config: AcpHarnessConfig) { this.config = config; this.id = config.id; }
  async probe(env: HostEnv, signal: AbortSignal): Promise<HarnessInfo> {
    const base = { id: this.id, label: HARNESS_LABELS[this.id], models: [], supportsSteering: this.id === "hermes" };
    let process: AcpProcess | undefined;
    let authMethods: HarnessInfo["authMethods"];
    const abort = () => { void process?.close(); };
    signal.addEventListener("abort", abort, { once: true });
    try {
      if (signal.aborted) throw Error("Probe cancelado");
      const connection = await connect(this.config, env, this.config.profileDir, signal);
      process = connection.process;
      if (signal.aborted) throw Error("Probe cancelado");
      authMethods = loginMethods(connection.initialized);
      const session = await process.request("session/new", { cwd: resolve(this.config.profileDir), mcpServers: [] });
      const models = modelsOf(session);
      return { ...base, authMethods, version: text(connection.initialized.agentInfo?.version), models, defaultModel: text(session.models?.currentModelId) || models[0]?.id,
        status: models.length ? "ready" : "error", detail: models.length ? "Catálogo declarado por el agente; turno real y cuota aún no comprobados." : "El agente no devolvió un catálogo de modelos. No se inventaron opciones." };
    } catch (error) {
      return { ...base, authMethods, status: authError(error) ? "signed-out" : "error", detail: authError(error) ? (authMethods?.length ? "Conectá la cuenta en el perfil de Syka mediante el login oficial." : `Configurá el login oficial del agente en el perfil ${this.config.profileDir}; esta ruta requiere su terminal.`) : "No se pudo negociar ACP o descubrir modelos. Revisá ejecutable, versión y perfil configurados." };
    } finally { signal.removeEventListener("abort", abort); await process?.close(); }
  }
  async authenticate(env: HostEnv, methodId: string, signal: AbortSignal): Promise<void> {
    const { process, initialized } = await connect(this.config, env, this.config.profileDir, signal);
    const abort = () => { void process.close(); };
    signal.addEventListener("abort", abort, { once: true });
    try {
      if (signal.aborted) throw Error("Login cancelado");
      if (!loginMethods(initialized).some(m => m.id === methodId)) throw Error("Método de login no anunciado por este agente.");
      await process.request("authenticate", { methodId }, 180_000);
      await advanceProfileScope(this.config.profileDir);
    } finally { signal.removeEventListener("abort", abort); await process.close(); }
  }
  async open(options: OpenOptions): Promise<HarnessSession> {
    const { process, initialized } = await connect(this.config, options.env, options.cwd);
    const capabilities = object(initialized.agentCapabilities);
    let bridge: Awaited<ReturnType<typeof startEditorToolBridge>> | undefined;
    try {
      bridge = await startEditorToolBridge(options);
      const mcpServers = await acpMcpServers([...(options.mcp ? [options.mcp] : []), { name: "syka_workspace", url: bridge.url }], object(capabilities.mcpCapabilities).http === true, this.config.profileDir);
      const profile = await profileScope(this.config.profileDir);
      const resume = options.resume && "acp" in options.resume ? options.resume.acp : undefined;
      if (options.resume && (!resume || resume.harness !== this.id || resume.profile !== profile || resume.version !== 1)) throw Error("La sesión pertenece a otro arnés o perfil. Abrí un chat nuevo; no se migró el historial.");
      if (resume && capabilities.loadSession !== true) throw Error("Este agente no anuncia retoma. La conversación guardada se conserva.");
      const session = new AcpSession(process, this.id, profile, options.emit, options.instructions, bridge.close);
      const response = await process.request(resume ? "session/load" : "session/new", { cwd: options.cwd, mcpServers, ...(resume ? { sessionId: resume.sessionId } : {}) });
      session.initialize(resume?.sessionId ?? text(response.sessionId), response);
      return session;
    } catch (error) { await process.close(); await bridge?.close(); throw error; }
  }
}

class AcpSession implements HarnessSession {
  get isClosed() { return this.closed || this.process.isClosed; }
  resume!: ResumeCursor;
  private sessionId = "";
  private metadata: ObjectValue = {};
  private emit: Emit;
  private box: QuestionBox;
  private active: Promise<TurnOutcome> | null = null;
  private promptActive = false;
  private steeringAck: string | null = null;
  steer?: (text: string) => Promise<void>;
  private cancelled = false;
  private started = false;
  private closed = false;
  private chunks = new Map<string, Item>();
  private receivedOutput = false;
  private process: AcpProcess;
  private harness: HarnessId;
  private profile: string;
  private instructions?: string;
  private closeBridge: () => Promise<void>;
  constructor(process: AcpProcess, harness: HarnessId, profile: string, emit: Emit, instructions: string | undefined, closeBridge: () => Promise<void>) {
    this.process = process; this.harness = harness; this.profile = profile; this.instructions = instructions;
    if (harness === "hermes") this.steer = async guidance => {
      if (!this.active || !this.promptActive || this.cancelled || this.isClosed) throw Error("Hermes todavía no admite instrucciones en este turno.");
      this.steeringAck = "";
      try {
        await this.process.request("session/prompt", { sessionId: this.sessionId, prompt: [{ type: "text", text: `/steer ${guidance}` }] }, 30_000);
        if (!this.steeringAck.startsWith("⏩ Steer queued for the active turn:")) throw Error(this.steeringAck || "Hermes no confirmó la inserción en el turno activo.");
      } finally { this.steeringAck = null; }
    };
    this.closeBridge = closeBridge;
    this.emit = emit; this.box = new QuestionBox(e => this.emit(e));
    process.peer.onNotification = (method, params) => this.notification(method, object(params));
    process.peer.onRequest = (method, params) => this.request(method, object(params));
  }
  initialize(id: string, metadata: ObjectValue) {
    if (!id) throw Error("ACP no devolvió sessionId");
    this.sessionId = id; this.metadata = metadata;
    this.resume = { acp: { version: 1, harness: this.harness, profile: this.profile, sessionId: id } };
  }
  send(input: string, model: string, emit: Emit, effort?: string, fast?: boolean): Promise<TurnOutcome> {
    if (this.active || this.isClosed) return Promise.resolve({ status: "failed", error: "Sesión ocupada o cerrada." });
    if (effort || fast) return Promise.resolve({ status: "failed", error: "Esfuerzo/fast no están negociados para esta ruta ACP." });
    this.emit = emit; this.cancelled = false; this.chunks.clear(); this.receivedOutput = false;
    this.active = this.run(input, model).finally(() => { this.active = null; });
    return this.active;
  }
  private async run(input: string, model: string): Promise<TurnOutcome> {
    try {
      if (!modelsOf(this.metadata).some(m => m.id === model)) throw Error("El modelo no está en el catálogo de esta sesión. Actualizá el selector.");
      const config = Array.isArray(this.metadata.configOptions) ? this.metadata.configOptions.find(c => c?.category === "model") : undefined;
      if (config) await this.process.request("session/set_config_option", { sessionId: this.sessionId, configId: config.id, value: model });
      else if (this.metadata.models?.currentModelId !== model) await this.process.request("session/set_model", { sessionId: this.sessionId, modelId: model });
      if (this.cancelled) return { status: "interrupted" };
      const prompt = !this.started && this.instructions ? `${this.instructions}\n\nUser request:\n${input}` : input;
      this.started = true;
      this.promptActive = true;
      const result = await this.process.request("session/prompt", { sessionId: this.sessionId, prompt: [{ type: "text", text: prompt }] }, 30 * 60_000);
      let tokens = tokenCounts(result.usage, 'acp');
      // Older Gemini ACP releases expose exact input/output under _meta.quota.
      if (!tokens) {
        const quota = object(object(result._meta).quota).token_count as { input_tokens?: number; output_tokens?: number } | undefined;
        if (Number.isSafeInteger(quota?.input_tokens) && Number.isSafeInteger(quota?.output_tokens) && quota!.input_tokens! >= 0 && quota!.output_tokens! >= 0) tokens = tokenCounts({ input_tokens: quota!.input_tokens, output_tokens: quota!.output_tokens, total_tokens: quota!.input_tokens! + quota!.output_tokens! }, 'agy');
      }
      if (tokens) this.emit({ type: 'usage.reported', usage: { sessionId: this.sessionId, kind: 'turn', measurementId: newItemId('acp-usage'), tokens, model } });
      const status = this.cancelled || result.stopReason === "cancelled" ? "interrupted" : result.stopReason === "end_turn" ? "completed" : "failed";
      if (status === 'completed' && !this.receivedOutput) return { status: 'failed', error: 'El agente terminó sin devolver texto ni herramientas. Revisá acceso al modelo, versión del CLI y conexión.' };
      return { status, ...(status === "failed" ? { error: "El agente terminó sin completar el turno." } : {}) };
    } catch (error) {
      return { status: this.cancelled ? "interrupted" : "failed", ...(!this.cancelled ? { error: authError(error) ? "La cuenta requiere reconexión o no tiene acceso. No se cambió de proveedor." : "El turno ACP falló; revisá conexión, modelo y configuración. No se cambió de proveedor." } : {}) };
    } finally {
      this.promptActive = false;
      this.box.cancelAll();
      for (const item of this.chunks.values()) this.emit({ type: "item.completed", item });
      this.chunks.clear();
    }
  }
  private notification(method: string, params: ObjectValue) {
    if (method !== "session/update" || !this.active || params.sessionId !== this.sessionId) return;
    const update = object(params.update);
    if ((update.sessionUpdate === 'agent_message_chunk' && text(update.content?.text).trim()) || update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') this.receivedOutput = true;
    if (update.sessionUpdate === "config_option_update") { this.metadata.configOptions = update.configOptions; return; }
    if (update.sessionUpdate === "agent_message_chunk" || update.sessionUpdate === "agent_thought_chunk") {
      const delta = text(update.content?.text); if (!delta) return;
      if (this.steeringAck !== null && update.sessionUpdate === "agent_message_chunk" && /^(?:⏩ Steer queued for the active turn:|⚠️ Steer failed:|No active turn — queued for the next turn\.)/.test(delta)) {
        this.steeringAck = delta; return;
      }
      const kind: "assistant" | "reasoning" = update.sessionUpdate === "agent_message_chunk" ? "assistant" : "reasoning";
      const item: Item = this.chunks.get(kind) ?? { id: newItemId("acp"), kind, text: "" };
      if (!this.chunks.has(kind)) { this.chunks.set(kind, item); this.emit({ type: "item.started", item: { ...item } }); }
      if (item.kind === "assistant" || item.kind === "reasoning") { item.text += delta; this.emit({ type: "item.delta", itemId: item.id, text: delta }); }
    }
    if (update.sessionUpdate === "tool_call" || update.sessionUpdate === "tool_call_update") {
      const id = text(update.toolCallId); if (!id) return;
      const key = `tool:${id}`; const previous = this.chunks.get(key);
      const item: Item = { id: previous?.id ?? newItemId("acp-tool"), kind: "tool", name: text(update.kind) || "tool", title: text(update.title) || (previous?.kind === "tool" ? previous.title : "Herramienta"),
        status: update.status === "completed" ? "done" : update.status === "failed" ? "failed" : "running",
        output: truncateDetail((Array.isArray(update.content) ? update.content : []).map(c => text(c.content?.text)).filter(Boolean).join("\n")) };
      this.chunks.set(key, item); this.emit({ type: previous ? "item.completed" : "item.started", item });
    }
  }
  private async request(method: string, params: ObjectValue): Promise<unknown> {
    if (method !== "session/request_permission") throw new RpcError({ code: -32601, message: "Client capability not advertised" });
    if (!this.active || this.cancelled || params.sessionId !== this.sessionId) return { outcome: { outcome: "cancelled" } };
    const options = (Array.isArray(params.options) ? params.options : []).filter(o => typeof o?.optionId === "string" && typeof o?.name === "string");
    if (!options.length) return { outcome: { outcome: "cancelled" } };
    const answer = await this.box.ask([{ id: "permission", header: "Permiso", question: text(params.toolCall?.title) || "El agente solicita permiso", multiSelect: false, allowOther: false, secret: false,
      options: options.map(o => ({ label: o.optionId, description: o.name })) }]);
    const selected = typeof answer === "object" ? answer.answers.permission?.[0] : undefined;
    return selected && options.some(o => o.optionId === selected) ? { outcome: { outcome: "selected", optionId: selected } } : { outcome: { outcome: "cancelled" } };
  }
  respond(id: string, response: RequestResponse) { this.box.settle(id, response); }
  async interrupt() {
    this.cancelled = true; this.box.cancelAll();
    if (!this.active) return;
    this.process.peer.notify("session/cancel", { sessionId: this.sessionId });
    const timer = setTimeout(() => { this.closed = true; void this.process.close(); }, 3000);
    try { await this.active; } finally { clearTimeout(timer); }
  }
  async close() { this.closed = true; this.cancelled = true; this.box.cancelAll(); await this.process.close(); await this.closeBridge(); }
}
