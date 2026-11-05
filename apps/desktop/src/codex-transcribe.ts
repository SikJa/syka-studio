/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Dictation with the Codex account of this computer, after Syka Code's
 * `codexVoiceTarget` (core/features/voice/provider-targets.ts): an API key in
 * Codex's `auth.json` goes to OpenAI's transcription API, a ChatGPT session to
 * ChatGPT's own transcription endpoint. No other key is needed. It returns
 * text only, without word timings, so captions stay with Groq.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { MAIN_CHANNELS } from "./main-channels";
import { applyGlossaryToText, getSykaGlossary } from "./syka-glossary";
import type { SykaCodexVoiceStatus } from "./main-channels";
import type { mainBridge } from "./main-manager";

const CHATGPT_TRANSCRIBE = "https://chatgpt.com/backend-api/transcribe";
const OPENAI_TRANSCRIBE = "https://api.openai.com/v1/audio/transcriptions";
const MODEL = "gpt-transcribe";
const CHATGPT_AUTH_CLAIM = "https://api.openai.com/auth";
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

export type CodexVoiceTarget =
  | { style: "openai"; url: string; credential: string }
  | { style: "chatgpt"; url: string; credential: string; account: string };

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

function jwtClaims(token: string): Record<string, unknown> | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    return typeof decoded === "object" && decoded !== null ? decoded as Record<string, unknown> : null;
  } catch { return null; }
}

/** Where dictation goes with this `auth.json`, or null when Codex has no usable session. */
export function codexVoiceTarget(authJson: string | null): CodexVoiceTarget | null {
  if (authJson === null) return null;
  let auth: Record<string, unknown>;
  try {
    const parsed = JSON.parse(authJson) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    auth = parsed as Record<string, unknown>;
  } catch { return null; }
  const mode = text(auth["auth_mode"]);
  const apiKey = text(auth["OPENAI_API_KEY"]);
  if (mode === "apikey" || mode === "apiKey" || (mode === null && apiKey !== null)) {
    return apiKey === null ? null : { style: "openai", url: OPENAI_TRANSCRIBE, credential: apiKey };
  }
  const tokens = typeof auth["tokens"] === "object" && auth["tokens"] !== null ? auth["tokens"] as Record<string, unknown> : null;
  const accessToken = text(tokens?.["access_token"]);
  if (!tokens || accessToken === null) return null;
  const claims = jwtClaims(accessToken)?.[CHATGPT_AUTH_CLAIM] as Record<string, unknown> | undefined;
  const account = text(tokens["account_id"]) ?? text(claims?.["chatgpt_account_id"]);
  return account === null ? null : { style: "chatgpt", url: CHATGPT_TRANSCRIBE, credential: accessToken, account };
}

export function codexAuthFile(env: NodeJS.ProcessEnv = process.env): string {
  return join(env.CODEX_HOME || join(homedir(), ".codex"), "auth.json");
}

async function readTarget(): Promise<CodexVoiceTarget | null> {
  return codexVoiceTarget(await readFile(codexAuthFile(), "utf8").catch(() => null));
}

export function codexFailure(status: number): string {
  if (status === 401 || status === 403) return "Codex rechazó la sesión. Volvé a iniciar sesión en Codex desde Cuentas.";
  if (status === 429) return "Se alcanzó el límite de transcripción de Codex. Reintentá más tarde.";
  if (status === 413) return "El dictado es demasiado largo para Codex.";
  return `Codex no pudo transcribir (HTTP ${status}).`;
}

export async function transcribeWithCodex(target: CodexVoiceTarget, wav: Uint8Array, language: string | null, fetcher: typeof fetch = fetch): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "dictado.wav");
  form.append("model", MODEL);
  const headers: Record<string, string> = { Authorization: `Bearer ${target.credential}` };
  if (target.style === "chatgpt") {
    headers["chatgpt-account-id"] = target.account;
    headers["originator"] = "syka";
  } else {
    form.append("response_format", "json");
    if (language) form.append("language", language);
  }
  let response: Response;
  try {
    response = await fetcher(target.url, { method: "POST", redirect: "error", headers, body: form, signal: AbortSignal.timeout(120_000) });
  } catch {
    throw new Error("No se pudo conectar con Codex. Revisá la conexión a internet.");
  }
  if (!response.ok) { await response.body?.cancel(); throw new Error(codexFailure(response.status)); }
  const body = await response.json().catch(() => null) as { text?: unknown } | null;
  if (typeof body?.text !== "string") throw new Error("Codex respondió algo inesperado al transcribir.");
  return body.text.trim();
}

export function registerCodexTranscription(bridge: typeof mainBridge): void {
  let running = false;
  bridge.handle(MAIN_CHANNELS.SYKA_CODEX_VOICE_STATUS, async (): Promise<SykaCodexVoiceStatus> => {
    const target = await readTarget();
    return { available: target !== null, mode: target?.style ?? null };
  });
  bridge.handle(MAIN_CHANNELS.SYKA_CODEX_TRANSCRIBE, async (request) => {
    if (!request || !(request.audio instanceof Uint8Array) || request.audio.length < 32 || request.audio.length > MAX_AUDIO_BYTES ||
        (request.language != null && (typeof request.language !== "string" || !/^[a-z]{2,3}$/.test(request.language)))) {
      throw new Error("Audio de dictado inválido.");
    }
    if (Buffer.from(request.audio.subarray(0, 4)).toString("ascii") !== "RIFF") throw new Error("El audio preparado no es un archivo WAV válido.");
    if (running) throw new Error("Ya hay un dictado transcribiéndose con Codex.");
    running = true;
    try {
      const target = await readTarget();
      if (!target) throw new Error("Iniciá sesión en Codex desde Cuentas para dictar con Codex.");
      return { text: applyGlossaryToText(await transcribeWithCodex(target, request.audio, request.language ?? null), await getSykaGlossary()) };
    } finally { running = false; }
  });
}
