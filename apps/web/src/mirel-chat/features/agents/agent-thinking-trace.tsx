/** @jsxImportSource react */
import type { AgentOperationalActivity } from "./syka-contracts";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { SYKA_ORB_STATE } from '@/lib/syka-brand';
import { useOrbTheme } from './use-orb-theme';
import { useEffect, useLayoutEffect, useRef, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";

export type AgentThinkingVariant = "steps" | "reasoning";

export function isReasoningActivity(activity: AgentOperationalActivity): boolean {
  return activity.kind === "status" && /(?:think|reason|plan|analiz|pens|razon|reflex|evalu)/iu.test(`${activity.label} ${activity.summary ?? ""}`);
}

export function AgentThinkingTrace({ activities, variant }: { activities: readonly AgentOperationalActivity[]; variant: AgentThinkingVariant }) {
  const busy = activities.some((activity) => activity.state === "started" || activity.state === "progress");
  const failed = activities.some((activity) => activity.state === "failed");
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const expanded = manualExpanded ?? busy;
  const traceRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);
  useLayoutEffect(() => {
    if (traceRef.current) setLineHeight(traceRef.current.offsetHeight);
  }, [activities.length, expanded]);
  const duration = activities.reduce((total, activity) => total + (activity.durationSeconds ?? 0), 0);
  const activeLabel = variant === "reasoning" ? "Pensando" : "Organizando pasos";
  const doneLabel = failed
    ? variant === "reasoning" ? "El razonamiento encontró un problema" : "Un paso encontró un problema"
    : variant === "reasoning"
      ? `Razonó${duration ? ` durante ${formatDuration(duration)}` : ""}`
      : `${activities.length} ${activities.length === 1 ? "paso completado" : "pasos completados"}`;

  return <section className="agent-thinking-trace" data-variant={variant} data-busy={busy}>
    <button className="agent-thinking-header" type="button" aria-expanded={expanded} onClick={() => setManualExpanded((current) => !(current ?? busy))}>
      <AgentTraceOrb state={SYKA_ORB_STATE} active={busy} />
      <span role="status" className={busy ? "shimmer" : "settled"}>{busy ? activeLabel : doneLabel}</span>
      <ChevronIcon expanded={expanded} />
    </button>
    <div className="agent-thinking-expand" data-open={expanded}>
      <div>
        <div className="agent-thinking-body">
          <span className="agent-thinking-line" aria-hidden="true" style={{ height: lineHeight ? Math.max(0, lineHeight - 2) : 0 }} />
          <div ref={traceRef} className="agent-thinking-rows">
            {activities.map((activity, index) => <ThinkingRow key={activity.id} activity={activity} variant={variant} index={index} />)}
          </div>
        </div>
      </div>
    </div>
  </section>;
}

function ThinkingRow({ activity, variant, index }: { activity: AgentOperationalActivity; variant: AgentThinkingVariant; index: number }) {
  const working = activity.state === "started" || activity.state === "progress";
  const failed = activity.state === "failed";
  const primary = variant === "reasoning" ? activity.summary ?? activity.label : activity.label;
  const secondary = variant === "reasoning" ? (activity.summary ? activity.label : undefined) : activity.summary;
  const streaming = variant === "reasoning" && working;
  const visiblePrimary = useStreamingThinkingText(primary, streaming);
  return <div className="agent-thinking-row" data-state={activity.state} data-streaming={streaming} style={{ "--trace-index": index } as React.CSSProperties}>
    {variant === "steps" ? working ? <span className="agent-thinking-spinner" aria-hidden="true" /> : failed ? <ErrorIcon /> : <CheckIcon /> : null}
    <span className="agent-thinking-copy"><strong className={streaming ? "agent-thinking-streaming-text" : undefined} aria-label={streaming ? primary : undefined}>{visiblePrimary}</strong>{secondary && secondary !== primary ? <small>{secondary}</small> : null}</span>
    {typeof activity.durationSeconds === "number" ? <em>{formatDuration(activity.durationSeconds)}</em> : null}
  </div>;
}

