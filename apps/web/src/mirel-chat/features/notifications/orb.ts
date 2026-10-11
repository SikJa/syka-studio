import { MODE_DRAWS, resolvePreset } from 'thinking-orbs/engine';

const preset = resolvePreset('composing', 64), draw = MODE_DRAWS[preset.mode];
const canvases = new Set<HTMLCanvasElement>();
let frame = 0, last = 0, painted = 0, time = .6;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function paint(canvas: HTMLCanvasElement) {
  const size = canvas.clientWidth || 61, ratio = Math.max(2, Math.min(3, devicePixelRatio));
  if (canvas.width !== Math.ceil(size * ratio)) canvas.width = canvas.height = Math.ceil(size * ratio);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(canvas.width / 64, 0, 0, canvas.width / 64, 0, 0);
  context.clearRect(0, 0, 64, 64);
  draw(context, 64, reduced.matches ? .6 : time, true, preset.opts);
}
function tick(now: number) {
  frame = 0;
  if (document.hidden || reduced.matches || !canvases.size) { last = 0; return; }
  if (last) time += Math.min(.1, (now - last) / 1000) * preset.speed * .45;
  last = now;
  if (now - painted >= 1000 / 24) { for (const canvas of canvases) paint(canvas); painted = now; }
  frame = requestAnimationFrame(tick);
}
export function wakeOrbs() {
  if (!frame && !document.hidden && !reduced.matches && canvases.size) frame = requestAnimationFrame(tick);
}
function visibility() {
  cancelAnimationFrame(frame); frame = 0; last = 0;
  if (reduced.matches) for (const canvas of canvases) paint(canvas);
  else wakeOrbs();
}
export function attachOrb(canvas: HTMLCanvasElement) {
  const first = !canvases.size;
  canvases.add(canvas); paint(canvas); wakeOrbs();
  const resize = new ResizeObserver(() => paint(canvas)); resize.observe(canvas);
  if (first) { document.addEventListener('visibilitychange', visibility); reduced.addEventListener('change', visibility); }
  return () => {
    resize.disconnect(); canvases.delete(canvas);
    if (!canvases.size) {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', visibility);
    }
  };
}
