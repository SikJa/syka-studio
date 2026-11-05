/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** The IPC of local transcription: manage the downloads, and dictate with it. */
import { MAIN_CHANNELS } from "../main-channels";
import type { mainBridge } from "../main-manager";
import { LOCAL_VOICE_MODELS, type LocalVoiceModel } from "./assets";
import type { LocalWhisper } from "./whisper-asr";
import type { Parakeet } from "./parakeet";
import { applyGlossaryToText, getSykaGlossary, glossaryTerms } from "../syka-glossary";

const MAX_DICTATION_BYTES = 24 * 1024 * 1024;

/** `pickFolder` asks for a folder with models (the native dialog) and adds it to the searched ones. */
export function registerLocalVoice(bridge: typeof mainBridge, local: LocalWhisper, parakeet: Parakeet, pickFolder: () => Promise<string | null> = async () => null, before: Promise<unknown> = Promise.resolve()): void {
  void local.load();
  // Once the chosen folders are known, look for models other apps already have.
  void before.catch(() => undefined).then(() => Promise.all([local.discover(), parakeet.discover()]));
  const pick = async () => { if (await pickFolder()) await Promise.all([local.discover(), parakeet.discover()]); };
  bridge.handle(MAIN_CHANNELS.SYKA_LOCAL_VOICE, async (request) => {
    const model = request?.model;
    if (request?.action === "scan") { await local.discover(); return local.status(); }
    if (request?.action === "pickFolder") { await pick(); return local.status(); }
    const needsModel = request?.action === "download" || request?.action === "delete" || request?.action === "choose";
    if (!request || (needsModel && !LOCAL_VOICE_MODELS.includes(model as LocalVoiceModel))) throw new Error("Modelo local desconocido.");
    if (request.action === "download") local.startDownload(model!);
    else if (request.action === "cancel") local.cancelDownload();
    else if (request.action === "delete") await local.deleteModel(model!);
    else if (request.action === "choose") await local.choose(model!);
    else if (request.action === "warmup") local.warmup();
    return local.status();
  });
  bridge.handle(MAIN_CHANNELS.SYKA_LOCAL_TRANSCRIBE, async (request) => {
    if (!request || !(request.audio instanceof Uint8Array) || request.audio.length < 44 || request.audio.length > MAX_DICTATION_BYTES ||
        !Number.isFinite(request.durationMs) || request.durationMs <= 0 ||
        (request.language != null && (typeof request.language !== "string" || !/^[a-z]{2,3}$/.test(request.language)))) {
      throw new Error("Audio de dictado inválido.");
    }
    if (Buffer.from(request.audio.subarray(0, 4)).toString("ascii") !== "RIFF") throw new Error("El audio preparado no es un archivo WAV válido.");
    const body = await local.transcribe({ audio: request.audio, durationMs: request.durationMs, language: request.language ?? null, words: false }) as { text: string };
    // One segment per line: a dictation is a single paragraph.
    return { text: applyGlossaryToText(body.text.replace(/\s*\n\s*/g, " ").trim(), await getSykaGlossary()) };
  });
  bridge.handle(MAIN_CHANNELS.SYKA_PARAKEET, async (request) => {
    if (request?.action === "download") parakeet.startDownload();
    else if (request?.action === "cancel") parakeet.cancelDownload();
    else if (request?.action === "delete") await parakeet.remove();
    else if (request?.action === "warmup") parakeet.warmup();
    else if (request?.action === "scan") await parakeet.discover();
    else if (request?.action === "pickFolder") await pick();
    else if (request?.action !== "status") throw new Error("Acción desconocida.");
    return parakeet.status();
  });
  bridge.handle(MAIN_CHANNELS.SYKA_PARAKEET_TRANSCRIBE, async (request) => {
    if (!request || !(request.audio instanceof Uint8Array) || request.audio.length < 44 || request.audio.length > MAX_DICTATION_BYTES ||
        (request.language != null && (typeof request.language !== "string" || !/^[a-z]{2,3}$/.test(request.language)))) {
      throw new Error("Audio de dictado inválido.");
    }
    if (Buffer.from(request.audio.subarray(0, 4)).toString("ascii") !== "RIFF") throw new Error("El audio preparado no es un archivo WAV válido.");
    const glossary = await getSykaGlossary();
    // Parakeet detects the language itself; a hint only reaches models that take one.
    const result = await parakeet.transcribe(request.audio, { language: null, vocabulary: glossaryTerms(glossary) });
    return { text: applyGlossaryToText(result.text, glossary) };
  });
}
