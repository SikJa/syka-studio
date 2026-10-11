import { describe, expect, it } from "vitest";
import { CapabilityRegistry, evaluateRoute, resolveSelectedCapability, routeKey } from "../src/capabilities";
import type { Evidence, RouteDefinition, RouteObservation } from "../src/capabilities";
import { acpTransportClaims, intersectClaims, ollamaModelClaims } from "../src/capability-observations";
import { codexCapabilityRoutes, researchedRoute } from "../src/capability-routes";

const observedAt = "2026-10-05T10:00:00Z";
const now = Date.parse(observedAt) + 1000;
const evidence: Evidence = { kind: "passive-probe", reference: "fixture-injected endpoint response", observedAt };
const identity = { provider: "example", harness: "fixture", model: "model-a", endpoint: "local-a", auth: "local" as const, accountSlot: "slot-a" };
const route: RouteDefinition = {
  identity, adapter: "implemented",
  authentication: { owner: "local-runtime", flow: "none", eligibility: "supported", reason: "Local fixture", evidence: [evidence] },
  claims: { text: { supported: true, reason: "Text supported", evidence: [evidence] } },
};
const observation: RouteObservation = { identity, observedAt, expiresAt: "2026-10-05T10:01:00Z", configuration: "ready", reason: "Ready fixture", evidence: [evidence], claims: {} };

describe("route capability registry (simulated evidence, no providers called)", () => {
  it("requires current evidence and keeps independent capabilities unknown", () => {
    expect(evaluateRoute(route, undefined, now).text.status).toBe("unknown");
    const result = evaluateRoute(route, observation, now);
    expect(result.text.status).toBe("available");
    expect(result.text.validation).toBe("passive-probe");
    expect(result.imageGeneration.status).toBe("unknown");
  });
  it.each(["provider", "harness", "model", "endpoint", "auth", "accountSlot"] as const)("does not transfer evidence across %s", key => {
    const other = { ...observation, identity: { ...identity, [key]: key === "auth" ? "subscription" as const : "different" } };
    expect(evaluateRoute(route, other, now).text.status).toBe("unknown");
  });
  it("invalidates expired, future and undated observations", () => {
    for (const changed of [{ expiresAt: observedAt }, { observedAt: "2027-01-01" }, { observedAt: "invalid" }, { evidence: [] }]) {
      expect(evaluateRoute(route, { ...observation, ...changed }, now).text.status).toBe("unknown");
    }
  });
  it("separates missing configuration, unsupported and unverified auth", () => {
    expect(evaluateRoute(route, { ...observation, configuration: "missing" }, now).text.status).toBe("needs-configuration");
    expect(evaluateRoute({ ...route, authentication: { ...route.authentication, eligibility: "unverified" } }, observation, now).text.status).toBe("unknown");
    expect(evaluateRoute({ ...route, claims: { text: { supported: false, reason: "No", evidence: [evidence] } } }, observation, now).text.status).toBe("unsupported");
  });
  it("does not promote fixtures into live availability", () => {
    expect(evaluateRoute(route, { ...observation, evidence: [{ ...evidence, kind: "fixture" }] }, now).text.status).toBe("unknown");
  });
  it("does not select another configured provider when the chosen one is missing", () => {
    const registry = new CapabilityRegistry([route]);
    expect(resolveSelectedCapability(registry, { ...identity, endpoint: "other" }, "text", [observation], now).status).toBe("unknown");
    expect(resolveSelectedCapability(registry, undefined, "imageGeneration", [observation], now).status).toBe("needs-configuration");
  });
  it("rejects duplicate routes and protects definitions against caller mutation", () => {
    expect(() => new CapabilityRegistry([route, route])).toThrow("Duplicate");
    const registry = new CapabilityRegistry([route]);
    registry.get(identity)!.adapter = "pending";
    expect(registry.get(identity)!.adapter).toBe("implemented");
    expect(routeKey(identity)).not.toBe(routeKey({ ...identity, model: "different" }));
  });
  it("keeps an explicitly selected image service separate from the editor model", () => {
    const imageRoute: RouteDefinition = { ...route, identity: { ...identity, provider: "image-service" }, claims: { imageGeneration: { supported: true, reason: "Image service fixture", evidence: [evidence] } } };
    const registry = new CapabilityRegistry([route, imageRoute]);
    const observations = [observation, { ...observation, identity: imageRoute.identity }];
    expect(resolveSelectedCapability(registry, identity, "imageGeneration", observations, now).status).toBe("unknown");
    expect(resolveSelectedCapability(registry, imageRoute.identity, "imageGeneration", observations, now).status).toBe("available");
  });
});

describe("passive metadata translators", () => {
  it("does not treat ACP image input as model vision or image generation", () => {
    const transport = acpTransportClaims({ protocolVersion: 1, agentCapabilities: { promptCapabilities: { image: true } } }, evidence);
    expect(transport.vision?.supported).toBe(true);
    expect(transport.imageGeneration).toBeUndefined();
    expect(transport.resume?.supported).toBe(false);
    expect(intersectClaims({}, transport).vision).toBeUndefined();
    expect(intersectClaims({ vision: { supported: false, reason: "Text-only model", evidence: [evidence] } }, transport).vision?.supported).toBe(false);
  });
  it("rejects unknown ACP versions and honors omitted optional capabilities", () => {
    expect(acpTransportClaims({ protocolVersion: 2 }, evidence)).toEqual({});
    expect(acpTransportClaims({ protocolVersion: 1 }, evidence).vision?.supported).toBe(false);
  });
  it("reads Ollama model capabilities without inventing web, images or effort", () => {
    const claims = ollamaModelClaims({ capabilities: ["completion", "tools", "thinking"] }, evidence);
    expect(claims.toolCalling?.supported).toBe(true);
    expect(claims.vision?.supported).toBe(false);
    expect(claims.imageGeneration).toBeUndefined();
    expect(claims.webSearch).toBeUndefined();
    expect(claims.effort).toBeUndefined();
    expect(ollamaModelClaims({ capabilities: ["vision"], remote_model: "cloud-model" }, evidence)).toEqual({});
    expect(ollamaModelClaims({}, evidence)).toEqual({});
    expect(ollamaModelClaims({ capabilities: [true] }, evidence)).toEqual({});
  });
  it("keeps subscription SDK auth separate from unmodified CLI auth", () => {
    const id = { ...identity, auth: "subscription" as const };
    expect(evaluateRoute(researchedRoute("claude-sdk", id), undefined, now).text.status).toBe("unsupported");
    expect(researchedRoute("claude-cli", id).authentication.owner).toBe("official-cli");
    expect(researchedRoute("claude-cli", id).authentication.eligibility).toBe("supported");
    expect(evaluateRoute(researchedRoute("gemini-acp", id), undefined, now).text.status).toBe("needs-configuration");
    expect(researchedRoute("hermes-acp", id).authentication.eligibility).toBe("unverified");
  });
  it("reuses Codex probe data without promising account image generation", () => {
    const translated = codexCapabilityRoutes({ id: "codex", label: "Codex", status: "ready", models: [{ id: "exact-model", label: "Model", efforts: ["high"], supportsFast: false }] }, "account-slot", observedAt);
    const result = evaluateRoute(translated.routes[0]!, translated.observations[0], now);
    expect(result.text.status).toBe("available");
    expect(result.effort.status).toBe("available");
    expect(result.fast.status).toBe("unsupported");
    expect(result.imageGeneration.status).toBe("unknown");
    expect(result.vision.status).toBe("unknown");
    expect(evaluateRoute(translated.routes[0]!, translated.observations[0], now + 60_000).text.status).toBe("unknown");
  });
});
