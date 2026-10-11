/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { app, safeStorage } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MAIN_CHANNELS } from "./main-channels";
import type { SykaGroqStatus, SykaTranscriptSegment } from "./main-channels";
import type { mainBridge } from "./main-manager";
import { applyGlossaryToTranscript, getSykaGlossary, glossaryPrompt } from "./syka-glossary";

export const GROQ_MODEL = "whisper-large-v3-turbo" as const;
export const GROQ_MAX_CHUNK_SECONDS = 600;
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";

/** OGG muxers randomize stream serials/CRCs; cache the actual page content. */
export function groqChunkFingerprint(audio: Uint8Array, duration: number, prompt = ""): string {
  const hash = createHash("sha256").update(GROQ_MODEL + ":v2:").update(String(duration));
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
  let previous = -1;
  const timed = words.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Palabra de transcripción inválida.");
    const word = entry as { word?: unknown; start?: unknown; end?: unknown };
    if (typeof word.word !== "string" || !word.word.trim() || word.word.length > 500 ||
        typeof word.start !== "number" || typeof word.end !== "number" ||
        !Number.isFinite(word.start) || !Number.isFinite(word.end) ||
        word.start < 0 || word.start < previous || word.end < word.start || word.end > duration + 0.5) {
      throw new Error("Groq devolvió tiempos por palabra inconsistentes.");
    }
    previous = word.start;
    return { text: word.word.trim(), start: word.start, end: word.end };
  });
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
export function registerSykaGroq(bridge: typeof mainBridge): void {
  const root = () => join(app.getPath("userData"), "providers");
  const keyPath = () => join(root(), "groq.key.encrypted");
  const cacheRoot = () => join(root(), "groq-transcripts");
  let running = false;
  groqBusy = () => running;

  const status = async (): Promise<SykaGroqStatus> => {
    let configured = false;
    if (secureStorage()) {
      try {
        const metadata = await stat(keyPath());
        if (metadata.size <= 4096) configured = Boolean(safeStorage.decryptString(await readFile(keyPath())).trim());
      } catch { /* Missing key or unreadable credentials are not configured. */ }
    }
    return { configured, secureStorage: secureStorage(), model: GROQ_MODEL };
  };

  bridge.handle(MAIN_CHANNELS.SYKA_GROQ_STATUS, status);
  bridge.handle(MAIN_CHANNELS.SYKA_GROQ_SET_KEY, async (request) => {
    if (!request || typeof request.key !== "string" || request.key.length > 1024) throw new Error("Clave de Groq inválida.");
    const key = request.key.trim();
    if (!key) { await unlink(keyPath()).catch(() => {}); return status(); }
    if (!/^gsk_[A-Za-z0-9_-]{16,}$/.test(key)) throw new Error("Ingresá una clave válida de Groq (gsk_…).");
    if (!secureStorage()) throw new Error("El almacenamiento seguro del sistema no está disponible. La clave no se guardó.");
    await mkdir(root(), { recursive: true });
    await atomicWrite(keyPath(), safeStorage.encryptString(key));
    return status();
  });

  bridge.handle(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, async (request) => {
    if (!request || !(request.audio instanceof Uint8Array) || request.audio.length < 32 ||
        request.audio.length > MAX_AUDIO_BYTES || !Number.isFinite(request.duration) ||
        request.duration <= 0 || request.duration > GROQ_MAX_CHUNK_SECONDS ||
        (request.applyGlossary !== undefined && typeof request.applyGlossary !== "boolean")) {
      throw new Error("Audio inválido: se requieren fragmentos OGG de hasta 10 minutos y 24 MiB.");
    }
    if (Buffer.from(request.audio.subarray(0, 4)).toString("ascii") !== "OggS") throw new Error("El audio preparado no es un archivo OGG válido.");
    if (running) throw new Error("Ya hay una transcripción Groq en curso. Esperá a que termine.");
    running = true;
    try {
      const glossary = await getSykaGlossary();
      const prompt = glossaryPrompt(glossary);
      const present = (segments: SykaTranscriptSegment[]) => request.applyGlossary === false ? segments : applyGlossaryToTranscript(segments, glossary);
      const fingerprint = groqChunkFingerprint(request.audio, request.duration, prompt);
      const cache = join(cacheRoot(), `${fingerprint}.json`);
      try {
        if ((await stat(cache)).size <= MAX_RESPONSE_BYTES) {
          const transcript = present(parseGroqTranscript(JSON.parse(await readFile(cache, "utf8")), request.duration));
          const now = new Date(); await utimes(cache, now, now).catch(() => {});
          return transcript;
        }
      } catch { /* Only complete validated responses may be reused. */ }
      if (!(await status()).configured) throw new Error("Configurá tu clave propia de Groq en Proveedores para transcribir. Codex usa tu suscripción por separado.");
      const key = safeStorage.decryptString(await readFile(keyPath()));
      const form = new FormData();
      form.set("file", new Blob([new Uint8Array(request.audio)], { type: "audio/ogg" }), "audio.ogg");
      form.set("model", GROQ_MODEL);
      form.set("response_format", "verbose_json");
      form.set("temperature", "0");
      if (prompt) form.set("prompt", prompt);
      form.append("timestamp_granularities[]", "word");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180_000);
      try {
        const response = await fetch(ENDPOINT, {
          method: "POST", redirect: "error", headers: { Authorization: `Bearer ${key}` }, body: form, signal: controller.signal,
        });
        if (!response.ok) {
          await response.body?.cancel();
          if (response.status === 429) throw new Error("Se alcanzó el límite de Groq. Reintentá más tarde: los fragmentos terminados ya están guardados; no se usa otro proveedor.");
          if (response.status === 401 || response.status === 403) throw new Error("Groq rechazó la clave. Revisala en Proveedores.");
          throw new Error(`Groq no pudo transcribir (HTTP ${response.status}).`);
        }
        const body = await boundedJson(response);
        const segments = parseGroqTranscript(body, request.duration);
        await mkdir(cacheRoot(), { recursive: true });
        await atomicWrite(cache, JSON.stringify({ words: segments.flatMap((segment) => segment.words.map((word) => ({ word: word.text, start: word.start, end: word.end }))) }));
        return present(segments);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw new Error("Groq excedió el tiempo de espera. Los fragmentos terminados están guardados.");
        // Fetch failures are deliberately not logged with credentials or payloads.
        if (error instanceof TypeError) throw new Error("No se pudo conectar con Groq. Revisá tu conexión y reintentá.");
        throw error;
      } finally { clearTimeout(timeout); }
    } finally { running = false; }
  });
}
