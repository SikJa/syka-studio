/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Transcription on this computer (Settings › Voz y transcripción › En este
 * equipo), after Syka Code's `LocalWhisper`: the whisper.cpp server and the
 * models live in `userData/voice`, downloaded with progress, cancel and
 * SHA-256 check; audio never leaves the computer. Captions get one timed word
 * per segment, dictation plain text.
 */
import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { LOCAL_MODELS, LOCAL_VOICE_MODELS, WINDOWS_RUNTIME, type LocalVoiceModel, type ModelAsset, type RuntimeAsset } from "./assets";
import { DownloadCancelled, downloadVerified } from "./download";
import { reapOrphanServer, rememberServerPid, systemProcessName } from "./orphan";
import { DEFAULT_IDLE_MS, WhisperServer, type ServerState } from "./whisper-server";
import { extractZip } from "./zip";
import type { ExternalModels } from "./external";

export type { LocalVoiceModel };
export type LocalVoiceStatus = {
  /** Only Windows downloads the server; elsewhere this is unavailable. */
  supported: boolean;
  /** whisper.cpp's server (Windows, per-word times) or syka-asr (Mac and Linux, dictation only). */
  engine: "whisper.cpp" | "syka-asr";
  runtimeReady: boolean;
  /** The model to use: the chosen one when installed, otherwise another installed one. */
  readyModel: LocalVoiceModel | null;
  preferred: LocalVoiceModel;
  /** `external`: another app's verified copy, used in place and never deleted by Syka. */
  models: { id: LocalVoiceModel; sizeBytes: number; installed: boolean; external: boolean }[];
  scanning: boolean;
  download: { model: LocalVoiceModel; phase: "runtime" | "model" | "verifying"; receivedBytes: number; totalBytes: number } | null;
  /** The last download that failed, to explain it. */
  error: string | null;
  server: ServerState;
};

export type LocalSegment = { text: string; start: number; end: number };

/** Turns whisper-server's per-word verbose answer into timed words, dropping its non-speech marks. */
export function timedWords(body: unknown): { word: string; start: number; end: number }[] {
  const segments = (body as { segments?: unknown } | null)?.segments;
  if (!Array.isArray(segments)) throw new Error("El transcriptor local no devolvió tiempos por palabra.");
  return segments.flatMap(entry => {
    const segment = entry as { text?: unknown; start?: unknown; end?: unknown };
    const text = typeof segment.text === "string" ? segment.text.trim() : "";
    if (!text || /^[[(].*[\])]$/.test(text) || typeof segment.start !== "number" || typeof segment.end !== "number") return [];
    return [{ word: text, start: segment.start, end: Math.max(segment.end, segment.start) }];
  });
}

type Download = NonNullable<LocalVoiceStatus["download"]> & { controller: AbortController };

export class LocalVoice {
  readonly #dir: string;
  readonly #server: WhisperServer;
  readonly #fetch: typeof fetch;
  readonly #runtime: RuntimeAsset;
  readonly #models: Readonly<Record<LocalVoiceModel, ModelAsset>>;
  readonly #platform: NodeJS.Platform;
  #download: Download | null = null;
  #error: string | null = null;
  #preferred: LocalVoiceModel = "small";
  readonly #external: ExternalModels | null;
  #found = new Map<LocalVoiceModel, string>();
  #scanning: Promise<void> | null = null;

  constructor(options: { dir: string; server: WhisperServer; fetch?: typeof fetch; platform?: NodeJS.Platform; runtime?: RuntimeAsset; models?: Readonly<Record<LocalVoiceModel, ModelAsset>>; external?: ExternalModels }) {
    this.#external = options.external ?? null;
    this.#dir = options.dir;
    this.#server = options.server;
    this.#fetch = options.fetch ?? fetch;
    this.#platform = options.platform ?? process.platform;
    this.#runtime = options.runtime ?? WINDOWS_RUNTIME;
    this.#models = options.models ?? LOCAL_MODELS;
  }

