/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// Pi (`pi --mode rpc`, @earendil-works/pi-coding-agent), after Syka Code's
// `core/engines/acp/pi.ts`: not ACP but its own JSON lines. Commands carry an
// `id` and a `type` (`get_state`, `get_available_models`, `set_model`,
// `set_thinking_level`, `prompt`, `abort`) and come back as
// `{ type: "response", id, success, data }`; the turn's events come on the same
// line: `message_update` with text and thinking deltas, `tool_execution_start`
// and `_end`, `message_end` with the stop reason, and `agent_settled` at the end.
//
// One process per chat. Pi keeps its session in a file (`sessionFile` from
// `get_state`) and resumes with `--session`. Pi's own login (`/login` in its
// terminal) gives it models; the keys saved in Settings › Proveedores reach it
// through the variables Pi reads itself, in memory only.

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { HARNESS_LABELS, type HarnessInfo } from "../protocol";
import { newItemId, summarizeInput, truncateDetail, type Emit, type Harness, type HarnessSession, type OpenOptions, type ResumeCursor, type TurnOutcome } from "./harness";
import { which, type HostEnv } from "./env";
import { activeProviders } from "./providers";

const START_TIMEOUT_MS = 120_000;
const PROBE_TIMEOUT_MS = 30_000;
const INSTALL_HINT = "Instalá Pi con «npm install -g @earendil-works/pi-coding-agent».";
const LOGIN_HINT = "Pi no tiene ningún proveedor conectado: abrí «pi» en una terminal e iniciá sesión con /login, o agregá una clave en Configuración › Proveedores.";

type Frame = Record<string, unknown>;
const str = (frame: unknown, key: string) => { const value = (frame as Frame | null)?.[key]; return typeof value === "string" ? value : null; };
const rec = (frame: unknown, key: string) => { const value = (frame as Frame | null)?.[key]; return value && typeof value === "object" && !Array.isArray(value) ? value as Frame : null; };
const list = (frame: unknown, key: string) => { const value = (frame as Frame | null)?.[key]; return Array.isArray(value) ? value : []; };

/** How Pi is started: its npm shim on Windows runs as `node cli.js`, without a shell. */
export function piCommand(env: HostEnv): { command: string; args: string[] } | null {
  const home = env.env.USERPROFILE ?? env.env.HOME ?? homedir();
  const npm = join(env.env.APPDATA ?? join(home, "AppData", "Roaming"), "npm");
  const found = env.env.SYKA_PI_PATH ?? which("pi", { ...env, extraDirs: [...env.extraDirs, npm, join(home, ".local", "bin")] });
  if (!found) return null;
  if (!/\.(cmd|bat|ps1)$/i.test(found)) return { command: found, args: [] };
  const cli = join(dirname(found), "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js");
  const node = which("node", env);
  return node && existsSync(cli) ? { command: node, args: [cli] } : null;
}

/** The provider keys Syka already has, as the variables Pi reads. */
export function piProviderEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const provider of activeProviders()) {
    if (provider.kind === "openrouter") env.OPENROUTER_API_KEY ??= provider.apiKey;
    else if (provider.kind === "deepseek") env.DEEPSEEK_API_KEY ??= provider.apiKey;
    else if (provider.kind === "openai") env.OPENAI_API_KEY ??= provider.apiKey;
  }
  return env;
}

const PI_LOGIN = { id: "pi-terminal", label: "Abrir Pi para iniciar sesión" };

