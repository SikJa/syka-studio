/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { app, safeStorage } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MAIN_CHANNELS } from "./main-channels";
import type { SykaCaptionProvider, SykaCompatibleTranscription, SykaGroqStatus, SykaKeyedProvider, SykaTranscriptSegment } from "./main-channels";
import { timedWords } from "./local-voice/local-voice";
import type { LocalWhisper } from "./local-voice/whisper-asr";
import type { Parakeet } from "./local-voice/parakeet";
import type { mainBridge } from "./main-manager";
import { applyGlossaryToTranscript, getSykaGlossary, glossaryPrompt, glossaryTerms } from "./syka-glossary";

export const GROQ_MODEL = "whisper-large-v3-turbo" as const;
export const GROQ_MAX_CHUNK_SECONDS = 600;
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
/** whisper-1 is OpenAI's transcription model that returns word timings. */
export const OPENAI_CAPTION_MODEL = "whisper-1";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";
const PROVIDERS: readonly SykaCaptionProvider[] = ["groq", "openai", "compatible", "local", "parakeet"];
const KEYED: readonly SykaKeyedProvider[] = ["groq", "openai", "compatible"];
export const CAPTION_LABEL: Record<SykaCaptionProvider, string> = { groq: "Groq", openai: "OpenAI", compatible: "El servicio compatible", local: "Whisper en este equipo", parakeet: "Parakeet v3" };

/** Validates a compatible service: https (or a local server), a model id and a short name. */
export function parseCompatible(value: unknown): SykaCompatibleTranscription {
  const input = (value ?? {}) as Partial<SykaCompatibleTranscription>;
  const name = String(input.name ?? "").trim().slice(0, 60) || "Compatible con OpenAI";
  const baseUrl = String(input.baseUrl ?? "").trim().replace(/\/+$/, "");
  const model = String(input.model ?? "").trim();
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error("La URL base no es válida."); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error("La URL base tiene que empezar con https:// (o ser un servidor local).");
  if (url.username || url.password || url.search || url.hash) throw new Error("La URL base no puede llevar usuario, parámetros ni #.");
  if (!/^[\w./:@-]{1,120}$/.test(model)) throw new Error("Escribí el id del modelo de transcripción.");
  return { name, baseUrl, model };
}

/** Model ids that look like speech-to-text, to offer first. */
const SPEECH_MODEL = /whisper|transcri|speech|stt|asr|parakeet|voxtral|canary|scribe|nova|audio/i;
/** From an OpenAI-style `GET /models` answer: the speech models, or all of them when none looks like one. */
export function transcriptionModels(body: unknown): { models: string[]; transcription: boolean } {
  const data = (body as { data?: unknown } | null)?.data;
  const ids = Array.isArray(data) ? [...new Set(data.flatMap(entry => typeof (entry as { id?: unknown })?.id === "string" ? [(entry as { id: string }).id] : []))]
    .filter(id => /^[\w./:@-]{1,120}$/.test(id)).sort() : [];
  const speech = ids.filter(id => SPEECH_MODEL.test(id));
  return speech.length ? { models: speech, transcription: true } : { models: ids.slice(0, 200), transcription: false };
}

/** The endpoint and model of each caption provider. */
export function captionTarget(provider: SykaKeyedProvider, compatible: SykaCompatibleTranscription | null): { url: string; model: string } {
  if (provider === "groq") return { url: ENDPOINT, model: GROQ_MODEL };
  if (provider === "openai") return { url: OPENAI_ENDPOINT, model: OPENAI_CAPTION_MODEL };
  if (!compatible) throw new Error("Configurá el servicio compatible en Voz y transcripción.");
  return { url: `${compatible.baseUrl}/audio/transcriptions`, model: compatible.model };
}

/** OGG muxers randomize stream serials/CRCs; cache the actual page content. */
export function groqChunkFingerprint(audio: Uint8Array, duration: number, prompt = "", model: string = GROQ_MODEL): string {
  // Groq keeps its historical key, so earlier transcripts stay reusable.
  const hash = createHash("sha256").update(model + ":v2:").update(String(duration));
  // A changed recognition hint may change the provider's words. Correction
  // variants are intentionally absent: cached raw timing can be corrected anew.
  if (prompt) hash.update(":prompt:").update(prompt);
  let position = 0;
  while (position < audio.length) {
    if (position + 27 > audio.length || Buffer.from(audio.subarray(position, position + 4)).toString("ascii") !== "OggS" || audio[position + 4] !== 0) {
      throw new Error("El audio preparado no es un archivo OGG válido.");
    }
    const count = audio[position + 26]!;
    const headerEnd = position + 27 + count;
    if (headerEnd > audio.length) throw new Error("El audio OGG tiene una página incompleta.");
    let bodyBytes = 0;
    for (let i = position + 27; i < headerEnd; i++) bodyBytes += audio[i]!;
    const end = headerEnd + bodyBytes;
    if (end > audio.length) throw new Error("El audio OGG tiene una página incompleta.");
    // Retain granules/timing, page order, packet lacing and payload. Omit only
    // the random serial (14..17) and its dependent CRC (22..25).
    hash.update(audio.subarray(position, position + 14));
    hash.update(audio.subarray(position + 18, position + 22));
    hash.update(audio.subarray(position + 26, end));
    position = end;
  }
  return hash.digest("hex");
}

