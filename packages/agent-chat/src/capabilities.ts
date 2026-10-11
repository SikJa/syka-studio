/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/** Browser-safe capability registry. No credentials, provider calls or fallback. */
export const CAPABILITIES = [
  "text", "toolCalling", "vision", "webSearch", "imageGeneration", "audioInput",
  "transcription", "musicGeneration", "videoInput", "effort", "fast", "cancel", "resume",
] as const;
export type Capability = typeof CAPABILITIES[number];
export type CapabilityStatus = "available" | "needs-configuration" | "unsupported" | "unknown";
export type AuthKind = "subscription" | "api-key" | "local";
export type RouteIdentity = {
  provider: string;
  harness: string;
  model: string;
  /** Public endpoint identifier, never a URL containing credentials. */
  endpoint: string;
  auth: AuthKind;
  /** Opaque identity slot; changing accounts invalidates observations. No email/token. */
  accountSlot: string;
};
export type Evidence = {
  kind: "documentation" | "source" | "passive-probe" | "fixture" | "real-turn";
  reference: string;
  observedAt: string;
};
export type CapabilityClaim = {
  supported: boolean;
  reason: string;
  evidence: readonly Evidence[];
};
export type RouteDefinition = {
  identity: RouteIdentity;
  adapter: "implemented" | "pending";
  authentication: {
    /** The original program owns login and secrets; Syka only sees status. */
    owner: "official-cli" | "provider-api" | "local-runtime";
    flow: "official-login" | "explicit-api-key" | "none";
    eligibility: "supported" | "unsupported" | "unverified";
    reason: string;
    evidence: readonly Evidence[];
  };
  claims: Partial<Record<Capability, CapabilityClaim>>;
};
export type RouteObservation = {
  identity: RouteIdentity;
  observedAt: string;
  expiresAt: string;
  configuration: "ready" | "missing" | "unknown";
  reason: string;
  evidence: readonly Evidence[];
  /** Only trusted host adapters produce these, never model prose or renderer input. */
  claims: Partial<Record<Capability, CapabilityClaim>>;
};
export type CapabilityResult = {
  status: CapabilityStatus;
  reason: string;
  evidence: readonly Evidence[];
  validation: "unverified" | "declared" | "fixture" | "passive-probe" | "real-turn";
};

export function routeKey(route: RouteIdentity): string {
  return JSON.stringify([route.provider, route.harness, route.model, route.endpoint, route.auth, route.accountSlot]);
}

function result(status: CapabilityStatus, reason: string, evidence: readonly Evidence[]): CapabilityResult {
  const validation = evidence.some(e => e.kind === "real-turn") ? "real-turn"
    : evidence.some(e => e.kind === "passive-probe") ? "passive-probe"
    : evidence.some(e => e.kind === "fixture") ? "fixture"
    : evidence.length ? "declared" : "unverified";
  return { status, reason, evidence, validation };
}

/** Absence, expiration, a different account or model never become an implicit yes. */
export function evaluateRoute(route: RouteDefinition, observation: RouteObservation | undefined, now: number): Record<Capability, CapabilityResult> {
  const fresh = observation && routeKey(observation.identity) === routeKey(route.identity)
    && Number.isFinite(now) && Date.parse(observation.observedAt) <= now
    && Date.parse(observation.expiresAt) > now
    && observation.evidence.length > 0;
  const current = fresh ? observation : undefined;
  return Object.fromEntries(CAPABILITIES.map(capability => {
    const claim = current?.claims[capability] ?? route.claims[capability];
    const auth = route.authentication;
    let value: CapabilityResult;
    if (auth.eligibility === "unsupported") {
      value = result("unsupported", auth.reason, auth.evidence);
    } else if (claim?.supported === false && claim.evidence.length) {
      value = result("unsupported", claim.reason, claim.evidence);
    } else if (route.adapter === "pending") {
      value = result("needs-configuration", "El adaptador de sesión todavía no está implementado en Syka.", claim?.evidence ?? []);
    } else if (auth.eligibility !== "supported") {
      value = result("unknown", auth.reason, auth.evidence);
    } else if (current?.configuration === "missing") {
      value = result("needs-configuration", current.reason, current.evidence);
    } else if (!current || current.configuration !== "ready") {
      value = result("unknown", current?.reason ?? "Falta un probe vigente para esta ruta, modelo y cuenta.", current?.evidence ?? []);
    } else if (!claim || !claim.evidence.length) {
      value = result("unknown", "Esta ruta no acredita la capacidad.", []);
    } else {
      // A fixture can describe support, but cannot establish live availability.
      const liveConfiguration = current.evidence.some(e => e.kind === "passive-probe" || e.kind === "real-turn");
      const liveClaim = claim.evidence.some(e => e.kind !== "fixture");
      value = result(liveConfiguration && liveClaim ? "available" : "unknown", claim.reason, claim.evidence);
    }
    return [capability, value];
  })) as Record<Capability, CapabilityResult>;
}

/** Exact identity lookup. There is deliberately no "best available" provider fallback. */
export class CapabilityRegistry {
  private readonly routes = new Map<string, RouteDefinition>();
  constructor(routes: readonly RouteDefinition[]) {
    for (const route of routes) {
      const key = routeKey(route.identity);
      if (this.routes.has(key)) throw new Error("Duplicate capability route");
      this.routes.set(key, structuredClone(route));
    }
  }
  get(identity: RouteIdentity): RouteDefinition | undefined {
    const route = this.routes.get(routeKey(identity));
    return route ? structuredClone(route) : undefined;
  }
}

export type EditorToolState = {
  edit: CapabilityResult;
  capture: CapabilityResult;
  render: CapabilityResult;
};

/** Editor tools and media services are separate from the conversation model. */
export type CapabilitySelection = {
  editorModel: RouteIdentity;
  imageTool?: RouteIdentity;
  transcriptionTool?: RouteIdentity;
  musicTool?: RouteIdentity;
};

export function resolveSelectedCapability(
  registry: CapabilityRegistry, selected: RouteIdentity | undefined, capability: Capability,
  observations: readonly RouteObservation[], now: number,
): CapabilityResult {
  if (!selected) return result("needs-configuration", "Elegí una herramienta para esta función.", []);
  const route = registry.get(selected);
  if (!route) return result("unknown", "La ruta elegida no está registrada; no se cambia de proveedor automáticamente.", []);
  const observation = observations.filter(o => routeKey(o.identity) === routeKey(selected))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
  return evaluateRoute(route, observation, now)[capability];
}
