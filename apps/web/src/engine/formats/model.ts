/** Format decisions are composition data, never a guess about editorial intent. */
export type Size = { width: number; height: number };
export type Ratio = '9:16' | '16:9' | '1:1' | '4:5' | 'custom';
export type Destination = 'none' | 'reels' | 'shorts' | 'tiktok' | 'youtube';
export type SourceFormat = Size & { ratio: Ratio; rotation: number; duration?: number };
export type FormatDecision = {
  version: 1; mode: 'auto' | 'manual'; provenance: 'first-media' | 'manual' | 'context';
  destination: Destination; revision: number; awaitingFirstMedia?: boolean; initialScene?: Size; source?: SourceFormat;
};
export const FORMAT_PROP = 'sykaFormat';
export const SOURCE_PROP = 'sykaSourceFormat';
export const PRESETS: Record<Exclude<Ratio, 'custom'>, Size> = {
  '9:16': { width: 1080, height: 1920 }, '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 }, '4:5': { width: 1080, height: 1350 },
};
export const validSize = (v: Partial<Size> | null | undefined): v is Size =>
  !!v && Number.isFinite(v.width) && Number.isFinite(v.height) && v.width! >= 2 && v.height! >= 2 && v.width! <= 16384 && v.height! <= 16384;
export function ratioOf(size: Size): Ratio {
  const ratio = size.width / size.height;
  return (Object.keys(PRESETS) as Exclude<Ratio, 'custom'>[]).find(key =>
    Math.abs(ratio / (PRESETS[key].width / PRESETS[key].height) - 1) <= 0.015) ?? 'custom';
}
/** Prefer display dimensions: these already include rotation and pixel aspect ratio. */
export function detectFormat(meta: { width?: number; height?: number; displayWidth?: number; displayHeight?: number; rotation?: number; duration?: number; dimensionsAreDisplay?: boolean }): SourceFormat | undefined {
  const rotation = Number.isFinite(meta.rotation) ? ((meta.rotation! % 360) + 360) % 360 : 0;
  let size = { width: meta.displayWidth ?? meta.width!, height: meta.displayHeight ?? meta.height! };
  if (!validSize(size)) return;
  if (meta.displayWidth === undefined && !meta.dimensionsAreDisplay && (rotation === 90 || rotation === 270)) size = { width: size.height, height: size.width };
  size = { width: Math.round(size.width), height: Math.round(size.height) };
  return { ...size, rotation, ratio: ratioOf(size), ...(Number.isFinite(meta.duration) && meta.duration! >= 0 ? { duration: meta.duration } : {}) };
}
export function parseDecision(value: unknown): FormatDecision | undefined {
  try {
    const v = typeof value === 'string' ? JSON.parse(value) : undefined;
    if (v?.version !== 1 || !['auto', 'manual'].includes(v.mode) || !['first-media', 'manual', 'context'].includes(v.provenance) || !['none', 'reels', 'shorts', 'tiktok', 'youtube'].includes(v.destination) || !Number.isSafeInteger(v.revision) || v.revision < 0) return;
    return { version: 1, mode: v.mode, provenance: v.provenance, destination: v.destination, revision: v.revision,
      awaitingFirstMedia: v.awaitingFirstMedia === true, ...(validSize(v.initialScene) ? { initialScene: v.initialScene } : {}), source: v.source && detectFormat({ ...v.source, dimensionsAreDisplay: true }) };
  } catch { return; }
}
export function canAdopt(decision: FormatDecision | undefined, visualCount: number): boolean {
  return decision?.mode === 'auto' && decision.awaitingFirstMedia === true && visualCount === 0;
}
export type LayoutNode = { id: string; tag: string; props: Record<string, unknown>; children: LayoutNode[]; bounds?: Size };
export type Change = { id: string; props: Record<string, number | string> };
export type AdaptationPlan = { from: Size; to: Size; changes: Change[]; warnings: string[] };
const num = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), Math.max(min, max));
/** Static supported native primitives only. Complex/animated subtrees are explicitly preserved. */
export function planAdaptation(from: Size, to: Size, nodes: LayoutNode[], fit: 'fit' | 'fill' = 'fit'): AdaptationPlan {
  if (!validSize(from) || !validSize(to)) throw new Error('Medidas inválidas (2–16384 px).');
  const changes: Change[] = [], warnings: string[] = [];
  if (from.width === to.width && from.height === to.height) return { from, to, changes, warnings };
  const sx = to.width / from.width, sy = to.height / from.height;
  const safe = { x: to.width * .07, y: to.height * .1, width: to.width * .86, height: to.height * .75 };
  for (const n of nodes) {
    const p = n.props;
    if (['solidPaint', 'audio'].includes(n.tag)) continue;
    if (n.tag === 'captions') {
      const box = n.bounds;
      if (!validSize(box) || n.children.length) { warnings.push('Subtítulos: esperá a que carguen; si tienen animación, ajustalos manualmente.'); continue; }
      const scale = Math.min(1, safe.width / box.width, safe.height / box.height);
      changes.push({ id: n.id, props: { verticalAlign: 'bottom', offsetX: 0, offsetY: 0, scale,
        x: (to.width - box.width) / 2, y: to.height * .85 - box.height * (1 + scale) / 2 } });
      warnings.push('Subtítulos: caja nativa dentro del área de lectura; revisá legibilidad en la resolución final.');
      continue;
    }
    const unsafe = p.constrainX !== undefined || p.constrainY !== undefined || n.children.some(c => !['solidPaint', 'imagePaint', 'videoPaint'].includes(c.tag)) ||
      ['x','y','width','height','scale','scaleX','scaleY','rotation','offsetX','offsetY'].some(k => p[k] !== undefined && typeof p[k] !== 'number') ||
      num(p.rotation, 0) !== 0 || num(p.scale, 1) !== 1 || num(p.scaleX, 1) !== 1 || num(p.scaleY, 1) !== 1 || num(p.offsetX, 0) !== 0 || num(p.offsetY, 0) !== 0;
    if (!['rect', 'text'].includes(n.tag) || unsafe) {
      warnings.push(`${String(p.name ?? n.tag)}: composición, anclas relativas o animación no soportada; se conserva sin cambios.`); continue;
    }
    const w = num(p.width, n.bounds?.width ?? 0), h = num(p.height, n.bounds?.height ?? 0);
    if (!validSize({ width: w, height: h })) { warnings.push(`${String(p.name ?? n.tag)}: sin tamaño medible; se conserva.`); continue; }
    const x = num(p.x, 0), y = num(p.y, 0);
    const media = n.children.some(c => ['videoPaint', 'imagePaint'].includes(c.tag));
    if (!media && n.tag === 'rect' && w >= from.width * .99 && h >= from.height * .99 && x === 0 && y === 0 && n.children.every(c => c.tag === 'solidPaint')) {
      changes.push({ id: n.id, props: { x: 0, y: 0, width: to.width, height: to.height } }); continue;
    }
    const background = media && w >= from.width * .9 && h >= from.height * .9;
    if (background) {
      const scale = (fit === 'fill' ? Math.max : Math.min)(to.width / w, to.height / h);
      changes.push({ id: n.id, props: { width: w * scale, height: h * scale, x: (to.width - w * scale) / 2, y: (to.height - h * scale) / 2 } });
      if (fit === 'fill') warnings.push(`${String(p.name ?? 'Medio')}: recorte centrado; revisá el sujeto (sin seguimiento facial).`);
      continue;
    }
    const scale = Math.min(sx, sy, safe.width / w, safe.height / h);
    let width = w * scale, height = h * scale;
    const next: Record<string, number | string> = {};
    if (n.tag === 'text') {
      width = Math.min(safe.width, Math.max(width, w * sx));
      next.fontSize = Math.max(Math.min(to.width, to.height) * .025, num(p.fontSize, 48) * Math.min(sx, sy));
      height = Math.min(safe.height, Math.max(height, h * (w / width) * (Number(next.fontSize) / num(p.fontSize, 48))));
      warnings.push(`${String(p.name ?? 'Texto')}: reflujo de caja; revisá desborde y cortes de línea.`);
    }
    // Infer left/center/right and top/center/bottom anchors from the original center.
    const ax = (x + w / 2) / from.width, ay = (y + h / 2) / from.height;
    const anchored = (a: number, start: number, extent: number, size: number) => a < .33 ? start : a > .67 ? start + extent - size : start + (extent - size) / 2;
    changes.push({ id: n.id, props: { ...next, width, height,
      x: clamp(anchored(ax, safe.x, safe.width, width), safe.x, safe.x + safe.width - width),
      y: clamp(anchored(ay, safe.y, safe.height, height), safe.y, safe.y + safe.height - height) } });
  }
  return { from, to, changes, warnings };
}
/** Future approved onboarding context; no brand/provider secrets or implicit adoption. */
export type ApprovedFormatContext = { revision: number; destination?: Destination; size?: Size; approved: true };
export function formatOutput(sceneId: string, scene: Size, decision?: FormatDecision) {
  return { version: 1 as const, sceneId, scene: { ...scene, ratio: ratioOf(scene) }, source: decision?.source,
    destination: decision?.destination ?? 'none', provenance: decision?.provenance ?? 'existing-scene',
    revision: decision?.revision ?? 0, mode: decision?.mode ?? 'manual', editorialIntent: undefined as string | undefined };
}
