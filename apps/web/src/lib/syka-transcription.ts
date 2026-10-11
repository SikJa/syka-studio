/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, OggOutputFormat, Output } from "mediabunny";
import { MAIN_CHANNELS } from "@desktop/main-channels";
import { mainBridge } from "./ipc";
import type { SykaTranscriptSegment } from "@desktop/main-channels";
import { notifyOperation } from './studio-notifications';
import { isAuthenticationError } from '../../../../packages/agent-chat/src/notifications';

const CHUNK_SECONDS = 600;
const MAX_SECONDS = 24 * 60 * 60;

/** Check before resolving/reading media, so missing credentials fail clearly. */
export async function requireGroqTranscription(): Promise<void> {
  if (!window.desktop) throw new Error("Groq está disponible desde la aplicación de escritorio de Syka.");
  const status = await mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_STATUS, undefined);
  if (!status.configured) throw new Error("Configurá tu clave propia de Groq en Proveedores para transcribir.");
}

/** Audio stays local during preparation; only these bounded chunks go to Groq. */
export async function transcribeWithGroq(blob: Blob, signal?: AbortSignal, project?: { dir: string }): Promise<SykaTranscriptSegment[]> {
  await requireGroqTranscription();

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
      const output = new Output({ format: new OggOutputFormat(), target: new BufferTarget() });
      const conversion = await Conversion.init({
        input, output, tracks: "primary", trim: { start: offset, end },
        video: { discard: true },
        audio: { codec: "opus", numberOfChannels: 1, sampleRate: 16000, bitrate: 32_000 },
      });
      if (!conversion.isValid || !conversion.utilizedTracks.length) throw new Error("No se pudo preparar el audio para Groq.");
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
    if (project) void notifyOperation(project, { kind: 'transcription', operationId, message: 'La transcripción está lista en el proyecto.' });
    return result;
  } catch (error) {
    if (project && !signal?.aborted) void notifyOperation(project, { kind: isAuthenticationError((error as Error).message) ? 'auth' : 'blocked', provider: 'groq', operationId, message: (error as Error).message });
    throw error;
  } finally { input.dispose(); }
}
