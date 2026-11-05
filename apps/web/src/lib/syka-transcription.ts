/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, OggOutputFormat, Output, WavOutputFormat } from "mediabunny";
import { voicePrefs } from "./voice-prefs";
import { MAIN_CHANNELS } from "@desktop/main-channels";
import { mainBridge } from "./ipc";
import type { SykaTranscriptSegment } from "@desktop/main-channels";
import { notifyOperation } from './studio-notifications';
import { isAuthenticationError } from '../../../../packages/agent-chat/src/notifications';

const CHUNK_SECONDS = 600;
const MAX_SECONDS = 24 * 60 * 60;

/** Check before resolving/reading media, so missing credentials fail clearly. */
export async function requireGroqTranscription(): Promise<{ active: string }> {
  if (!window.desktop) throw new Error("La transcripción está disponible desde la aplicación de escritorio de Syka.");
  const status = await mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_STATUS, undefined);
  if (!status.configured) throw new Error(status.active === "parakeet" ? "Descargá Parakeet v3 en Configuración › Voz y transcripción." : status.active === "local" ? "Descargá un modelo en Configuración › Voz y transcripción para transcribir en este equipo." : "Elegí quién transcribe y conectá su clave en Configuración › Voz y transcripción.");
  return status;
}

/** Audio stays local during preparation; only these bounded chunks go to Groq. */
export async function transcribeWithGroq(blob: Blob, signal?: AbortSignal, project?: { dir: string }): Promise<SykaTranscriptSegment[]> {
  // On this computer whisper.cpp reads WAV; the services take compact OGG chunks.
  const active = (await requireGroqTranscription()).active;
  const wav = active === "local" || active === "parakeet";

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
  const operationId = crypto.randomUUID();
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !await track.canDecode()) throw new Error("El archivo no tiene una pista de audio que este equipo pueda decodificar.");
    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_SECONDS) throw new Error("Elegí audio o video con duración conocida de hasta 24 horas.");
    const segments: SykaTranscriptSegment[] = [];
    for (let offset = 0; offset < duration; offset += CHUNK_SECONDS) {
      signal?.throwIfAborted();
      const end = Math.min(offset + CHUNK_SECONDS, duration);
      const output = new Output({ format: wav ? new WavOutputFormat() : new OggOutputFormat(), target: new BufferTarget() });
      const conversion = await Conversion.init({
        input, output, tracks: "primary", trim: { start: offset, end },
        video: { discard: true },
        audio: wav ? { codec: "pcm-s16", numberOfChannels: 1, sampleRate: 16000 } : { codec: "opus", numberOfChannels: 1, sampleRate: 16000, bitrate: 32_000 },
      });
      if (!conversion.isValid || !conversion.utilizedTracks.length) throw new Error("No se pudo preparar el audio para transcribir.");
      await conversion.execute();
      signal?.throwIfAborted();
      if (!output.target.buffer) throw new Error("La preparación del audio produjo un archivo vacío.");
      const chunk = await mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, {
        audio: new Uint8Array(output.target.buffer), duration: end - offset, applyGlossary: false,
      });
      signal?.throwIfAborted();
      segments.push(...chunk.map((segment) => ({
        text: segment.text,
        words: segment.words.map((word) => ({ ...word, start: word.start + offset, end: word.end + offset })),
      })));
    }
    if (!segments.some((segment) => segment.words.length)) throw new Error("No se detectó habla reconocible en el audio.");
    // Correct once after merging, so a phrase can straddle caption groups or
    // ten-minute chunks. Raw provider timing stays in the reusable disk cache.
    const result = await mainBridge.call(MAIN_CHANNELS.SYKA_GLOSSARY_APPLY_TRANSCRIPT, { segments });
    return result;
  } catch (error) {
    if (project && !signal?.aborted) void notifyOperation(project, { kind: isAuthenticationError((error as Error).message) ? 'auth' : 'blocked', provider: 'groq', operationId, message: (error as Error).message });
    throw error;
  } finally { input.dispose(); }
}

/** Dictation as WAV: Codex and the local model take up to 24 MiB, about twelve minutes of 16 kHz mono speech. */
const DICTATION_MAX_SECONDS = 12 * 60;

type DictationEngineId = 'groq' | 'codex' | 'local' | 'parakeet';

/** The engine dictation uses now: the chosen one or, for `auto`, Codex when signed in, then Parakeet, Whisper on this computer, and the caption provider. */
export async function dictationEngine(): Promise<DictationEngineId | null> {
  if (!window.desktop) return null;
  const chosen = voicePrefs().engine;
  const wants = (engine: DictationEngineId) => chosen === 'auto' || chosen === engine;
  const [codex, parakeet, local, groq] = await Promise.all([
    wants('codex') ? mainBridge.call(MAIN_CHANNELS.SYKA_CODEX_VOICE_STATUS, undefined).then(value => value.available).catch(() => false) : false,
    wants('parakeet') ? mainBridge.call(MAIN_CHANNELS.SYKA_PARAKEET, { action: 'status' }).then(value => value.installed && value.engineReady).catch(() => false) : false,
    wants('local') ? mainBridge.call(MAIN_CHANNELS.SYKA_LOCAL_VOICE, { action: 'status' }).then(value => value.readyModel !== null).catch(() => false) : false,
    wants('groq') ? mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_STATUS, undefined).then(value => value.configured).catch(() => false) : false,
  ]);
  return codex ? 'codex' : parakeet ? 'parakeet' : local ? 'local' : groq ? 'groq' : null;
}

async function dictationWav(blob: Blob, signal?: AbortSignal): Promise<{ audio: Uint8Array; duration: number }> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
  try {
    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('No se detectó audio en el dictado.');
    if (duration > DICTATION_MAX_SECONDS) throw new Error('El dictado es demasiado largo: hasta 12 minutos.');
    const output = new Output({ format: new WavOutputFormat(), target: new BufferTarget() });
    const conversion = await Conversion.init({ input, output, tracks: 'primary', video: { discard: true }, audio: { codec: 'pcm-s16', numberOfChannels: 1, sampleRate: 16000 } });
    if (!conversion.isValid || !conversion.utilizedTracks.length) throw new Error('No se pudo preparar el audio del dictado.');
    await conversion.execute();
    signal?.throwIfAborted();
    if (!output.target.buffer) throw new Error('La preparación del audio produjo un archivo vacío.');
    return { audio: new Uint8Array(output.target.buffer), duration };
  } finally { input.dispose(); }
}

/** Dictation: the recording as text, with the engine of Settings › Voz y transcripción. */
export async function transcribeDictation(blob: Blob, signal?: AbortSignal): Promise<string> {
  const engine = await dictationEngine();
  if (engine === 'groq') return (await transcribeWithGroq(blob, signal)).map(segment => segment.text).join(' ').trim();
  if (!engine) throw new Error('Elegí quién transcribe el dictado en Configuración › Voz y transcripción.');
  const { audio, duration } = await dictationWav(blob, signal);
  const language = voicePrefs().language === 'auto' ? null : voicePrefs().language;
  const { text } = engine === 'parakeet'
    ? await mainBridge.call(MAIN_CHANNELS.SYKA_PARAKEET_TRANSCRIBE, { audio, language })
    : engine === 'local'
    ? await mainBridge.call(MAIN_CHANNELS.SYKA_LOCAL_TRANSCRIBE, { audio, durationMs: duration * 1000, language })
    : await mainBridge.call(MAIN_CHANNELS.SYKA_CODEX_TRANSCRIBE, { audio, language });
  signal?.throwIfAborted();
  return text;
}
