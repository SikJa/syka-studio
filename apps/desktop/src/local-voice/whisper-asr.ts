/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * «Whisper en este equipo» on macOS and Linux: whisper.cpp publishes no server
 * build for them, so Whisper runs on syka-asr, the same engine as Parakeet
 * (Metal on Mac, Vulkan or the processor on Linux), with the GGUF models of
 * handy-computer pinned by revision and SHA-256. Windows keeps whisper.cpp's
 * server (LocalVoice), which also times every word.
 *
 * transcribe.cpp gives Whisper segment times only (Whispera's handoff), so
 * here it serves dictation; captions ask for Parakeet instead of inventing
 * per-word times.
 */
import { join } from "node:path";
import type { ModelAsset } from "./assets";
import { LOCAL_VOICE_MODELS, type LocalVoiceModel } from "./assets";
import type { ExternalModels } from "./external";
import type { LocalVoiceStatus } from "./local-voice";
import { Parakeet } from "./parakeet";

const hf = (repo: string, revision: string, file: string) => `https://huggingface.co/handy-computer/${repo}/resolve/${revision}/${file}`;
export const WHISPER_GGUF: Readonly<Record<LocalVoiceModel, ModelAsset>> = {
  base: { file: "whisper-base-Q8_0.gguf", url: hf("whisper-base-gguf", "42fcd2077de47c36d779309e0e91b76ec620f56d", "whisper-base-Q8_0.gguf"), sha256: "81c069428bc8a24551a8169cf31cf09bcfd9d4cf50389ae281323c9aa9648c81", sizeBytes: 84_962_880 },
  small: { file: "whisper-small-Q8_0.gguf", url: hf("whisper-small-gguf", "4afdc7942ecf1997f359deae48a63506b062eac4", "whisper-small-Q8_0.gguf"), sha256: "9b9c8811bbcc82a7766f0fb0925614bdacb0923b2cc630daeac17108b655b860", sizeBytes: 269_751_136 },
  // Whispera's pin of the same file, so a copy it already downloaded is found.
  turbo: { file: "whisper-large-v3-turbo-Q8_0.gguf", url: hf("whisper-large-v3-turbo-gguf", "d222c9f621c1128299248f2ded4d8a1820519780", "whisper-large-v3-turbo-Q8_0.gguf"), sha256: "d5e65f2b0828802ae2c231673d31982cebe3a778c95d9494a9f3efee6bd17448", sizeBytes: 886_381_824 },
};

/** The part of LocalVoice that settings, dictation and captions use; both engines provide it. */
export type LocalWhisper = {
  load(): Promise<void>;
  discover(): Promise<void>;
  status(): LocalVoiceStatus;
  readyModel(): LocalVoiceModel | null;
  choose(model: LocalVoiceModel): Promise<void>;
  startDownload(model: LocalVoiceModel): void;
  cancelDownload(): void;
  deleteModel(model: LocalVoiceModel): Promise<void>;
  warmup(): void;
  transcribe(request: { audio: Uint8Array; durationMs: number; language: string | null; words: boolean; prompt?: string }): Promise<unknown>;
  dispose(): void;
};

/** Where the preferred model is remembered; outside the class so tests use memory. */
export type PreferredStore = { load: () => Promise<LocalVoiceModel | null>; save: (model: LocalVoiceModel) => Promise<void> };

export class WhisperAsr implements LocalWhisper {
  readonly #models: Record<LocalVoiceModel, Parakeet>;
  readonly #settings: PreferredStore;
  #preferred: LocalVoiceModel = "small";
  #lastDownload: LocalVoiceModel | null = null;

  constructor(options: { dir: string; roots: () => readonly string[]; external?: ExternalModels; settings: PreferredStore; make?: (model: LocalVoiceModel) => Parakeet }) {
    this.#settings = options.settings;
    const make = options.make ?? ((model: LocalVoiceModel) => new Parakeet({ dir: join(options.dir, "gguf"), roots: options.roots, model: WHISPER_GGUF[model], vad: null, ...(options.external ? { external: options.external } : {}) }));
    this.#models = { base: make("base"), small: make("small"), turbo: make("turbo") };
  }

  async load(): Promise<void> { const saved = await this.#settings.load(); if (saved) this.#preferred = saved; }
  async discover(): Promise<void> { await Promise.all(LOCAL_VOICE_MODELS.map(model => this.#models[model].discover())); }

  readyModel(): LocalVoiceModel | null {
    if (this.#models[this.#preferred].ready) return this.#preferred;
    return LOCAL_VOICE_MODELS.find(model => this.#models[model].ready) ?? null;
  }

  status(): LocalVoiceStatus {
    const states = Object.fromEntries(LOCAL_VOICE_MODELS.map(model => [model, this.#models[model].status()])) as Record<LocalVoiceModel, ReturnType<Parakeet["status"]>>;
    const downloading = LOCAL_VOICE_MODELS.find(model => states[model].download);
    const error = this.#lastDownload ? states[this.#lastDownload].error : null;
    return {
      supported: states.base.engineReady,
      engine: "syka-asr",
      runtimeReady: states.base.engineReady,
      readyModel: this.readyModel(),
      preferred: this.#preferred,
      models: LOCAL_VOICE_MODELS.map(id => ({ id, sizeBytes: WHISPER_GGUF[id].sizeBytes, installed: states[id].installed, external: states[id].source === "external" })),
      download: downloading ? { model: downloading, phase: states[downloading].download!.phase, receivedBytes: states[downloading].download!.receivedBytes, totalBytes: states[downloading].download!.totalBytes } : null,
      error: downloading ? null : error,
      server: LOCAL_VOICE_MODELS.some(model => states[model].state === "running") ? "running" : LOCAL_VOICE_MODELS.some(model => states[model].state === "starting") ? "starting" : "stopped",
      scanning: LOCAL_VOICE_MODELS.some(model => states[model].scanning),
    };
  }

  async choose(model: LocalVoiceModel): Promise<void> {
    if (this.#preferred !== model) this.#models[this.#preferred].stop();
    this.#preferred = model;
    await this.#settings.save(model);
  }

  startDownload(model: LocalVoiceModel): void {
    if (LOCAL_VOICE_MODELS.some(other => this.#models[other].status().download)) throw new Error("Ya hay una descarga en curso. Esperá a que termine o cancelala.");
    this.#lastDownload = model;
    this.#models[model].startDownload();
  }
  cancelDownload(): void { for (const model of LOCAL_VOICE_MODELS) this.#models[model].cancelDownload(); }
  async deleteModel(model: LocalVoiceModel): Promise<void> { await this.#models[model].remove(); }
  warmup(): void { const model = this.readyModel(); if (model) this.#models[model].warmup(); }

  /** Dictation gets the text. Captions need per-word times, which Whisper does not give through transcribe.cpp. */
  async transcribe(request: { audio: Uint8Array; durationMs: number; language: string | null; words: boolean }): Promise<unknown> {
    const model = this.readyModel();
    if (!model) throw new Error("Descargá un modelo de Whisper en Configuración › Voz y transcripción.");
    const result = await this.#models[model].transcribe(request.audio, { language: request.language });
    if (request.words && !result.wordLevel) throw new Error("En este sistema Whisper no da el tiempo de cada palabra. Para subtítulos usá Parakeet v3.");
    return { text: result.text, segments: result.words.map(word => ({ text: word.text, start: word.start_ms / 1000, end: word.end_ms / 1000 })) };
  }

  dispose(): void { for (const model of LOCAL_VOICE_MODELS) { this.#models[model].cancelDownload(); this.#models[model].stop(); } }
}