/** Pi's interactive TUI in a visible console, where the person types /login. */
function openConsole(command: string, args: string[], env: Record<string, string>): void {
  const quoted = [command, ...args].map(part => `"${part}"`).join(" ");
  if (process.platform === "win32") {
    spawn("cmd.exe", ["/d", "/c", "start", "\"Pi\"", ...[command, ...args].map(part => `"${part}"`)], { env, detached: true, stdio: "ignore", windowsVerbatimArguments: true }).unref();
  } else if (process.platform === "darwin") {
    spawn("osascript", ["-e", `tell application "Terminal" to do script ${JSON.stringify(quoted)}`, "-e", `tell application "Terminal" to activate`], { env, detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("x-terminal-emulator", ["-e", command, ...args], { env, detached: true, stdio: "ignore" }).unref();
  }
}

/** A `pi --mode rpc` process: answered commands and loose events on the same lines. */
export class PiProcess {
  readonly child: ChildProcess;
  readonly #pending = new Map<string, { resolve: (data: Frame | null) => void; reject: (error: Error) => void }>();
  #next = 1;
  #buffer = "";
  readonly stderr: string[] = [];
  exited = false;
  onEvent: (frame: Frame) => void = () => {};
  onExit: () => void = () => {};

  constructor(child: ChildProcess) {
    this.child = child;
    child.stdout?.on("data", (chunk: Buffer) => {
      this.#buffer += chunk.toString("utf8");
      let index = this.#buffer.indexOf("\n");
      while (index >= 0) {
        const line = this.#buffer.slice(0, index).trim();
        this.#buffer = this.#buffer.slice(index + 1);
        index = this.#buffer.indexOf("\n");
        if (!line) continue;
        let frame: Frame;
        try { frame = JSON.parse(line) as Frame; } catch { continue; }
        const id = str(frame, "id");
        const waiting = frame.type === "response" && id ? this.#pending.get(id) : undefined;
        if (waiting && id) {
          this.#pending.delete(id);
          if (frame.success === true) waiting.resolve(rec(frame, "data") ?? null);
          else waiting.reject(new Error(`Pi ${str(frame, "command") ?? ""}: ${str(frame, "error") ?? "falló"}`));
        } else this.onEvent(frame);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => { this.stderr.push(chunk.toString("utf8")); if (this.stderr.length > 40) this.stderr.shift(); });
    const gone = () => {
      if (this.exited) return;
      this.exited = true;
      for (const waiting of this.#pending.values()) waiting.reject(new Error(`Pi terminó${this.stderr.length ? `: ${this.stderr.join("").slice(-400)}` : ""}`));
      this.#pending.clear();
      this.onExit();
    };
    child.on("exit", gone);
    child.on("error", gone);
  }

  send(frame: Frame): void { if (!this.exited) this.child.stdin?.write(`${JSON.stringify(frame)}\n`); }

  request(frame: Frame, timeoutMs = START_TIMEOUT_MS): Promise<Frame | null> {
    const id = `syka-${this.#next++}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.#pending.delete(id); reject(new Error(`Pi no respondió a ${String(frame.type)}`)); }, timeoutMs);
      timer.unref?.();
      this.#pending.set(id, { resolve: data => { clearTimeout(timer); resolve(data); }, reject: error => { clearTimeout(timer); reject(error); } });
      this.send({ ...frame, id });
    });
  }

  kill(): void { this.child.stdin?.end(); this.child.kill(); }
}

export type PiSpawn = (command: string, args: string[], cwd: string, env: Record<string, string>) => ChildProcess;
const defaultSpawn: PiSpawn = (command, args, cwd, env) => spawn(command, args, { cwd, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });

/** `provider/model` as Pi names it, split for `set_model`. */
export function splitPiModel(model: string): { provider: string; modelId: string } {
  const slash = model.indexOf("/");
  return slash < 0 ? { provider: "", modelId: model } : { provider: model.slice(0, slash), modelId: model.slice(slash + 1) };
}

class PiSession implements HarnessSession {
  #sessionFile: string | null;
  #model: string | null = null;
  #effort: string | null = null;
  #turn: { emit: Emit; finish: (outcome: TurnOutcome) => void; text: { id: string; text: string } | null; reasoning: { id: string; text: string } | null; tools: Map<string, { id: string; name: string; title: string; detail?: string }>; error: string | null; aborted: boolean } | null = null;
  #instructions: string | undefined;
  #introduced: boolean;

  private readonly process: PiProcess;

  constructor(process: PiProcess, sessionFile: string | null, instructions: string | undefined, resumed: boolean) {
    this.process = process;
    this.#sessionFile = sessionFile;
    this.#instructions = instructions;
    this.#introduced = resumed;
    process.onEvent = frame => this.#onFrame(frame);
    process.onExit = () => { const turn = this.#turn; if (turn) { this.#turn = null; turn.finish({ status: "failed", error: `Pi se cerró${process.stderr.length ? `: ${process.stderr.join("").slice(-300)}` : "."}` }); } };
  }

  get isClosed(): boolean { return this.process.exited; }
  get resume(): ResumeCursor { return { pi: { sessionFile: this.#sessionFile ?? "" } } as ResumeCursor; }

  async send(text: string, model: string, emit: Emit, effort?: string): Promise<TurnOutcome> {
    if (this.#turn) throw new Error("A turn is already running");
    if (model && model !== this.#model) {
      await this.process.request(splitPiModel(model).provider ? { type: "set_model", ...splitPiModel(model) } : { type: "set_model", modelId: model });
      this.#model = model;
    }
    if (effort && effort !== this.#effort) { await this.process.request({ type: "set_thinking_level", level: effort }).catch(() => null); this.#effort = effort; }
    // Pi has no developer-instructions slot: Syka's go once, before the first message of the session.
    const message = !this.#introduced && this.#instructions ? `${this.#instructions}\n\n---\n\n${text}` : text;
    this.#introduced = true;
    return new Promise<TurnOutcome>(resolve => {
      this.#turn = { emit, finish: resolve, text: null, reasoning: null, tools: new Map(), error: null, aborted: false };
      this.process.request({ type: "prompt", message, images: [] }).catch(error => this.#end({ status: "failed", error: error instanceof Error ? error.message : String(error) }));
    }).finally(async () => {
      // The session file exists once Pi saved the first exchange.
      if (!this.#sessionFile) this.#sessionFile = str(await this.process.request({ type: "get_state" }, 10_000).catch(() => null), "sessionFile");
    });
  }

  #onFrame(frame: Frame): void {
    if (frame.type === "extension_ui_request") {
      // Pi's extension dialogs have no card here yet: declined, so the turn never hangs.
      const method = str(frame, "method");
      if (method === "select" || method === "confirm" || method === "input" || method === "editor") this.process.send({ type: "extension_ui_response", id: frame.id, cancelled: true });
      return;
    }
    const turn = this.#turn;
    if (!turn) return;
    switch (frame.type) {
      case "message_update": {
        const update = rec(frame, "assistantMessageEvent");
        const delta = str(update, "delta");
        if (!delta) return;
        if (str(update, "type") === "thinking_delta") this.#stream("reasoning", delta);
        else if (str(update, "type") === "text_delta") this.#stream("assistant", delta);
        return;
      }
      case "message_end": {
        const message = rec(frame, "message");
        if (str(message, "role") !== "assistant") return;
        // The final message may carry text that never came as deltas.
        for (const part of list(message, "content")) {
          const text = str(part, "type") === "text" ? str(part, "text") : null;
          if (!text) continue;
          const shown = turn.text?.text ?? "";
          if (text.startsWith(shown) && text.length > shown.length) this.#stream("assistant", text.slice(shown.length));
        }
        const stop = str(message, "stopReason");
        if (stop === "error") turn.error = str(message, "errorMessage") ?? "Pi falló";
        if (stop === "aborted") turn.aborted = true;
        this.#closeText();
        return;
      }
      case "tool_execution_start": {
        const callId = str(frame, "toolCallId");
        if (!callId || turn.tools.has(callId)) return;
        this.#closeText();
        const name = str(frame, "toolName") ?? "tool";
        const item = { id: newItemId("t"), name, title: name, detail: summarizeInput(rec(frame, "args") ?? undefined) };
        turn.tools.set(callId, item);
        turn.emit({ type: "item.started", item: { ...item, kind: "tool", status: "running" } });
        return;
      }
      case "tool_execution_end": {
        const callId = str(frame, "toolCallId");
        const known = callId ? turn.tools.get(callId) : undefined;
        if (!known) return;
        const output = list(rec(frame, "result"), "content").flatMap(entry => { const text = str(entry, "text"); return text ? [text] : []; }).join("\n");
        turn.emit({ type: "item.completed", item: { ...known, kind: "tool", status: frame.isError === true ? "failed" : "done", output: truncateDetail(output || undefined) } });
        return;
      }
      case "extension_error":
        turn.error = str(frame, "error") ?? "Error de una extensión de Pi";
        return;
      case "agent_settled":
      case "agent_end":
        this.#end(turn.error ? { status: "failed", error: turn.error } : turn.aborted ? { status: "interrupted" } : { status: "completed" });
        return;
      default:
    }
  }

  #stream(kind: "assistant" | "reasoning", delta: string): void {
    const turn = this.#turn!;
    if (kind === "assistant" && turn.reasoning) this.#close("reasoning");
    const open = kind === "assistant" ? turn.text : turn.reasoning;
    if (!open) {
      const item = { id: newItemId(kind === "assistant" ? "a" : "r"), text: delta };
      if (kind === "assistant") turn.text = item; else turn.reasoning = item;
      turn.emit({ type: "item.started", item: { id: item.id, kind, text: delta } });
      return;
    }
    open.text += delta;
    turn.emit({ type: "item.delta", itemId: open.id, text: delta });
  }

  #close(kind: "assistant" | "reasoning"): void {
    const turn = this.#turn!;
    const open = kind === "assistant" ? turn.text : turn.reasoning;
    if (!open) return;
    turn.emit({ type: "item.completed", item: { id: open.id, kind, text: open.text } });
    if (kind === "assistant") turn.text = null; else turn.reasoning = null;
  }

  #closeText(): void { this.#close("reasoning"); this.#close("assistant"); }

  #end(outcome: TurnOutcome): void {
    const turn = this.#turn;
    if (!turn) return;
    this.#closeText();
    for (const tool of turn.tools.values()) turn.emit({ type: "item.completed", item: { ...tool, kind: "tool", status: outcome.status === "completed" ? "done" : "failed" } });
    this.#turn = null;
    turn.finish(outcome);
  }

  respond(): void { /* Pi asks no questions through Syka. */ }
  async interrupt(): Promise<void> { await this.process.request({ type: "abort" }, 10_000).catch(() => null); }
  async close(): Promise<void> { this.process.kill(); }
}

export class PiHarness implements Harness {
  readonly id = "pi" as const;
  private readonly spawnPi: PiSpawn;
  constructor(spawnPi: PiSpawn = defaultSpawn) { this.spawnPi = spawnPi; }

  async probe(env: HostEnv, signal: AbortSignal): Promise<HarnessInfo> {
    const label = HARNESS_LABELS.pi;
    const launch = piCommand(env);
    if (!launch) return { id: this.id, label, status: "not-installed", detail: INSTALL_HINT, models: [] };
    const probe = new PiProcess(this.spawnPi(launch.command, [...launch.args, "--mode", "rpc", "--no-themes", "--no-session"], homedir(), { ...env.env, ...piProviderEnv() }));
    const abort = () => probe.kill();
    signal.addEventListener("abort", abort, { once: true });
    try {
      const models = list(await probe.request({ type: "get_available_models" }, PROBE_TIMEOUT_MS), "models").flatMap(entry => {
        const id = str(entry, "id");
        if (!id) return [];
        const provider = str(entry, "provider");
        return [{ id: provider ? `${provider}/${id}` : id, label: provider ? `${str(entry, "name") ?? id} · ${provider}` : str(entry, "name") ?? id }];
      });
      if (!models.length) return { id: this.id, label, status: "signed-out", detail: LOGIN_HINT, models: [], authMethods: [PI_LOGIN] };
      return { id: this.id, label, status: "ready", models, defaultModel: models[0]!.id };
    } catch (error) {
      return { id: this.id, label, status: "error", detail: error instanceof Error ? error.message : String(error), models: [] };
    } finally {
      signal.removeEventListener("abort", abort);
      probe.kill();
    }
  }

  /** Opens Pi in its own console window for /login, and waits until it has models. */
  async authenticate(env: HostEnv, methodId: string, signal: AbortSignal): Promise<void> {
    if (methodId !== PI_LOGIN.id) throw new Error("Método de conexión no soportado.");
    const launch = piCommand(env);
    if (!launch) throw new Error(INSTALL_HINT);
    openConsole(launch.command, launch.args, { ...env.env, ...piProviderEnv() });
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      if (signal.aborted) throw new Error("Conexión cancelada.");
      await new Promise(resolve => setTimeout(resolve, 3000));
      const info = await this.probe(env, signal).catch(() => null);
      if (info?.status === "ready") return;
    }
    throw new Error("Pi todavía no tiene un proveedor conectado. Escribí /login en la ventana de Pi y elegí uno.");
  }

  async open(options: OpenOptions): Promise<HarnessSession> {
    const launch = piCommand(options.env);
    if (!launch) throw new Error(INSTALL_HINT);
    const previous = options.resume && "pi" in options.resume ? (options.resume as { pi: { sessionFile: string } }).pi.sessionFile : "";
    const resumed = !!previous && existsSync(previous);
    const args = [...launch.args, "--mode", "rpc", "--no-themes", ...(resumed ? ["--session", previous] : [])];
    const process = new PiProcess(this.spawnPi(launch.command, args, options.cwd, { ...options.env.env, ...piProviderEnv() }));
    const state = await process.request({ type: "get_state" }).catch(error => { process.kill(); throw error; });
    return new PiSession(process, str(state, "sessionFile") ?? (resumed ? previous : null), options.instructions, resumed);
  }
}
