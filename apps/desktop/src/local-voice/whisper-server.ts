/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * The life of `whisper-server` (whisper.cpp), after Syka Code's
 * `local/whisper-server.ts`: started on demand on 127.0.0.1 with a free port,
 * ready once `/health` stops answering 503, and stopped after a few idle
 * minutes to give back the model's memory. It loads the model once, so each
 * request only pays for the transcription.
 */
import { dirname } from "node:path";

export type ServerProcess = {
  readonly pid?: number | undefined;
  readonly stdout: { on(event: "data", listener: (chunk: Buffer | string) => void): unknown } | null;
  readonly stderr: { on(event: "data", listener: (chunk: Buffer | string) => void): unknown } | null;
  once(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  once(event: "error", listener: (error: Error) => void): unknown;
  kill(): boolean;
};

export type ServerState = "stopped" | "starting" | "running";

export type WhisperServerDeps = {
  spawn: (command: string, args: readonly string[], cwd: string) => ServerProcess;
  fetch: typeof fetch;
  freePort: () => Promise<number>;
  timers: { set(callback: () => void, ms: number): unknown; clear(handle: unknown): void };
  wait: (ms: number) => Promise<void>;
  now: () => number;
  threads: number;
  idleMs: number;
  startTimeoutMs: number;
  requestTimeoutMs: number;
  pollMs: number;
  log: (line: string) => void;
  /** The process started (pid) or ended (null): to clean up orphans. */
  onProcess?: (pid: number | null) => void;
  /** Awaited before the first start: the orphan cleanup, so it never closes the new server. */
  beforeStart?: Promise<unknown>;
};

export type LocalRequest = {
  /** 16 kHz mono WAV. */
  audio: Uint8Array;
  /** ISO 639-1, or null to detect it. */
  language: string | null;
  durationMs: number;
  /** One segment per word with its times (captions), instead of plain text (dictation). */
  words: boolean;
  prompt?: string;
};

export const DEFAULT_IDLE_MS = 5 * 60_000;

/**
 * Encoder audio context (Syka Code's measurement): Whisper always encodes 30 s
 * (1500 frames). A short dictation only needs what was recorded plus a margin
 * and runs twice as fast; past that, the full context (0).
 */
export function audioContextFor(durationMs: number): number {
  const frames = Math.ceil((durationMs / 1000 + 4) * 50);
  return frames >= 1436 ? 0 : Math.max(768, frames);
}

type Running = { key: string; process: ServerProcess | null; port: number; ready: Promise<number>; exited: boolean; tail: string[] };

const lastLines = (tail: readonly string[]) => {
  const useful = tail.filter(line => /error|fail|not found|couldn't|invalid/i.test(line));
  return (useful.length ? useful : tail).slice(-2).join(" · ");
};
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);

export class WhisperServer {
  readonly #deps: WhisperServerDeps;
  #current: Running | null = null;
  #state: ServerState = "stopped";
  #idle: unknown = null;
  #inFlight = 0;

  constructor(deps: WhisperServerDeps) { this.#deps = deps; }

  get state(): ServerState { return this.#state; }
  get busy(): boolean { return this.#inFlight > 0; }

  /** Starts the server ahead of time (when recording begins); failures are only logged. */
  warmup(executable: string, model: string): void {
    void this.ensure(executable, model).then(() => this.#scheduleIdle(), error => this.#deps.log(`no se pudo preparar whisper-server: ${messageOf(error)}`));
  }

  /** whisper-server's JSON answer: `{ text }`, or with `words` its verbose segments. */
  async transcribe(executable: string, model: string, request: LocalRequest): Promise<unknown> {
    this.#inFlight += 1;
    this.#clearIdle();
    try {
      const port = await this.ensure(executable, model);
      const form = new FormData();
      form.append("file", new Blob([request.audio.slice()], { type: "audio/wav" }), "audio.wav");
      // Without a language whisper-server assumes English.
      form.append("language", request.language ?? "auto");
      form.append("temperature", "0.0");
      form.append("suppress_non_speech", "true");
      if (request.prompt) form.append("prompt", request.prompt);
      if (request.words) {
        // One segment per word, split on word boundaries: the times captions need.
        form.append("response_format", "verbose_json");
        form.append("max_len", "1");
        form.append("split_on_word", "true");
      } else {
        form.append("response_format", "json");
        form.append("audio_ctx", String(audioContextFor(request.durationMs)));
      }
      let response: Response;
      try {
        response = await this.#deps.fetch(`http://127.0.0.1:${port}/inference`, { method: "POST", body: form, signal: AbortSignal.timeout(this.#deps.requestTimeoutMs) });
      } catch (error) {
        const name = (error as { name?: unknown } | null)?.name;
        if (name === "TimeoutError" || name === "AbortError") throw new Error("La transcripción local tardó demasiado. Probá con un modelo más chico.");
        throw new Error("El transcriptor local se cerró mientras trabajaba. Probá de nuevo.");
      }
      const body = await response.json().catch(() => null) as { text?: unknown; error?: unknown } | null;
      if (!response.ok || typeof body?.text !== "string") {
        throw new Error(`El transcriptor local no pudo transcribir el audio${typeof body?.error === "string" ? `: ${body.error}` : ""}.`);
      }
      return body;
    } finally {
      this.#inFlight -= 1;
      this.#scheduleIdle();
    }
  }

  ensure(executable: string, model: string): Promise<number> {
    const key = `${executable}\u0000${model}`;
    const current = this.#current;
    if (current && (current.key !== key || current.exited)) this.stop();
    return (this.#current ?? this.#start(executable, model, key)).ready;
  }

  stop(): void {
    this.#clearIdle();
    const current = this.#current;
    this.#current = null;
    if (current?.process && !current.exited) {
      current.process.kill();
      this.#deps.onProcess?.(null);
      this.#deps.log("whisper-server apagado");
    }
    this.#state = "stopped";
  }

  #start(executable: string, model: string, key: string): Running {
    const running: Running = { key, process: null, port: 0, ready: Promise.resolve(0), exited: false, tail: [] };
    this.#current = running;
    this.#state = "starting";
    running.ready = this.#launch(running, executable, model).then(
      port => { if (this.#current === running) this.#state = "running"; return port; },
      (error: unknown) => { if (this.#current === running) this.stop(); throw error; },
    );
    running.ready.catch(() => undefined);
    return running;
  }

  async #launch(running: Running, executable: string, model: string): Promise<number> {
    await this.#deps.beforeStart?.catch(() => undefined);
    const port = await this.#deps.freePort();
    if (this.#current !== running) throw new Error("Se canceló el arranque del transcriptor local.");
    running.port = port;
    let child: ServerProcess;
    try {
      child = this.#deps.spawn(executable, ["-m", model, "--host", "127.0.0.1", "--port", String(port), "-t", String(this.#deps.threads)], dirname(executable));
    } catch (error) {
      throw new Error(`No se pudo arrancar whisper-server: ${messageOf(error)}.`);
    }
    running.process = child;
    const collect = (chunk: Buffer | string) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (!line.trim()) continue;
        running.tail.push(line.trim());
        if (running.tail.length > 30) running.tail.shift();
      }
    };
    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);
    let exitReason = "";
    const exited = new Promise<void>(resolve => {
      const gone = (reason: string) => {
        if (running.exited) return;
        running.exited = true;
        exitReason = reason;
        this.#deps.onProcess?.(null);
        if (this.#current === running) {
          this.#current = null;
          this.#clearIdle();
          this.#state = "stopped";
          this.#deps.log(`whisper-server terminó (${reason})`);
        }
        resolve();
      };
      child.once("close", (code, signal) => gone(signal === null ? `código ${code}` : `señal ${signal}`));
      child.once("error", error => gone(error.message));
    });
    if (child.pid !== undefined) this.#deps.onProcess?.(child.pid);
    this.#deps.log(`arrancando whisper-server en 127.0.0.1:${port} con ${this.#deps.threads} hilos`);
    try {
      await this.#waitReady(running, exited);
    } catch (error) {
      const detail = lastLines(running.tail) || exitReason || messageOf(error);
      throw new Error(`El transcriptor local no pudo arrancar${detail ? ` (${detail})` : ""}.`);
    }
    return port;
  }

  async #waitReady(running: Running, exited: Promise<void>): Promise<void> {
    const deadline = this.#deps.now() + this.#deps.startTimeoutMs;
    while (!running.exited) {
      if (this.#current !== running) throw new Error("se canceló el arranque");
      if (this.#deps.now() > deadline) throw new Error("no respondió a tiempo");
      try {
        const response = await this.#deps.fetch(`http://127.0.0.1:${running.port}/health`, { signal: AbortSignal.timeout(2000) });
        // 503 = still loading the model; anything else means it listens.
        if (response.status !== 503) return;
      } catch { /* Not listening yet. */ }
      await Promise.race([this.#deps.wait(this.#deps.pollMs), exited]);
    }
    throw new Error("se cerró al arrancar");
  }

  #scheduleIdle(): void {
    this.#clearIdle();
    if (this.#inFlight > 0 || this.#current === null) return;
    this.#idle = this.#deps.timers.set(() => { this.#idle = null; if (this.#inFlight === 0) this.stop(); }, this.#deps.idleMs);
  }

  #clearIdle(): void {
    if (this.#idle === null) return;
    this.#deps.timers.clear(this.#idle);
    this.#idle = null;
  }
}
