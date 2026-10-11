/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import type { Evidence, RouteDefinition, RouteIdentity, RouteObservation } from "./capabilities";
import type { HarnessInfo } from "./protocol";

export type ResearchedRoute = "claude-cli" | "claude-sdk" | "gemini-acp" | "antigravity-acp" | "hermes-acp" | "ollama" | "openai-compatible";
const docs = (reference: string): Evidence => ({ kind: "documentation", reference, observedAt: "2026-10-05T00:00:00-03:00" });

/** Research templates, deliberately not registered as executable chat harnesses. */
export function researchedRoute(kind: ResearchedRoute, identity: RouteIdentity): RouteDefinition {
  const cli = kind === "claude-cli" || kind === "gemini-acp" || kind === "antigravity-acp";
  const local = kind === "ollama" && identity.auth === "local";
  const sdkSubscription = kind === "claude-sdk" && identity.auth === "subscription";
  const consumerGemini = kind === "gemini-acp" && identity.auth === "subscription";
  const supported = (cli && identity.auth !== "local" && !consumerGemini) || local || kind === "claude-sdk" && identity.auth === "api-key";
  const reference = kind.startsWith("claude")
    ? kind === "claude-cli" ? "https://code.claude.com/docs/en/legal-and-compliance" : "https://code.claude.com/docs/en/agent-sdk/overview"
    : consumerGemini ? "https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/"
    : kind === "antigravity-acp" ? "https://antigravity.google/docs/ide/extensions"
    : kind === "gemini-acp" ? "https://geminicli.com/docs/get-started/authentication/"
    : kind === "hermes-acp" ? "https://hermes-agent.nousresearch.com/docs/user-guide/features/acp/"
    : "https://docs.ollama.com/api/openai-compatibility";
  return {
    identity, adapter: "pending", claims: {},
    authentication: {
      owner: cli ? "official-cli" : local ? "local-runtime" : "provider-api",
      flow: identity.auth === "local" ? "none" : identity.auth === "subscription" ? "official-login" : "explicit-api-key",
      eligibility: sdkSubscription ? "unsupported" : supported ? "supported" : "unverified",
      reason: sdkSubscription ? "El SDK no habilita login/cuota Claude.ai para terceros sin autorización específica."
        : consumerGemini ? "Google trasladó consumidores Free/Pro/Ultra a Antigravity. Verificar modalidad empresarial por separado."
        : cli ? "Usar el programa oficial sin modificar y su autenticación propia; no intermediar tokens ni facturación."
        : local ? "Runtime local explícito; comprobar que el modelo no derive a un servicio cloud."
        : kind === "claude-sdk" ? "API del usuario; costo separado de la suscripción y selección explícita."
        : "Verificar proveedor, endpoint y flujo oficial: el arnés no acredita el derecho a usar una suscripción.",
      evidence: [docs(reference)],
    },
  };
}

/** Reuse the existing passive probe result without launching anything or reading auth files.
 * Does not claim vision or image generation from model/list or a feature flag.
 */
export function codexCapabilityRoutes(info: HarnessInfo, accountSlot: string, observedAt: string): {
  routes: RouteDefinition[]; observations: RouteObservation[];
} {
  if (info.id !== "codex") return { routes: [], observations: [] };
  const source: Evidence = { kind: "source", reference: "packages/agent-chat/src/host/codex.ts@dd9f7862bc9aabeb1418f0e7d933a69ed07c1115", observedAt };
  const probe: Evidence = { kind: "passive-probe", reference: "CodexHarness.probe: account/read + model/list", observedAt };
  const routes: RouteDefinition[] = info.models.map(model => ({
    identity: { provider: "openai", harness: "codex", model: model.id, endpoint: "codex-app-server", auth: "subscription", accountSlot },
    adapter: "implemented",
    authentication: { owner: "official-cli", flow: "official-login", eligibility: "supported", reason: "Ruta existente Codex con autenticación ChatGPT.", evidence: [source] },
    claims: {
      text: { supported: true, reason: "Ruta de texto implementada; no demuestra un turno real con esta cuenta.", evidence: [source] },
      toolCalling: { supported: true, reason: "Herramientas dinámicas y MCP implementados en CodexHarness.", evidence: [source] },
      cancel: { supported: true, reason: "Interrupción implementada en CodexHarness.", evidence: [source] },
      resume: { supported: true, reason: "Retoma nativa con recuperación por contexto local si falla; no migración entre arneses.", evidence: [source] },
    },
  }));
  const expiresAt = new Date(Date.parse(observedAt) + 60_000).toISOString();
  const observations: RouteObservation[] = routes.map((route, index) => {
    const model = info.models[index]!;
    return {
      identity: route.identity, observedAt, expiresAt,
      configuration: info.status === "ready" ? "ready" : info.status === "signed-out" || info.status === "not-installed" ? "missing" : "unknown",
      reason: info.detail ?? "Estado obtenido por el probe existente de Codex.", evidence: [probe],
      claims: {
        ...(model.efforts ? { effort: { supported: model.efforts.length > 0, reason: "Esfuerzos anunciados para este modelo por model/list.", evidence: [probe] } } : {}),
        ...(model.supportsFast !== undefined ? { fast: { supported: model.supportsFast, reason: "Velocidad anunciada por el probe para este modelo; no garantiza cuota.", evidence: [probe] } } : {}),
      },
    };
  });
  return { routes, observations };
}