  async load(): Promise<void> {
    try {
      const saved = JSON.parse(await readFile(join(this.#dir, "settings.json"), "utf8")) as { preferred?: unknown };
      if (LOCAL_VOICE_MODELS.includes(saved.preferred as LocalVoiceModel)) this.#preferred = saved.preferred as LocalVoiceModel;
    } catch { /* Defaults. */ }
  }

  get executable(): string | null {
    const path = join(this.#dir, this.#runtime.folder, "whisper-server.exe");
    return this.#size(path) !== null ? path : null;
  }
  #own(model: LocalVoiceModel): string { return join(this.#dir, this.#models[model].file); }
  #ownHas(model: LocalVoiceModel): boolean { return this.#size(this.#own(model)) === this.#models[model].sizeBytes; }
  modelPath(model: LocalVoiceModel): string { return this.#ownHas(model) ? this.#own(model) : this.#found.get(model) ?? this.#own(model); }
  installed(model: LocalVoiceModel): boolean { return this.#ownHas(model) || this.#found.has(model); }

  /** Looks for Whisper models other apps already downloaded and verifies them. */
  discover(): Promise<void> {
    if (!this.#external) return Promise.resolve();
    this.#scanning ??= (async () => {
      for (const model of LOCAL_VOICE_MODELS) {
        if (this.#ownHas(model)) continue;
        const path = await this.#external!.find(this.#models[model]).catch(() => null);
        if (path) this.#found.set(model, path); else this.#found.delete(model);
      }
    })().finally(() => { this.#scanning = null; });
    return this.#scanning;
  }

  readyModel(): LocalVoiceModel | null {
    if (!this.executable) return null;
    if (this.installed(this.#preferred)) return this.#preferred;
    return LOCAL_VOICE_MODELS.find(model => this.installed(model)) ?? null;
  }

  status(): LocalVoiceStatus {
    const download = this.#download;
    return {
      supported: this.#platform === "win32",
      engine: "whisper.cpp",
      runtimeReady: this.executable !== null,
      readyModel: this.readyModel(),
      preferred: this.#preferred,
      models: LOCAL_VOICE_MODELS.map(id => ({ id, sizeBytes: this.#models[id].sizeBytes, installed: this.installed(id), external: !this.#ownHas(id) && this.#found.has(id) })),
      scanning: this.#scanning !== null,
      download: download && { model: download.model, phase: download.phase, receivedBytes: download.receivedBytes, totalBytes: download.totalBytes },
      error: this.#error,
      server: this.#server.state,
    };
  }

  async choose(model: LocalVoiceModel): Promise<void> {
    this.#preferred = model;
    await mkdir(this.#dir, { recursive: true });
    await writeFile(join(this.#dir, "settings.json"), JSON.stringify({ preferred: model }));
  }

  /** Starts downloading what is missing (the server and the model) and returns at once. */
  startDownload(model: LocalVoiceModel): void {
    if (this.#platform !== "win32") throw new Error("La transcripción local se descarga solo en Windows.");
    if (this.#download) throw new Error("Ya hay una descarga en curso. Esperá a que termine o cancelala.");
    const needsRuntime = this.executable === null;
    const needsModel = !this.installed(model);
    if (!needsRuntime && !needsModel) return;
    const download: Download = {
      model, controller: new AbortController(), phase: needsRuntime ? "runtime" : "model", receivedBytes: 0,
      totalBytes: (needsRuntime ? this.#runtime.sizeBytes : 0) + (needsModel ? this.#models[model].sizeBytes : 0),
    };
    this.#download = download;
    this.#error = null;
    const options = {
      fetch: this.#fetch, signal: download.controller.signal,
      onBytes: (bytes: number) => { download.receivedBytes += bytes; },
      onVerifying: () => { download.phase = "verifying"; },
    };
    void (async () => {
      await mkdir(this.#dir, { recursive: true });
      if (needsRuntime) await this.#installRuntime(options);
      if (needsModel) {
        download.phase = "model";
        await downloadVerified(this.#models[model], this.#own(model), options);
      }
    })().catch(error => {
      this.#error = error instanceof DownloadCancelled ? null : error instanceof Error ? error.message : String(error);
    }).finally(() => { if (this.#download === download) this.#download = null; });
  }

  cancelDownload(): void { this.#download?.controller.abort(); }

  /** Deletes the model; with the last one, also the downloaded server. */
  async deleteModel(model: LocalVoiceModel): Promise<void> {
    if (this.#download?.model === model) this.cancelDownload();
    // The server keeps the model open: Windows would not delete it.
    this.#server.stop();
    const retry = { force: true, maxRetries: 5, retryDelay: 200 };
    // Only Syka's own download: another app's copy stays where it is.
    await rm(this.#own(model), retry);
    await rm(`${this.#own(model)}.part`, retry);
    if (!LOCAL_VOICE_MODELS.some(other => this.#ownHas(other) || this.#found.has(other)) && !this.#download) {
      await rm(join(this.#dir, this.#runtime.folder), { ...retry, recursive: true });
    }
  }

  warmup(): void {
    const model = this.readyModel();
    if (model && this.executable) this.#server.warmup(this.executable, this.modelPath(model));
  }

  async transcribe(request: { audio: Uint8Array; durationMs: number; language: string | null; words: boolean; prompt?: string }): Promise<unknown> {
    const model = this.readyModel();
    const executable = this.executable;
    if (!model || !executable) throw new Error("Descargá un modelo en Configuración › Voz y transcripción para transcribir en este equipo.");
    return this.#server.transcribe(executable, this.modelPath(model), request);
  }

  dispose(): void { this.cancelDownload(); this.#server.stop(); }

  #size(path: string): number | null {
    try { const info = statSync(path); return info.isFile() ? info.size : null; } catch { return null; }
  }

  async #installRuntime(options: Parameters<typeof downloadVerified>[2]): Promise<void> {
    const zipPath = join(this.#dir, `${this.#runtime.folder}.zip`);
    await downloadVerified(this.#runtime, zipPath, options);
    try {
      const entries = extractZip(await readFile(zipPath), name => this.#runtime.keep.test(name));
      if (!entries.some(entry => entry.name.toLowerCase() === "whisper-server.exe")) throw new Error("El paquete de whisper.cpp no trae whisper-server.");
      // Extracted aside and renamed at the end: never a half-installed server.
      const target = join(this.#dir, this.#runtime.folder);
      const staging = `${target}.tmp`;
      await rm(staging, { recursive: true, force: true });
      await mkdir(staging, { recursive: true });
      await Promise.all(entries.map(entry => writeFile(join(staging, entry.name), entry.data)));
      await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      await rename(staging, target);
    } finally {
      await rm(zipPath, { force: true });
    }
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => typeof address === "object" && address ? resolve(address.port) : reject(new Error("Sin puerto libre.")));
    });
  });
}

/** The real thing for main: the server process, the orphan cleanup and timers. */
export function createLocalVoice(dir: string, log: (line: string) => void = () => {}, external?: ExternalModels): LocalVoice {
  const pidFile = join(dir, "whisper-server.pid");
  const beforeStart = reapOrphanServer({ pidFile, processName: systemProcessName(process.platform), kill: pid => process.kill(pid) });
  const server = new WhisperServer({
    spawn: (command, args, cwd) => spawn(command, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }),
    fetch, freePort,
    timers: { set: (callback, ms) => setTimeout(callback, ms), clear: handle => clearTimeout(handle as NodeJS.Timeout) },
    wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
    now: Date.now,
    threads: Math.max(2, Math.min(8, availableParallelism() - 1)),
    idleMs: DEFAULT_IDLE_MS,
    startTimeoutMs: 90_000,
    // Ten minutes of audio with the biggest model on a modest CPU take a while.
    requestTimeoutMs: 30 * 60_000,
    pollMs: 300,
    log,
    onProcess: pid => rememberServerPid(pidFile, pid),
    beforeStart,
  });
  return new LocalVoice({ dir, server, ...(external ? { external } : {}) });
}
