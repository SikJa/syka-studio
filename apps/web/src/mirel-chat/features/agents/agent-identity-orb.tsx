/** @jsxImportSource react */
import { useEffect, useRef, useState } from "react";
import { type OrbState } from "thinking-orbs";
import {AgentOrbCanvas} from './agent-orb-canvas';
import type { MirelAgentProfile } from "./agent-catalog.js";
import "./agent-identity-orb.css";
import { useOrbTheme } from './use-orb-theme';

export type AgentIdentityOrbVariant = "sidebar" | "header" | "hero" | "message" | "modal";

export function AgentIdentityOrb({ agent, variant, working = false, state, paused = false }: {
  agent: MirelAgentProfile;
  variant: AgentIdentityOrbVariant;
  working?: boolean;
  state?: OrbState;
  paused?: boolean;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const theme = useOrbTheme(host);
  const size = variant === "hero" || variant === "modal" ? 64 : 20;
  const speed = working ? 0.9 : variant === "hero" ? 0.45 : variant === "modal" ? 0.5 : 0.62;
  const orbState = state ?? agent.orbState;
  return (
    <span
      ref={host}
      className={`agent-identity-orb agent-identity-orb-${variant}`}
      data-agent={agent.key}
      data-orb-state={orbState}
      data-orb-theme={theme}
      data-orb-speed={speed}
      aria-hidden="true"
    >
      <AgentOrbCanvas state={orbState} preset={size} theme={theme} speed={speed} paused={paused} />
    </span>
  );
}

type VisibilityListener = (visible: boolean) => void;
const messageOrbListeners = new Map<Element, VisibilityListener>();
let messageOrbObserver: IntersectionObserver | null = null;

function observeMessageOrb(element: Element, listener: VisibilityListener): () => void {
  if (typeof IntersectionObserver === "undefined") {
    listener(true);
    return () => undefined;
  }
  messageOrbObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) messageOrbListeners.get(entry.target)?.(entry.isIntersecting);
  }, { rootMargin: "72px 0px" });
  messageOrbListeners.set(element, listener);
  messageOrbObserver.observe(element);
  return () => {
    messageOrbObserver?.unobserve(element);
    messageOrbListeners.delete(element);
    if (messageOrbListeners.size === 0) {
      messageOrbObserver?.disconnect();
      messageOrbObserver = null;
    }
  };
}

export function AgentResponseOrb({ agent, reducedMotion = false }: {
  agent: MirelAgentProfile;
  reducedMotion?: boolean;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    return observeMessageOrb(element, setNearViewport);
  }, []);

  return (
    <span
      ref={hostRef}
      className="agent-response-orb-slot"
      data-agent={agent.key}
      data-orb-state={agent.orbState}
      data-orb-renderer={nearViewport ? "live" : "static"}
      aria-hidden="true"
    >
      {nearViewport
        ? <AgentIdentityOrb agent={agent} variant="message" paused={reducedMotion} />
        : <span className="agent-response-orb-static"><i /><i /><i /></span>}
    </span>
  );
}
