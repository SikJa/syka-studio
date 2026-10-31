/** @jsxImportSource react */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import s from "./ReasoningEffort.module.css";
import { EffortPixels } from "./EffortPixels";

const TRACK = 184;
const HEIGHT = 32;
const RADIUS = HEIGHT / 2;
const BUMP_H = 20;
const REST_W = 27.2;
const DRAG_W = 33.6;
const REST_H = 27.2;
const EDGE_PAD = (HEIGHT - REST_H) / 2;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function centerFor(value: number, count: number) {
  const span = TRACK - RADIUS * 2;
  return RADIUS + (value / Math.max(1, count - 1)) * span;
}

function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}

const LEFT_SHOULDER = 23.572;

const TEXT_SIDE = 20;

const PHI_MAX = 0.6;
const PHI_REACH = 36;

function plateauFor(textW: number) {
  return Math.max(8, textW + TEXT_SIDE * 2 - LEFT_SHOULDER * 2);
}

function smoothstep(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function capFoot(side: -1 | 1, phi: number) {
  const crown = side === -1 ? RADIUS : TRACK - RADIUS;
  return {
    x: crown + side * RADIUS * Math.sin(phi),
    y: BUMP_H + RADIUS * (1 - Math.cos(phi)),
  };
}

function shellGeom(cx: number, plateauW: number) {
  const crownL = RADIUS;
  const crownR = TRACK - RADIUS;
  let topL = cx - plateauW / 2;
  let topR = topL + plateauW;
  let phiL = 0;
  let phiR = 0;

  const overflowL = crownL - (topL - LEFT_SHOULDER);
  if (overflowL > 0) {
    phiL = PHI_MAX * smoothstep(overflowL / PHI_REACH);
    const foot = capFoot(-1, phiL);
    const minTopL = foot.x + LEFT_SHOULDER * Math.cos(phiL);
    if (topL < minTopL) {
      topR += minTopL - topL;
      topL = minTopL;
    }
  }

  const overflowR = topR + LEFT_SHOULDER - crownR;
  if (overflowR > 0) {
    phiR = PHI_MAX * smoothstep(overflowR / PHI_REACH);
    const foot = capFoot(1, phiR);
    const maxTopR = foot.x - LEFT_SHOULDER * Math.cos(phiR);
    if (topR > maxTopR) {
      topL -= topR - maxTopR;
      topR = maxTopR;
    }
  }
  const insetL = phiL > 0 ? LEFT_SHOULDER * (1 - Math.cos(phiL)) : 0;
  const insetR = phiR > 0 ? LEFT_SHOULDER * (1 - Math.cos(phiR)) : 0;
  topR += insetL;
  topL -= insetR;

  return { topL, topR, phiL, phiR, insetL, insetR };
}

function shoulderCmds(
  footX: number,
  footY: number,
  platX: number,
  platY: number,
  phi: number,
  dir: 1 | -1,
) {
  const xScale = Math.abs(platX - footX) / LEFT_SHOULDER;
  const yScale = Math.max(0.001, (footY - platY) / 20);
  const tangent = { x: dir * Math.cos(phi), y: -Math.sin(phi) };
  const map = (lx: number, ly: number) => ({
    x: footX + dir * lx * xScale,
    y: footY + (ly - 20) * yScale,
  });
  const h1 = 5.398 * xScale;
  const p0 = { x: footX, y: footY };
  const c1 = { x: footX + tangent.x * h1, y: footY + tangent.y * h1 };
  const c2 = map(10.012, 16.114);
  const p1 = map(10.93, 10.794);
  const c3 = map(11.916, 4.577);
  const c4 = map(17.277, 0);
  const p3 = { x: platX, y: platY };
  const fmt = (p: { x: number; y: number }) =>
    `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  if (dir === 1)
    return `C${fmt(c1)} ${fmt(c2)} ${fmt(p1)}C${fmt(c3)} ${fmt(c4)} ${fmt(p3)}`;
  return `C${fmt(c4)} ${fmt(c3)} ${fmt(p1)}C${fmt(c2)} ${fmt(c1)} ${fmt(p0)}`;
}

function shellPath(cx: number, open: number, plateauW: number) {
  const trackTop = BUMP_H;
  const trackBot = BUMP_H + HEIGHT;
  const crownL = RADIUS;
  const crownR = TRACK - RADIUS;
  if (open < 0.012) {
    return `M${crownL} ${trackTop}H${crownR}A${RADIUS} ${RADIUS} 0 0 1 ${crownR} ${trackBot}H${crownL}A${RADIUS} ${RADIUS} 0 0 1 ${crownL} ${trackTop}Z`;
  }

  const bumpTop = BUMP_H * (1 - open);
  const { topL, topR, phiL, phiR } = shellGeom(cx, plateauW);
  const cmds = [`M${crownL} ${trackBot}`];

  if (phiL > 0.001) {
    const foot = capFoot(-1, phiL);
    cmds.push(
      `A${RADIUS} ${RADIUS} 0 0 1 ${foot.x.toFixed(2)} ${foot.y.toFixed(2)}`,
    );
    cmds.push(shoulderCmds(foot.x, foot.y, topL, bumpTop, phiL, 1));
  } else {
    cmds.push(`A${RADIUS} ${RADIUS} 0 0 1 ${crownL} ${trackTop}`);
    const footL = topL - LEFT_SHOULDER;
    if (footL > crownL + 0.4) cmds.push(`H${footL.toFixed(2)}`);
    cmds.push(shoulderCmds(footL, trackTop, topL, bumpTop, 0, 1));
  }

  if (topR > topL + 0.4) cmds.push(`H${topR.toFixed(2)}`);

  if (phiR > 0.001) {
    const foot = capFoot(1, phiR);
    cmds.push(shoulderCmds(foot.x, foot.y, topR, bumpTop, phiR, -1));
    cmds.push(`A${RADIUS} ${RADIUS} 0 0 1 ${crownR} ${trackBot}`);
  } else {
    const footR = topR + LEFT_SHOULDER;
    cmds.push(shoulderCmds(footR, trackTop, topR, bumpTop, 0, -1));
    if (footR < crownR - 0.4) cmds.push(`H${crownR}`);
    cmds.push(`A${RADIUS} ${RADIUS} 0 0 1 ${crownR} ${trackBot}`);
  }

  cmds.push(`H${crownL}Z`);
  return cmds.join("");
}

export interface ReasoningEffortProps {
  labels: readonly string[];
  value: number;
  onValueChange: (value: number) => void;
  modelLabel?: string;
  labelledBy: string;
  disabled?: boolean;
  stretch?: number;
  orientation?: "vertical" | "horizontal";
  effect?: "ultra" | "fast";
}

export function ReasoningEffort({
  labels,
  value,
  onValueChange,
  modelLabel,
  labelledBy,
  disabled = false,
  stretch = 0,
  orientation = "horizontal",
  effect,
}: ReasoningEffortProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const emittedRef = useRef(value);
  const pointerRef = useRef<number | null>(null);
  const displayRef = useRef(value);
  const openRef = useRef(0);
  const draggingRef = useRef(false);
  const dragFrameRef = useRef(0);
  const dragFrameAtRef = useRef(0);
  const [display, setDisplay] = useState(value);
  const [open, setOpen] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [reduce, setReduce] = useState(false);
  const [textW, setTextW] = useState(64);
  const plateauTarget = plateauFor(textW);
  const plateauRef = useRef(plateauTarget);
  const [plateauW, setPlateauW] = useState(plateauTarget);
  const revealRef = useRef(0);
  const [reveal, setReveal] = useState(0);
  const gradId = useId().replace(/:/g, "");
  const settledValue = dragging ? null : value;
  const stretchAmount = clamp(stretch, 0, 100);

  useEffect(() => () => cancelAnimationFrame(dragFrameRef.current), []);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const marked = el.parentElement?.closest("[data-theme]");
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => {
      setTheme(
        marked
          ? marked.getAttribute("data-theme") === "dark"
            ? "dark"
            : "light"
          : el.closest(".dark")
            ? "dark"
            : "light",
      );
      const motion = document.documentElement.dataset.sykaMotion;
      setReduce((motion === "reduce" || motion === "reduced") || (motion !== "full" && media.matches));
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-syka-motion"],
    });
    if (marked && marked !== document.documentElement) {
      obs.observe(marked, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    }
    media.addEventListener("change", read);
    return () => {
      obs.disconnect();
      media.removeEventListener("change", read);
    };
  }, []);

  useLayoutEffect(() => {
    emittedRef.current = value;
    if (!draggingRef.current || disabled) {
      valueRef.current = value;
      displayRef.current = value;
      setDisplay(value);
    }
    if (disabled) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = 0;
      draggingRef.current = false;
      pointerRef.current = null;
      setDragging(false);
    }
  }, [value, disabled]);

  useEffect(() => {
    const toOpen = dragging ? 1 : 0;
    const fromOpen = openRef.current;
    const fromValue = displayRef.current;
    const targetValue = dragging ? fromValue : Math.round(valueRef.current);
    if (reduce) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = 0;
      openRef.current = toOpen;
      setOpen(toOpen);
      const immediateValue = dragging ? valueRef.current : targetValue;
      valueRef.current = immediateValue;
      displayRef.current = immediateValue;
      setDisplay(immediateValue);
      return;
    }
    if (!dragging && fromOpen === 0 && fromValue === targetValue) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 220);
      const e = easeOut(t);
      const nextOpen = fromOpen + (toOpen - fromOpen) * e;
      openRef.current = nextOpen;
      setOpen(nextOpen);
      if (!dragging) {
        const nextValue = fromValue + (targetValue - fromValue) * e;
        displayRef.current = nextValue;
        setDisplay(nextValue);
        if (t === 1) {
          valueRef.current = targetValue;
          displayRef.current = targetValue;
        }
      }
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [dragging, reduce, settledValue]);

  useEffect(() => {
    const from = plateauRef.current;
    const to = plateauTarget;
    if (reduce || Math.abs(to - from) < 0.3) {
      plateauRef.current = to;
      setPlateauW(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 90);
      const next = from + (to - from) * easeOut(t);
      plateauRef.current = next;
      setPlateauW(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [plateauTarget, reduce]);

  useEffect(() => {
    const to = dragging ? 1 : 0;
    const from = revealRef.current;
    if (reduce) {
      revealRef.current = to;
      setReveal(to);
      return;
    }
    const delay = dragging ? 85 : 0;
    const dur = dragging ? 132 : 90;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const elapsed = now - start - delay;
      if (elapsed < 0) {
        raf = requestAnimationFrame(step);
        return;
      }
      const t = Math.min(1, elapsed / dur);
      const next = from + (to - from) * easeOut(t);
      revealRef.current = next;
      setReveal(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [dragging, reduce]);

  function followPointer(now: number) {
    dragFrameRef.current = 0;
    if (!draggingRef.current) return;
    const elapsed = clamp(now - dragFrameAtRef.current, 1, 64);
    dragFrameAtRef.current = now;
    const target = valueRef.current;
    const next =
      displayRef.current +
      (target - displayRef.current) * (1 - Math.exp(-elapsed / 28));
    const settled = Math.abs(target - next) < 0.002;
    displayRef.current = settled ? target : next;
    setDisplay(displayRef.current);
    if (!settled) dragFrameRef.current = requestAnimationFrame(followPointer);
  }

  function commit(next: number) {
    valueRef.current = next;
    if (reduce) {
      displayRef.current = next;
      setDisplay(next);
    } else if (dragFrameRef.current === 0) {
      dragFrameAtRef.current = performance.now();
      dragFrameRef.current = requestAnimationFrame(followPointer);
    }
    const selected = Math.round(next);
    if (selected !== emittedRef.current) {
      emittedRef.current = selected;
      onValueChange(selected);
    }
  }

  function valueFrom(clientX: number, clientY: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return valueRef.current;
    const x =
      orientation === "vertical"
        ? ((rect.bottom - clientY) * TRACK) / rect.height
        : ((clientX - rect.left) * TRACK) / rect.width;
    const t = (x - RADIUS) / (TRACK - RADIUS * 2);
    return clamp(t * (labels.length - 1), 0, labels.length - 1);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      disabled ||
      draggingRef.current ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    event.currentTarget.focus({ preventScroll: true });
    pointerRef.current = event.pointerId;
    draggingRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    setDragging(true);
    commit(valueFrom(event.clientX, event.clientY));
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      disabled ||
      !draggingRef.current ||
      event.pointerId !== pointerRef.current
    )
      return;
    commit(valueFrom(event.clientX, event.clientY));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || event.pointerId !== pointerRef.current) return;
    draggingRef.current = false;
    pointerRef.current = null;
    cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = 0;
    valueRef.current = value;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {}
    setDragging(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const max = labels.length - 1;
    const current = value;
    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowUp")
      next = Math.min(max, current + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown")
      next = Math.max(0, current - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = max;
    else return;
    event.preventDefault();
    event.stopPropagation();
    if (next !== value) onValueChange(next);
  }

  const center = centerFor(display, labels.length);
  const thumbW = REST_W + (DRAG_W - REST_W) * (1 + stretchAmount / 100) * open;
  const thumbH = REST_H;
  const outerPad = EDGE_PAD;
  let thumbLeft = center - thumbW / 2;
  let thumbRight = thumbLeft + thumbW;
  if (thumbLeft < outerPad) {
    thumbLeft = outerPad;
    thumbRight = thumbLeft + thumbW;
  }
  if (thumbRight > TRACK - outerPad) {
    thumbRight = TRACK - outerPad;
    thumbLeft = thumbRight - thumbW;
  }
  const fillW = Math.min(TRACK, thumbRight + EDGE_PAD);
  const active = clamp(Math.round(display), 0, labels.length - 1);
  const level = labels[active];
  const plateau = shellGeom(center, plateauW);
  const labelX =
    (plateau.topL + plateau.topR) / 2 + (plateau.insetL - plateau.insetR) / 2;

  useLayoutEffect(() => {
    const w = labelRef.current?.offsetWidth ?? 0;
    if (w > 0 && Math.abs(w - textW) > 0.4) setTextW(w);
  }, [level, modelLabel, theme, textW]);

  return (
    <div
      ref={rootRef}
      className={s.root}
      data-orientation={orientation}
      data-effect={effect}
      data-theme={theme}
      data-dragging={dragging ? "true" : "false"}
      data-disabled={disabled ? "true" : undefined}
      data-reduced-motion={reduce ? "true" : "false"}
      data-stretch={stretchAmount}
    >
      <svg
        className={s.shell}
        viewBox={`0 0 ${TRACK} ${BUMP_H + HEIGHT}`}
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--ss-shell)" />
            <stop offset="1" stopColor="var(--ss-shell-2)" />
          </linearGradient>
        </defs>
        <path
          d={shellPath(center, open, plateauW)}
          fill={`url(#${gradId})`}
          stroke="var(--ss-line)"
          strokeWidth="0.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        ref={labelRef}
        data-effort-floating-label
        className={s.label}
        aria-hidden="true"
        style={{
          left: labelX,
          opacity: reveal,
          filter:
            reveal > 0.98
              ? undefined
              : `blur(${((1 - reveal) * 3).toFixed(2)}px)`,
          transform: `translate(-50%, ${3 * (1 - open)}px)`,
        }}
      >
        <span key={level} className={s.swap}>
          {modelLabel ? (
            <span className={s.current} title={modelLabel}>
              {modelLabel}
            </span>
          ) : null}
          <span className={s.next}>{level}</span>
        </span>
      </div>
      <div
        ref={trackRef}
        className={s.track}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelledBy}
        aria-orientation={orientation}
        aria-disabled={disabled || undefined}
        data-dragging={dragging ? "" : undefined}
        aria-valuemin={0}
        aria-valuemax={labels.length - 1}
        aria-valuenow={value}
        aria-valuetext={labels[value]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <div className={s.fill} style={{ width: fillW }}>
          {effect && (
            <EffortPixels
              kind={effect}
              vertical={orientation === "vertical"}
              width={fillW}
              reduced={reduce}
            />
          )}
        </div>
        <div
          className={s.thumb}
          style={{
            left: thumbLeft,
            width: thumbW,
            height: thumbH,
            marginTop: -thumbH / 2,
          }}
        />
        {labels.map((_, index) => {
          const x = centerFor(index, labels.length);
          const onThumb = x >= thumbLeft + 0.5 && x <= thumbRight - 0.5;
          return (
            <span
              key={index}
              className={s.tick}
              aria-hidden
              data-on-thumb={onThumb ? "true" : "false"}
              data-active={index === active && !onThumb ? "true" : "false"}
              style={{
                left: x,
                height: 4.8 + (4.8 * index) / Math.max(1, labels.length - 1),
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