/** Real word timing only. Segment-only answers must not produce invented timing. */
export function parseGroqTranscript(value: unknown, duration: number): SykaTranscriptSegment[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { words?: unknown }).words)) {
    throw new Error("Groq no devolvió tiempos por palabra; no se generaron tiempos estimados.");
  }
  const words = (value as { words: unknown[] }).words;
  if (words.length > 50_000) throw new Error("La transcripción excedió el límite de palabras.");
  let previous = 0;
  const timed: SykaTranscriptSegment["words"] = [];
  for (const entry of words) {
    if (!entry || typeof entry !== "object") throw new Error("Palabra de transcripción inválida.");
    const word = entry as { word?: unknown; start?: unknown; end?: unknown };
    if (typeof word.word !== "string" || word.word.length > 500 ||
        typeof word.start !== "number" || typeof word.end !== "number" ||
        !Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < -0.5 || word.start > duration + 0.5 ||
        word.end < word.start - 0.5 || word.end > duration + 2) {
      throw new Error("Groq devolvió tiempos por palabra inconsistentes.");
    }
    // Whisper's word timing drifts by a few hundredths on long takes: empty
    // tokens, a start just before the previous word's, an end past the chunk.
    // Those are clamped to the neighbouring real times; a start far behind the
    // previous word is not a drift, and is refused rather than repaired.
    if (!word.word.trim()) continue;
    if (word.start < previous - 0.5) throw new Error("Groq devolvió tiempos por palabra inconsistentes.");
    const start = Math.min(Math.max(word.start, previous, 0), duration);
    const end = Math.min(Math.max(word.end, start), duration);
    previous = start;
    timed.push({ text: word.word.trim(), start, end });
  }
  if (!timed.length) return [];
  // Stable small segments are useful for captions, while every timestamp stays
  // exactly as returned by Groq (seconds relative to this audio chunk).
  const segments: SykaTranscriptSegment[] = [];
  for (let i = 0; i < timed.length; i += 12) {
    const group = timed.slice(i, i + 12);
    segments.push({ text: group.map((word) => word.text).join(" "), words: group });
  }
  return segments;
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("Groq devolvió una respuesta vacía.");
  const reader = response.body.getReader();
  const pieces: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("La respuesta de Groq excedió el tamaño permitido.");
      }
      pieces.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(pieces).toString("utf8")); }
  catch { throw new Error("Groq devolvió un JSON inválido."); }
}

function secureStorage(): boolean {
  return safeStorage.isEncryptionAvailable() &&
    (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text");
}

async function atomicWrite(path: string, value: Uint8Array | string): Promise<void> {
  const tmp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, value, { mode: 0o600 });
    await rename(tmp, path);
  } finally { await unlink(tmp).catch(() => {}); }
}