function useStreamingThinkingText(text: string, active: boolean): string {
  const [visibleCharacters, setVisibleCharacters] = useState(text.length);

  useLayoutEffect(() => {
    const reducedMotion = typeof window !== "undefined"
      && (document.documentElement.dataset.motion === "reduced" || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setVisibleCharacters(active && !reducedMotion ? 0 : text.length);
  }, [active, text]);

  useEffect(() => {
    if (!active || visibleCharacters >= text.length) return undefined;
    const longCopy = text.length > 220;
    const timer = window.setTimeout(
      () => setVisibleCharacters((current) => Math.min(text.length, current + (longCopy ? 3 : 1))),
      longCopy ? 12 : 20,
    );
    return () => window.clearTimeout(timer);
  }, [active, text, visibleCharacters]);

  return active ? text.slice(0, visibleCharacters) : text;
}

export function AgentToolChipsTrace({ activities }: { activities: readonly AgentOperationalActivity[] }) {
  const busy = activities.some((activity) => activity.state === "started" || activity.state === "progress");
  return busy ? <AgentCodingTrace activities={activities} /> : <AgentToolChipsSummary activities={activities} />;
}

function AgentCodingTrace({ activities }: { activities: readonly AgentOperationalActivity[] }) {
  const busy = activities.some((activity) => activity.state === "started" || activity.state === "progress");
  const failed = activities.some((activity) => activity.state === "failed");
  const [open, setOpen] = useState(true);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const traceRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);
  useLayoutEffect(() => {
    if (traceRef.current) setLineHeight(traceRef.current.offsetHeight);
  }, [activities.length, open, openRows.size]);
  const toggleRow = (id: string) => setOpenRows((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return <section className="agent-coding-trace" data-busy={busy}>
    <button type="button" className="agent-coding-header" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <AgentTraceOrb state={SYKA_ORB_STATE} active={busy} />
      <span className={busy ? "shimmer" : "settled"}>{busy ? "Ejecutando herramientas" : failed ? "La ejecución encontró un problema" : `Ejecutó ${activities.length} ${activities.length === 1 ? "herramienta" : "herramientas"}`}</span>
      <ChevronIcon expanded={open} />
    </button>
    <div className="agent-coding-expand" data-open={open}><div><div className="agent-coding-body">
      <span className="agent-coding-line" aria-hidden="true" style={{ height: lineHeight ? Math.max(0, lineHeight - 2) : 0 }} />
      <div ref={traceRef} className="agent-coding-rows">
      {activities.map((activity, index) => {
        const rowOpen = openRows.has(activity.id);
        const action = toolAction(activity.label);
        const detail = toolDetail(activity);
        const diff = extractToolDiff(activity);
        return <div className="agent-tool-row" key={activity.id} data-state={activity.state} style={{ "--trace-index": index } as React.CSSProperties}>
          <button type="button" aria-expanded={rowOpen} onClick={() => toggleRow(activity.id)}>
            <strong>{action.label}</strong>
            <code>{toolSubject(activity.label, action.kind)}</code>
            {diff ? <span className="agent-tool-diff"><em>+{diff.add}</em><i>−{diff.del}</i></span> : null}
          </button>
          <div className="agent-tool-detail" data-open={rowOpen}><div><div>
            {detail.map((line) => <span key={line}>{line}</span>)}
          </div></div></div>
        </div>;
      })}
      </div>
    </div></div></div>
  </section>;
}

type ToolDiff = { id: string; file: string; add: number; del: number; detail: string[] };

function AgentToolChipsSummary({ activities }: { activities: readonly AgentOperationalActivity[] }) {
  const [open, setOpen] = useState(false);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ diff: ToolDiff; x: number; top?: number; bottom?: number } | null>(null);
  const diffs = activities.flatMap((activity) => {
    const diff = extractToolDiff(activity);
    if (!diff) return [];
    const action = toolAction(activity.label);
    return [{ id: activity.id, file: toolSubject(activity.label, action.kind), ...diff, detail: toolDetail(activity) }];
  });
  const toggleRow = (id: string) => setOpenRows((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const openPreview = (diff: ToolDiff) => (event: SyntheticEvent) => {
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const previewHeight = 43 + Math.max(1, diff.detail.length) * 19;
    const fitsBelow = rect.bottom + 6 + previewHeight <= window.innerHeight - 12;
    setPreview({
      diff,
      x: Math.max(12, Math.min(rect.left, window.innerWidth - 300)),
      ...(fitsBelow ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
    });
  };
  const closePreview = (id: string) => () => setPreview((current) => current?.diff.id === id ? null : current);

  return <section className="agent-tool-summary" aria-live="polite" data-count={activities.length}>
    <button type="button" className="agent-tool-summary-header" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <ChevronIcon expanded={open} />
      <span key={activities.length} className="agent-tool-summary-count">{activities.length} tool {activities.length === 1 ? "call" : "calls"}</span>
    </button>
    <div className="agent-tool-summary-expand" data-open={open}><div><div className="agent-tool-summary-content">
      <div className="agent-tool-summary-rows">
        {activities.map((activity, index) => {
          const rowOpen = openRows.has(activity.id);
          const action = toolAction(activity.label);
          const diff = extractToolDiff(activity);
          const detail = toolDetail(activity);
          const label = action.kind === "write" && diff ? `${action.label} ${diff.add + diff.del} líneas` : action.label;
          return <div className="agent-tool-summary-row" key={activity.id} data-state={activity.state} style={{ "--trace-index": index } as React.CSSProperties}>
            <button type="button" aria-expanded={rowOpen} onClick={() => toggleRow(activity.id)}>
              <span className="agent-tool-summary-icon"><ToolRowIcon kind={action.kind} /><ChevronIcon expanded={rowOpen} /></span>
              <strong>{label}</strong>
              <code>{toolSubject(activity.label, action.kind)}</code>
            </button>
            <div className="agent-tool-summary-detail" data-open={rowOpen}><div><div>
              {detail.map((line) => <span key={line}>{line}</span>)}
            </div></div></div>
          </div>;
        })}
      </div>
      {diffs.length ? <div className="agent-tool-diff-list">
        {diffs.map((diff, index) => <span key={diff.id}>
          <button
            type="button"
            aria-expanded={preview?.diff.id === diff.id}
            onMouseEnter={openPreview(diff)}
            onMouseLeave={closePreview(diff.id)}
            onFocus={openPreview(diff)}
            onBlur={closePreview(diff.id)}
            style={{ "--trace-index": index } as React.CSSProperties}
          >
            <code>{diff.file}</code><em>+{diff.add}</em>{diff.del > 0 ? <i>−{diff.del}</i> : null}
          </button>
        </span>)}
      </div> : null}
    </div></div></div>
    {preview && typeof document !== "undefined" ? createPortal(<div
      className="agent-tool-diff-preview"
      role="tooltip"
      style={{ left: preview.x, top: preview.top, bottom: preview.bottom }}
    >
      <header><code>{preview.diff.file}</code><span><em>+{preview.diff.add}</em>{preview.diff.del > 0 ? <i>−{preview.diff.del}</i> : null}</span></header>
      <div>{preview.diff.detail.map((line) => <span key={line}>{line}</span>)}</div>
    </div>, document.body) : null}
  </section>;
}

function toolDetail(activity: AgentOperationalActivity): string[] {
  const detail = activity.summary ? [activity.summary] : [];
  if (typeof activity.durationSeconds === "number") detail.push(`Duración: ${formatDuration(activity.durationSeconds)}`);
  if (activity.state === "failed") detail.push("La herramienta informó un error.");
  if (!detail.length) detail.push(activity.state === "started" || activity.state === "progress" ? "Ejecución en curso…" : "Ejecución completada.");
  return detail;
}

type ToolKind = "read" | "write" | "run" | "tool";

function toolAction(name: string): { label: string; kind: ToolKind } {
  if (/(?:read|fetch|search|list|inspect|view|get)/iu.test(name)) return { label: "Leer", kind: "read" };
  if (/(?:write|edit|patch|create|update|delete|move)/iu.test(name)) return { label: "Editar", kind: "write" };
  if (/(?:run|exec|shell|command|test|build)/iu.test(name)) return { label: "Ejecutar", kind: "run" };
  return { label: "Usar", kind: "tool" };
}

function humanizeToolName(name: string): string {
  return name.replace(/[_-]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function toolSubject(name: string, kind: ToolKind): string {
  const humanized = humanizeToolName(name);
  const prefixes: Record<ToolKind, RegExp> = {
    read: /^(?:read|fetch|search|list|inspect|view|get)\s+/iu,
    write: /^(?:write|edit|patch|create|update|delete|move)\s+/iu,
    run: /^(?:run|exec|shell|command|test|build)\s+/iu,
    tool: /^tool\s+/iu,
  };
  return humanized.replace(prefixes[kind], "") || humanized;
}

function extractToolDiff(activity: AgentOperationalActivity): { add: number; del: number } | null {
  const match = `${activity.label} ${activity.summary ?? ""}`.match(/\+(\d+)\s*(?:[^\d+−-]+\s*)?[−-](\d+)/u);
  return match ? { add: Number(match[1]), del: Number(match[2]) } : null;
}

function formatDuration(seconds: number): string {
  return seconds < 10 ? `${seconds.toFixed(1)} s` : `${Math.round(seconds)} s`;
}

export function AgentTraceOrb({ state, active = true }: { state: OrbState; active?: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  const theme = useOrbTheme(host);
  return <span ref={host} className="agent-trace-orb" aria-hidden="true"><ThinkingOrb state={state} size={20} theme={theme} paused={!active} /></span>;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return <svg className="agent-trace-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6" /></svg>;
}

function CheckIcon() {
  return <svg className="agent-trace-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>;
}

function ErrorIcon() {
  return <svg className="agent-trace-error" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

function ToolRowIcon({ kind }: { kind: ToolKind }) {
  if (kind === "write") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>;
  if (kind === "run") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17l6-5-6-5M12 19h8" /></svg>;
  if (kind === "read") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" /></svg>;
}
