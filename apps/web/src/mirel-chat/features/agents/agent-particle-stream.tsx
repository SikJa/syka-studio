/** @jsxImportSource react */
import { useEffect, useLayoutEffect, useRef } from "react";
import { AgentRichText } from "./agent-rich-text.js";
import "./agent-particle-stream.css";

const MAX_ANIMATED_CHARACTERS = 160;
const MAX_PARTICLES_PER_BURST = 1_150;
const PARTICLE_DENSITY = 2;
const PARTICLE_SETTLE_MS = 920;

interface Particle {
  homeX: number;
  homeY: number;
  startX: number;
  startY: number;
  color: string;
  alpha: number;
  delay: number;
  size: number;
  swirl: number;
  phase: number;
}

interface CoverRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ParticleBurst {
  startedAt: number;
  duration: number;
  background: string;
  covers: CoverRect[];
  particles: Particle[];
}

interface TextSlice {
  node: Text;
  start: number;
  end: number;
}

interface GlyphSample {
  character: string;
  x: number;
  baseline: number;
  font: string;
  color: string;
}

export function particleStreamSuffixStart(previous: string, next: string, limit = MAX_ANIMATED_CHARACTERS): number {
  let shared = 0;
  const maximumShared = Math.min(previous.length, next.length);
  while (shared < maximumShared && previous[shared] === next[shared]) shared += 1;
  const appendedAt = next.startsWith(previous) ? previous.length : shared;
  return Math.max(appendedAt, next.length - Math.max(1, limit));
}

export function ParticleStreamingText({ body }: { body: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousTextRef = useRef("");
  const burstsRef = useRef<ParticleBurst[]>([]);
  const frameRef = useRef(0);
  const dprRef = useRef(1);

  const stop = (clear = false) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    if (clear) burstsRef.current = [];
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (clear && canvas && context) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.dataset.particleActive = "false";
      canvas.dataset.particleCount = "0";
    }
  };

  const sizeCanvas = () => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.ceil(root.clientWidth * dpr));
    const height = Math.max(1, Math.ceil(root.clientHeight * dpr));
    dprRef.current = dpr;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return root.clientWidth > 0 && root.clientHeight > 0;
  };

  const drawFrame = (now: number) => {
    frameRef.current = 0;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || prefersReducedMotion()) {
      stop(true);
      return;
    }

    sizeCanvas();
    const dpr = dprRef.current;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const active = burstsRef.current.filter((burst) => now - burst.startedAt < burst.duration);
    burstsRef.current = active;

    let paintedParticles = 0;
    for (const burst of active) {
      const elapsed = now - burst.startedAt;
      const coverFade = 1 - smoothstep(0.56, 0.92, elapsed / burst.duration);
      if (coverFade > 0.002) {
        context.globalAlpha = coverFade;
        context.fillStyle = burst.background;
        for (const rect of burst.covers) context.fillRect(rect.x, rect.y, rect.width, rect.height);
      }

      for (const particle of burst.particles) {
        const local = clamp01((elapsed - particle.delay) / Math.max(1, burst.duration - particle.delay));
        if (local <= 0) continue;
        const eased = 1 - ((1 - local) ** 3);
        const arc = Math.sin(local * Math.PI) * (1 - local);
        const drift = (1 - eased) * 1.8;
        const x = mix(particle.startX, particle.homeX, eased)
          + (particle.swirl * arc)
          + (Math.sin((elapsed * 0.006) + particle.phase) * drift);
        const y = mix(particle.startY, particle.homeY, eased)
          + (Math.cos((elapsed * 0.005) + particle.phase) * drift);
        const fade = 1 - smoothstep(0.88, 1, local);
        const size = mix(particle.size, PARTICLE_DENSITY * 1.18, smoothstep(0.64, 1, eased));
        context.globalAlpha = particle.alpha * fade;
        context.fillStyle = particle.color;
        if (local < 0.72) {
          context.beginPath();
          context.arc(x, y, Math.max(0.55, size * 0.5), 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillRect(x - (size * 0.5), y - (size * 0.5), size, size);
        }
        paintedParticles += 1;
      }
    }
    context.globalAlpha = 1;
    canvas.dataset.particleActive = active.length > 0 ? "true" : "false";
    canvas.dataset.particleCount = String(paintedParticles);
    if (active.length > 0) frameRef.current = requestAnimationFrame(drawFrame);
  };

  const start = () => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(drawFrame);
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    const canvas = canvasRef.current;
    if (!root || !content || !canvas) return;

    const nextText = content.textContent ?? "";
    const previousText = previousTextRef.current;
    previousTextRef.current = nextText;
    if (nextText === previousText || prefersReducedMotion() || !sizeCanvas()) {
      if (prefersReducedMotion()) stop(true);
      return;
    }

    const startAt = particleStreamSuffixStart(previousText, nextText);
    const burst = captureBurst(content, startAt, nextText.length);
    if (!burst) return;
    burstsRef.current = [...burstsRef.current.slice(-4), burst];
    canvas.dataset.particleActive = "true";
    start();
  }, [body]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => {
      sizeCanvas();
      if (burstsRef.current.length > 0) start();
    });
    observer.observe(root);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      if (prefersReducedMotion()) stop(true);
    };
    motion.addEventListener("change", onMotionChange);
    const preferences = new MutationObserver(onMotionChange);
    preferences.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", onMotionChange);
      preferences.disconnect();
      stop(true);
    };
  }, []);

  return (
    <div ref={rootRef} className="agent-particle-stream" data-particle-streaming="true">
      <div ref={contentRef} className="agent-particle-stream-content"><AgentRichText body={body} /></div>
      <canvas ref={canvasRef} className="agent-particle-stream-canvas" data-particle-active="false" data-particle-count="0" aria-hidden="true" />
    </div>
  );
}

