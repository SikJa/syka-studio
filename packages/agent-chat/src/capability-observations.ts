/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import type { Capability, CapabilityClaim, Evidence } from "./capabilities";

type Claims = Partial<Record<Capability, CapabilityClaim>>;
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const claim = (supported: boolean, reason: string, evidence: Evidence): CapabilityClaim => ({ supported, reason, evidence: [evidence] });

/** Parses only ACP v1 initialize.result. This is transport support, not model support.
 * In particular promptCapabilities.image does not prove the selected model sees images.
 * Callers must intersect it with the selected model's claims before evaluating a route.
 */
export function acpTransportClaims(payload: unknown, evidence: Evidence): Claims {
  const response = object(payload);
  if (response.protocolVersion !== 1) return {};
  const capabilities = object(response.agentCapabilities);
  const prompt = object(capabilities.promptCapabilities);
  return {
    text: claim(true, "ACP v1 admite texto.", evidence),
    vision: claim(prompt.image === true, "Transporte ACP: bloques de imagen, no generación ni visión del modelo.", evidence),
    audioInput: claim(prompt.audio === true, "Transporte ACP: bloques de audio, no transcripción acreditada.", evidence),
    resume: claim(capabilities.loadSession === true, "ACP session/load anunciado por el agente.", evidence),
    cancel: claim(true, "ACP v1 define session/cancel; falta validar cancelación del proceso real.", evidence),
  };
}

/** Intersect model and transport support; neither layer can invent the other. */
export function intersectClaims(model: Claims, transport: Claims): Claims {
  const combined: Claims = {};
  for (const capability of new Set([...Object.keys(model), ...Object.keys(transport)]) as Set<Capability>) {
    const a = model[capability];
    const b = transport[capability];
    if (a?.supported === false || b?.supported === false) combined[capability] = a?.supported === false ? a : b;
    else if (a && b) combined[capability] = {
      supported: true, reason: `${a.reason} ${b.reason}`, evidence: [...a.evidence, ...b.evidence],
    };
  }
  return combined;
}

/** Ollama /api/show describes one exact model. No inference call, load or pull. */
export function ollamaModelClaims(payload: unknown, evidence: Evidence): Claims {
  const response = object(payload);
  // A cloud-backed model must not be represented as a local model.
  if (response.remote_model || response.remote_host) return {};
  if (!Array.isArray(response.capabilities) || !response.capabilities.every(c => typeof c === "string")) return {};
  const capabilities = response.capabilities as string[];
  return {
    text: claim(capabilities.includes("completion"), "Ollama /api/show: completion.", evidence),
    toolCalling: claim(capabilities.includes("tools"), "Ollama /api/show: tools; el loop de herramientas sigue siendo responsabilidad del arnés.", evidence),
    vision: claim(capabilities.includes("vision"), "Ollama /api/show: vision, independiente de generar imágenes.", evidence),
    // thinking does not establish a compatible Syka effort control.
  };
}
