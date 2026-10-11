/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Official Codex owns sign-in and refresh. Syka supplies its current session
// to app-server in memory over stdin only; never writes or copies auth.json.
import { readFile } from "node:fs/promises";

export type ExternalChatgptTokens = { accessToken: string; chatgptAccountId: string; chatgptPlanType: string | null };

export function parseOfficialAuth(record: unknown): ExternalChatgptTokens {
  const auth = record as { auth_mode?: string; OPENAI_API_KEY?: unknown; tokens?: { access_token?: unknown; account_id?: unknown } } | null;
  if (!auth || auth.auth_mode === "apikey" || auth.OPENAI_API_KEY) throw new Error("Syka requiere tu sesión ChatGPT de Codex; las API keys están desactivadas");
  const token = auth.tokens?.access_token;
  const accountId = auth.tokens?.account_id;
  if (typeof token !== "string" || !token || typeof accountId !== "string" || !accountId) throw new Error("Iniciá sesión en Codex con `codex login` y volvé a conectar Syka");
  let plan: string | null = null;
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number; "https://api.openai.com/auth"?: { chatgpt_plan_type?: unknown } };
    if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) throw new Error("expired");
    const value = claims["https://api.openai.com/auth"]?.chatgpt_plan_type;
    if (typeof value === "string") plan = value;
  } catch (error) {
    if ((error as Error)?.message === "expired") throw new Error("La sesión Codex expiró. Reconectá desde Codex oficial y volvé a intentar; Syka no modifica tus credenciales");
  }
  return { accessToken: token, chatgptAccountId: accountId, chatgptPlanType: plan };
}

export async function readOfficialAuth(authFile: string): Promise<ExternalChatgptTokens> {
  let text: string;
  try { text = await readFile(authFile, "utf8"); } catch { throw new Error("No se encontró la sesión oficial Codex. Ejecutá `codex login` y volvé a conectar Syka"); }
  let record: unknown;
  try { record = JSON.parse(text); } catch { throw new Error("La sesión oficial Codex no se pudo leer. Reconectá desde Codex oficial"); }
  return parseOfficialAuth(record);
}