function captureBurst(content: HTMLElement, start: number, end: number): ParticleBurst | null {
  const rootRect = content.getBoundingClientRect();
  if (rootRect.width <= 0 || rootRect.height <= 0 || start >= end) return null;

  const covers: CoverRect[] = [];
  const glyphs: GlyphSample[] = [];
  const range = document.createRange();
  for (const slice of textSlices(content, start, end)) {
    const style = getComputedStyle(slice.node.parentElement ?? content);
    const fontSize = Number.parseFloat(style.fontSize) || 12;
    const font = [style.fontStyle, style.fontVariant, style.fontWeight, style.fontSize, style.fontFamily]
      .filter((part) => part && part !== "normal")
      .join(" ");

    for (let index = slice.start; index < slice.end; index += 1) {
      const character = slice.node.data[index] ?? "";
      if (!character || character === "\n" || character === "\r") continue;
      range.setStart(slice.node, index);
      range.setEnd(slice.node, index + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const x = rect.left - rootRect.left;
      const y = rect.top - rootRect.top;
      covers.push({ x: x - 0.75, y: y - 0.75, width: rect.width + 1.5, height: rect.height + 1.5 });
      if (/\s/u.test(character)) continue;
      const baseline = y + ((rect.height - fontSize) * 0.5) + (fontSize * 0.82);
      glyphs.push({ character, x, baseline, font, color: style.color });
    }
  }
  range.detach();
  if (glyphs.length === 0 || covers.length === 0) return null;

  const left = Math.max(0, Math.floor(Math.min(...covers.map((rect) => rect.x)) - 4));
  const top = Math.max(0, Math.floor(Math.min(...covers.map((rect) => rect.y)) - 4));
  const right = Math.min(rootRect.width, Math.ceil(Math.max(...covers.map((rect) => rect.x + rect.width)) + 4));
  const bottom = Math.min(rootRect.height, Math.ceil(Math.max(...covers.map((rect) => rect.y + rect.height)) + 4));
  const raster = document.createElement("canvas");
  raster.width = Math.max(1, right - left);
  raster.height = Math.max(1, bottom - top);
  const context = raster.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.textBaseline = "alphabetic";
  for (const glyph of glyphs) {
    context.font = glyph.font;
    context.fillStyle = glyph.color;
    context.fillText(glyph.character, glyph.x - left, glyph.baseline - top);
  }

  const pixels = context.getImageData(0, 0, raster.width, raster.height).data;
  const candidates: Particle[] = [];
  for (let y = 0; y < raster.height; y += PARTICLE_DENSITY) {
    for (let x = 0; x < raster.width; x += PARTICLE_DENSITY) {
      const offset = ((y * raster.width) + x) * 4;
      const alpha = pixels[offset + 3] ?? 0;
      if (alpha < 34) continue;
      const red = pixels[offset] ?? 255;
      const green = pixels[offset + 1] ?? 255;
      const blue = pixels[offset + 2] ?? 255;
      const homeX = left + x + 0.5;
      const homeY = top + y + 0.5;
      const seed = random01((Math.round(homeX) * 73_856_093) ^ (Math.round(homeY) * 19_349_663) ^ end);
      const direction = random01((Math.round(homeX) * 83_492_791) ^ (Math.round(homeY) * 2_971_215_073) ^ start) * Math.PI * 2;
      const reach = 12 + (seed ** 1.7) * Math.min(52, Math.max(26, rootRect.width * 0.08));
      const gravity = reach * 0.35;
      candidates.push({
        homeX,
        homeY,
        startX: homeX + (Math.cos(direction) * reach),
        startY: homeY + (Math.sin(direction) * reach) + gravity,
        color: `rgb(${red} ${green} ${blue})`,
        alpha: Math.max(0.42, alpha / 255),
        delay: seed * PARTICLE_SETTLE_MS * 0.28,
        size: 0.85 + (random01((x * 31) + (y * 17) + end) * 0.65),
        swirl: (random01((x * 13) ^ (y * 41) ^ end) - 0.5) * 24,
        phase: random01((x * 53) ^ (y * 97) ^ start) * Math.PI * 2,
      });
    }
  }
  if (candidates.length === 0) return null;

  const stride = Math.max(1, Math.ceil(candidates.length / MAX_PARTICLES_PER_BURST));
  return {
    startedAt: performance.now(),
    duration: PARTICLE_SETTLE_MS,
    background: opaqueBackground(content),
    covers: mergeCoverRects(covers),
    particles: candidates.filter((_, index) => index % stride === 0).slice(0, MAX_PARTICLES_PER_BURST),
  };
}

function textSlices(root: HTMLElement, start: number, end: number): TextSlice[] {
  const slices: TextSlice[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    const nextOffset = offset + text.data.length;
    const from = Math.max(0, start - offset);
    const to = Math.min(text.data.length, end - offset);
    if (from < to) slices.push({ node: text, start: from, end: to });
    if (nextOffset >= end) break;
    offset = nextOffset;
    node = walker.nextNode();
  }
  return slices;
}

function mergeCoverRects(rects: CoverRect[]): CoverRect[] {
  const merged: CoverRect[] = [];
  for (const rect of rects) {
    const previous = merged.at(-1);
    if (previous && Math.abs(previous.y - rect.y) < 1.5 && Math.abs(previous.height - rect.height) < 2 && rect.x <= previous.x + previous.width + 2) {
      previous.width = Math.max(previous.width, (rect.x + rect.width) - previous.x);
    } else {
      merged.push({ ...rect });
    }
  }
  return merged;
}

function opaqueBackground(element: HTMLElement): string {
  let current: HTMLElement | null = element;
  while (current) {
    const color = getComputedStyle(current).backgroundColor;
    if (color && color !== "transparent" && !/^rgba\([^)]*,\s*0(?:\.0+)?\)$/u.test(color)) return color;
    current = current.parentElement;
  }
  return "rgb(14 15 13)";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return document.documentElement.dataset.motion === "reduced"
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function random01(seed: number): number {
  const value = Math.sin(seed) * 43_758.5453123;
  return value - Math.floor(value);
}

function clamp01(value: number): number { return Math.min(1, Math.max(0, value)); }
function mix(from: number, to: number, progress: number): number { return from + ((to - from) * progress); }
function smoothstep(edge0: number, edge1: number, value: number): number {
  const progress = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return progress * progress * (3 - (2 * progress));
}