let groqBusy = () => false;
export function isGroqTranscribing(): boolean { return groqBusy(); }
export function registerSykaGroq(bridge: typeof mainBridge, local?: LocalWhisper, parakeet?: Parakeet): void {
  const root = () => join(app.getPath("userData"), "providers");
  const keyFile = (provider: SykaKeyedProvider) => join(root(), `${provider}.key.encrypted`);
  const configPath = () => join(root(), "transcription.json");
  type Config = { active: SykaCaptionProvider; compatible: SykaCompatibleTranscription | null };
  const readConfig = async (): Promise<Config> => {
    try {
      const parsed = JSON.parse(await readFile(configPath(), "utf8")) as Partial<Config>;
      const active = PROVIDERS.includes(parsed.active as SykaCaptionProvider) ? parsed.active as SykaCaptionProvider : "groq";
      let compatible: SykaCompatibleTranscription | null = null;
      try { compatible = parsed.compatible ? parseCompatible(parsed.compatible) : null; } catch { compatible = null; }
      return { active, compatible };
    } catch { return { active: "groq", compatible: null }; }
  };
  const hasKey = async (provider: SykaKeyedProvider) => {
    if (!secureStorage()) return false;
    try {
      const file = keyFile(provider);
      if ((await stat(file)).size > 4096) return false;
      return Boolean(safeStorage.decryptString(await readFile(file)).trim());
    } catch { return false; }
  };
  const cacheRoot = () => join(root(), "groq-transcripts");
  let running = false;
  groqBusy = () => running;

  const status = async (): Promise<SykaGroqStatus> => {
    const config = await readConfig();
    const [groq, openai, compatible] = await Promise.all(KEYED.map(hasKey));
    const keys = { groq: groq!, openai: openai!, compatible: compatible! };
    if (config.active === "parakeet") {
      return { configured: parakeet?.ready ?? false, secureStorage: secureStorage(), model: "parakeet-tdt-0.6b-v3", active: config.active, keys, compatible: config.compatible };
    }
    if (config.active === "local") {
      const model = local?.readyModel() ?? null;
      return { configured: model !== null, secureStorage: secureStorage(), model: model ?? "", active: config.active, keys, compatible: config.compatible };
    }
    const ready = keys[config.active] && (config.active !== "compatible" || config.compatible !== null);
    const model = config.active === "compatible" ? config.compatible?.model ?? "" : captionTarget(config.active, null).model;
    return { configured: ready, secureStorage: secureStorage(), model, active: config.active, keys, compatible: config.compatible };
  };

  bridge.handle(MAIN_CHANNELS.SYKA_GROQ_STATUS, status);
  bridge.handle(MAIN_CHANNELS.SYKA_GROQ_SET_KEY, async (request) => {
    const provider = request?.provider ?? "groq";
    if (!request || typeof request.key !== "string" || request.key.length > 1024 || !KEYED.includes(provider)) throw new Error("Clave inválida.");
    const key = request.key.trim();
    if (!key) { await unlink(keyFile(provider)).catch(() => {}); return status(); }
    if (provider === "groq" && !/^gsk_[A-Za-z0-9_-]{16,}$/.test(key)) throw new Error("Ingresá una clave válida de Groq (gsk_…).");
    if (provider === "openai" && !/^sk-[A-Za-z0-9_-]{16,}$/.test(key)) throw new Error("Ingresá una clave válida de OpenAI (sk-…).");
    if (/\s/.test(key)) throw new Error("La clave no puede tener espacios.");
    if (!secureStorage()) throw new Error("El almacenamiento seguro del sistema no está disponible. La clave no se guardó.");
    await mkdir(root(), { recursive: true });
    await atomicWrite(keyFile(provider), safeStorage.encryptString(key));
    return status();
  });
  // Reads the service's model list (free, no audio) so nobody types a model id.
  bridge.handle(MAIN_CHANNELS.SYKA_TRANSCRIPTION_MODELS, async (request) => {
    if (!request || typeof request.baseUrl !== "string" || (request.key !== undefined && (typeof request.key !== "string" || request.key.length > 1024))) throw new Error("Datos inválidos.");
    const { baseUrl } = parseCompatible({ baseUrl: request.baseUrl, model: "probe" });
    let key = request.key?.trim() ?? "";
    if (!key && await hasKey("compatible")) key = safeStorage.decryptString(await readFile(keyFile("compatible"))).trim();
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/models`, { redirect: "error", headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(15_000) });
    } catch { throw new Error("No se pudo conectar con el servicio. Revisá la URL."); }
    if (response.status === 401 || response.status === 403) { await response.body?.cancel(); throw new Error("El servicio rechazó la clave."); }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`El servicio no dio su lista de modelos (HTTP ${response.status}).`); }
    const result = transcriptionModels(await boundedJson(response).catch(() => null));
    if (!result.models.length) throw new Error("El servicio no publicó modelos.");
    return result;
  });
  bridge.handle(MAIN_CHANNELS.SYKA_TRANSCRIPTION_CONFIGURE, async (request) => {
    if (!request || !PROVIDERS.includes(request.active)) throw new Error("Proveedor de transcripción desconocido.");
    const current = await readConfig();
    const compatible = request.compatible ? parseCompatible(request.compatible) : current.compatible;
    if (request.active === "compatible" && !compatible) throw new Error("Configurá la URL y el modelo del servicio compatible.");
    if (request.active === "local" && !local) throw new Error("La transcripción en este equipo no está disponible.");
    if (request.active === "parakeet" && !parakeet) throw new Error("Parakeet no está disponible en esta instalación.");
    await mkdir(root(), { recursive: true });
    await atomicWrite(configPath(), JSON.stringify({ active: request.active, compatible }, null, 2));
    return status();
  });

  bridge.handle(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, async (request) => {
    if (!request || !(request.audio instanceof Uint8Array) || request.audio.length < 32 ||
        request.audio.length > MAX_AUDIO_BYTES || !Number.isFinite(request.duration) ||
        request.duration <= 0 || request.duration > GROQ_MAX_CHUNK_SECONDS ||
        (request.applyGlossary !== undefined && typeof request.applyGlossary !== "boolean")) {
      throw new Error("Audio inválido: se requieren fragmentos OGG de hasta 10 minutos y 24 MiB.");
    }
    const config = await readConfig();
    const format = Buffer.from(request.audio.subarray(0, 4)).toString("ascii");
    const onDevice = config.active === "local" || config.active === "parakeet";
    if (onDevice ? format !== "RIFF" : format !== "OggS") throw new Error(onDevice ? "El audio preparado no es un archivo WAV válido." : "El audio preparado no es un archivo OGG válido.");
    if (running) throw new Error("Ya hay una transcripción en curso. Esperá a que termine.");
    running = true;
    try {
      const glossary = await getSykaGlossary();
      const prompt = glossaryPrompt(glossary);
      const present = (segments: SykaTranscriptSegment[]) => request.applyGlossary === false ? segments : applyGlossaryToTranscript(segments, glossary);
      if (config.active === "parakeet") {
        if (!parakeet) throw new Error("Parakeet no está disponible en esta instalación.");
        const result = await parakeet.transcribe(request.audio, { vocabulary: glossaryTerms(glossary) });
        const words = result.words.map(word => ({ word: word.text, start: word.start_ms / 1000, end: word.end_ms / 1000 }));
        return present(parseGroqTranscript({ words }, request.duration));
      }
      if (config.active === "local") {
        if (!local) throw new Error("La transcripción en este equipo no está disponible.");
        // Free and on this computer: no cache, the words come straight from whisper.cpp.
        const body = await local.transcribe({ audio: request.audio, durationMs: request.duration * 1000, language: null, words: true, prompt });
        return present(parseGroqTranscript({ words: timedWords(body) }, request.duration));
      }
      const active = config.active;
      const label = CAPTION_LABEL[active];
      const target = captionTarget(active, config.compatible);
      const fingerprint = groqChunkFingerprint(request.audio, request.duration, prompt, active === "compatible" ? `${config.compatible!.baseUrl}|${target.model}` : target.model);
      const cache = join(cacheRoot(), `${fingerprint}.json`);
      try {
        if ((await stat(cache)).size <= MAX_RESPONSE_BYTES) {
          const transcript = present(parseGroqTranscript(JSON.parse(await readFile(cache, "utf8")), request.duration));
          const now = new Date(); await utimes(cache, now, now).catch(() => {});
          return transcript;
        }
      } catch { /* Only complete validated responses may be reused. */ }
      if (!(await status()).configured) throw new Error(`Falta la clave de ${label} en Configuración › Voz y transcripción.`);
      const key = safeStorage.decryptString(await readFile(keyFile(active)));
      const form = new FormData();
      form.set("file", new Blob([new Uint8Array(request.audio)], { type: "audio/ogg" }), "audio.ogg");
      form.set("model", target.model);
      form.set("response_format", "verbose_json");
      form.set("temperature", "0");
      if (prompt) form.set("prompt", prompt);
      form.append("timestamp_granularities[]", "word");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180_000);
      try {
        const response = await fetch(target.url, {
          method: "POST", redirect: "error", headers: { Authorization: `Bearer ${key}` }, body: form, signal: controller.signal,
        });
        if (!response.ok) {
          await response.body?.cancel();
          if (response.status === 429) throw new Error(`Se alcanzó el límite de ${label}. Reintentá más tarde: los fragmentos terminados ya están guardados; no se usa otro proveedor.`);
          if (response.status === 401 || response.status === 403) throw new Error(`${label} rechazó la clave. Revisala en Voz y transcripción.`);
          throw new Error(`${label} no pudo transcribir (HTTP ${response.status}).`);
        }
        const body = await boundedJson(response);
        const segments = parseGroqTranscript(body, request.duration);
        await mkdir(cacheRoot(), { recursive: true });
        await atomicWrite(cache, JSON.stringify({ words: segments.flatMap((segment) => segment.words.map((word) => ({ word: word.text, start: word.start, end: word.end }))) }));
        return present(segments);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw new Error(`${label} excedió el tiempo de espera. Los fragmentos terminados están guardados.`);
        // Fetch failures are deliberately not logged with credentials or payloads.
        if (error instanceof TypeError) throw new Error(`No se pudo conectar con ${label}. Revisá tu conexión y reintentá.`);
        throw error;
      } finally { clearTimeout(timeout); }
    } finally { running = false; }
  });
}
