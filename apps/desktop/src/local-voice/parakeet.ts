/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Parakeet TDT 0.6B v3 on this computer (Settings › Voz y transcripción ›
 * Parakeet v3), with Whispera's engine: transcribe.cpp in `syka-asr`, our own
 * Rust program shipped with the app. It uses the graphics card where it can
 * (Vulkan on Windows and Linux, Metal on Mac) and the processor otherwise.
 * The model and Silero's voice detector are downloaded once, pinned by
 * revision and SHA-256 (from Whispera's handoff).
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import type { ModelAsset } from "./assets";
import { DownloadCancelled, downloadVerified } from "./download";
import type { ExternalModels } from "./external";

const hf = (repo: string, revision: string, file: string) => `https://huggingface.co/${repo}/resolve/${revision}/${file}`;
export const PARAKEET_MODEL: ModelAsset = {
  file: "parakeet-tdt-0.6b-v3-Q8_0.gguf",
  url: hf("handy-computer/parakeet-tdt-0.6b-v3-gguf", "85ac09ea12fc4b1112fa76810059364bc6adc9de", "parakeet-tdt-0.6b-v3-Q8_0.gguf"),
  sha256: "5859f77944efcd8eafa23a6350731960b2b55b2203df51f319665c807d802cc7",
  sizeBytes: 739_508_576,
};
export const SILERO_VAD: ModelAsset = {
  file: "silero-vad-v6.2-F32.gguf",
  url: hf("handy-computer/silero-vad-v6.2-gguf", "a9b2d61c20ae4ddf3644edb34969e8185a485448", "silero-vad-v6.2-F32.gguf"),
  sha256: "0d871a800c420fdd5d1b17a3aea4296d1c39608f0ff4a9295eb76457eb1c88e6",
  sizeBytes: 1_241_056,
};

export type ParakeetStatus = {
  /** The engine ships for this platform. */
  engineReady: boolean;
  installed: boolean;
  download: { phase: "model" | "verifying"; receivedBytes: number; totalBytes: number } | null;
  error: string | null;
  /** What the loaded model runs on, e.g. "NVIDIA GeForce GTX 1660 Ti (Vulkan)"; null until loaded. */
  device: string | null;
  /** The graphics card failed and it fell back to the processor. */
  cpuFallback: boolean;
  state: "stopped" | "starting" | "running";
  /** Whether the model takes a list of words to favour (the glossary). */
  vocabulary: boolean | null;
  /** `external`: another app's verified copy (Whispera), used in place and never deleted by Syka. */
  source: "syka" | "external" | null;
  /** The folder of the model in use. */
  location: string | null;
  /** Looking for (and verifying) copies other apps already downloaded. */
  scanning: boolean;
};

export type AsrWord = { text: string; start_ms: number; end_ms: number };
export type AsrResult = { text: string; words: AsrWord[]; language: string | null; wordLevel: boolean; audioMs: number; ms: number };

type Pending = { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void };
type Worker = { child: ChildProcessWithoutNullStreams; pending: Map<string, Pending>; ready: Promise<Record<string, unknown>>; cpu: boolean; tail: string[] };

/** Where `syka-asr` is: next to the app's resources when installed, the build folder in development. */
export function asrExecutable(roots: readonly string[], platform: NodeJS.Platform = process.platform): string | null {
  const name = platform === "win32" ? "syka-asr.exe" : "syka-asr";
  for (const root of roots) {
    const path = join(root, name);
    try { if (statSync(path).isFile()) return path; } catch { /* Next. */ }
  }
  return null;
}

/** One model run by syka-asr: Parakeet, or Whisper GGUF on Mac and Linux. */
export class Parakeet {
  readonly #dir: string;
  readonly #roots: () => readonly string[];
  readonly #fetch: typeof fetch;
  readonly #idleMs: number;
  readonly #spawn: (command: string, args: string[]) => ChildProcessWithoutNullStreams;
  #worker: Worker | null = null;
  #download: (NonNullable<ParakeetStatus["download"]> & { controller: AbortController }) | null = null;
  #error: string | null = null;
  #device: string | null = null;
  #vocabulary: boolean | null = null;
  #cpuFallback = false;
  #idle: NodeJS.Timeout | null = null;
  #inFlight = 0;
  readonly #external: ExternalModels | null;
  /** Verified copies found in other apps' folders, by file name. */
  #found = new Map<string, string>();
  #scanning: Promise<void> | null = null;

  /** The model it runs and, optionally, the voice detector in front (Parakeet by default; Whisper GGUF elsewhere). */
  readonly #model: ModelAsset;
  readonly #vad: ModelAsset | null;
  #assets(): ModelAsset[] { return this.#vad ? [this.#model, this.#vad] : [this.#model]; }

  constructor(options: { dir: string; roots: () => readonly string[]; fetch?: typeof fetch; idleMs?: number; spawn?: (command: string, args: string[]) => ChildProcessWithoutNullStreams; external?: ExternalModels; model?: ModelAsset; vad?: ModelAsset | null }) {
    this.#model = options.model ?? PARAKEET_MODEL;
    this.#vad = options.vad === undefined ? SILERO_VAD : options.vad;
    this.#external = options.external ?? null;
    this.#dir = options.dir;
    this.#roots = options.roots;
    this.#fetch = options.fetch ?? fetch;
    this.#idleMs = options.idleMs ?? 5 * 60_000;
    this.#spawn = options.spawn ?? ((command, args) => spawn(command, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }));
  }

  get executable(): string | null { return asrExecutable(this.#roots()); }
  #own(asset: ModelAsset) { return join(this.#dir, asset.file); }
  #ownHas(asset: ModelAsset) { try { return statSync(this.#own(asset)).size === asset.sizeBytes; } catch { return false; } }
  /** Syka's own download first, otherwise a verified copy of another app. */
  #path(asset: ModelAsset) { return this.#ownHas(asset) ? this.#own(asset) : this.#found.get(asset.file) ?? this.#own(asset); }
  #has(asset: ModelAsset) { return this.#ownHas(asset) || this.#found.has(asset.file); }
  get installed(): boolean { return this.#assets().every(asset => this.#has(asset)); }

  /** Looks for the model in other apps' folders (Whispera) and verifies it; at start and on «Buscar». */
  discover(): Promise<void> {
    if (!this.#external) return Promise.resolve();
    this.#scanning ??= (async () => {
      for (const asset of this.#assets()) {
        if (this.#ownHas(asset)) continue;
        const path = await this.#external!.find(asset).catch(() => null);
        if (path) this.#found.set(asset.file, path); else this.#found.delete(asset.file);
      }
    })().finally(() => { this.#scanning = null; });
    return this.#scanning;
  }
  get ready(): boolean { return this.installed && this.executable !== null; }

  status(): ParakeetStatus {
    const download = this.#download;
    return {
      engineReady: this.executable !== null,
      installed: this.installed,
      download: download && { phase: download.phase, receivedBytes: download.receivedBytes, totalBytes: download.totalBytes },
      error: this.#error,
      device: this.#device,
      cpuFallback: this.#cpuFallback,
      state: !this.#worker ? "stopped" : this.#device ? "running" : "starting",
      vocabulary: this.#vocabulary,
      source: !this.installed ? null : this.#ownHas(this.#model) ? "syka" : "external",
      location: this.installed ? dirname(this.#path(this.#model)) : null,
      scanning: this.#scanning !== null,
    };
  }

  startDownload(): void {
    if (this.#download) throw new Error("Ya hay una descarga en curso.");
    if (this.installed) return;
    const missing = this.#assets().filter(asset => !this.#has(asset));
    const target = (asset: ModelAsset) => this.#own(asset);
    const download = { phase: "model" as const as "model" | "verifying", receivedBytes: 0, totalBytes: missing.reduce((sum, asset) => sum + asset.sizeBytes, 0), controller: new AbortController() };
    this.#download = download;
    this.#error = null;
    void (async () => {
      await mkdir(this.#dir, { recursive: true });
      for (const asset of missing) {
        download.phase = "model";
        await downloadVerified(asset, target(asset), {
          fetch: this.#fetch, signal: download.controller.signal,
          onBytes: bytes => { download.receivedBytes += bytes; },
          onVerifying: () => { download.phase = "verifying"; },
        });
      }
    })().catch(error => {
      this.#error = error instanceof DownloadCancelled ? null : error instanceof Error ? error.message : String(error);
    }).finally(() => { if (this.#download === download) this.#download = null; });
  }

  cancelDownload(): void { this.#download?.controller.abort(); }

  async remove(): Promise<void> {
    this.cancelDownload();
    this.stop();
    const retry = { force: true, maxRetries: 5, retryDelay: 200 };
    // Only Syka's own download: another app's copy stays where it is.
    for (const asset of this.#assets()) {
      await rm(this.#own(asset), retry);
      await rm(`${this.#own(asset)}.part`, retry);
    }
    this.#device = null;
    this.#vocabulary = null;
  }

  /** Loads the model ahead of time (when recording starts); failures stay in `status().error`. */
  warmup(): void {
    if (this.ready) void this.#ensure().then(() => this.#scheduleIdle(), () => undefined);
  }

  /** Transcribes 16 kHz mono 16-bit WAV bytes; times are in milliseconds. */
  async transcribe(wav: Uint8Array, options: { language?: string | null; vocabulary?: string[] } = {}): Promise<AsrResult> {
    if (!this.ready) throw new Error(this.executable ? "Descargá el modelo en Configuración › Voz y transcripción." : "El motor local no está disponible en esta instalación.");
    this.#inFlight += 1;
    this.#clearIdle();
    const file = join(tmpdir(), "syka-asr", `${randomUUID()}.wav`);
    try {
      await mkdir(join(tmpdir(), "syka-asr"), { recursive: true });
      await writeFile(file, wav);
      const worker = await this.#ensure();
      const result = await this.#call(worker, { cmd: "transcribe", wav: file, language: options.language ?? null, vocabulary: options.vocabulary ?? [] });
      return result as unknown as AsrResult;
    } finally {
      this.#inFlight -= 1;
      await rm(file, { force: true });
      this.#scheduleIdle();
    }
  }

  stop(): void {
    this.#clearIdle();
    const worker = this.#worker;
    this.#worker = null;
    this.#device = null;
    if (worker) {
      try { worker.child.stdin.write(`${JSON.stringify({ id: "quit", cmd: "quit" })}\n`); } catch { /* Gone. */ }
      setTimeout(() => { if (worker.child.exitCode === null) worker.child.kill(); }, 1500).unref();
    }
  }

  /** The running engine with the model loaded; a GPU that fails falls back to the processor once. */
  async #ensure(): Promise<Worker> {
    if (this.#worker) {
      await this.#worker.ready;
      return this.#worker;
    }
    try {
      return await this.#start(this.#cpuFallback);
    } catch (error) {
      if (this.#cpuFallback) throw error;
      // The graphics card (or its driver) could not run the model: retry on the processor in a clean process.
      this.#cpuFallback = true;
      return this.#start(true).catch(second => { throw second instanceof Error ? second : error; });
    }
  }

  #start(cpu: boolean): Promise<Worker> {
    const executable = this.executable!;
    const child = this.#spawn(executable, []);
    const worker: Worker = { child, pending: new Map(), ready: Promise.resolve({}), cpu, tail: [] };
    this.#worker = worker;
    createInterface({ input: child.stdout }).on("line", line => {
      let message: Record<string, unknown>;
      try { message = JSON.parse(line) as Record<string, unknown>; } catch { return; }
      const pending = worker.pending.get(String(message.id));
      if (!pending) return;
      worker.pending.delete(String(message.id));
      if (message.ok === true) pending.resolve(message);
      else pending.reject(new Error(typeof message.error === "string" ? message.error : "El motor de Parakeet falló."));
    });
    createInterface({ input: child.stderr }).on("line", line => { worker.tail.push(line); if (worker.tail.length > 20) worker.tail.shift(); });
    const gone = (reason: string) => {
      if (this.#worker === worker) { this.#worker = null; this.#device = null; }
      const detail = worker.tail.filter(line => /error|fail|vulkan|device/i.test(line)).slice(-2).join(" · ");
      for (const pending of worker.pending.values()) pending.reject(new Error(`El motor de Parakeet se cerró (${detail || reason}).`));
      worker.pending.clear();
    };
    child.once("exit", (code, signal) => gone(signal ?? `código ${code}`));
    child.once("error", error => gone(error.message));
    worker.ready = this.#call(worker, { cmd: "load", model: this.#path(this.#model), vad: this.#vad ? this.#path(this.#vad) : null, cpu }).then(info => {
      this.#device = `${String(info.device || "Procesador")} (${String(info.backend || (cpu ? "CPU" : "auto"))})`;
      this.#vocabulary = info.vocabulary === true;
      this.#error = null;
      return info;
    }, error => {
      this.stop();
      this.#error = error instanceof Error ? error.message : String(error);
      throw error;
    });
    return worker.ready.then(() => worker);
  }

  #call(worker: Worker, request: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      worker.pending.set(id, { resolve, reject });
      try { worker.child.stdin.write(`${JSON.stringify({ id, ...request })}\n`); }
      catch (error) { worker.pending.delete(id); reject(error instanceof Error ? error : new Error(String(error))); }
    });
  }

  #scheduleIdle(): void {
    this.#clearIdle();
    if (this.#inFlight > 0 || !this.#worker) return;
    this.#idle = setTimeout(() => { if (this.#inFlight === 0) this.stop(); }, this.#idleMs);
    this.#idle.unref?.();
  }

  #clearIdle(): void { if (this.#idle) clearTimeout(this.#idle); this.#idle = null; }
}
