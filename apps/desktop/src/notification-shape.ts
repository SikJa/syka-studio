import type { NoticeRegion } from '../../../packages/agent-chat/src/notifications';

type Rect = { x: number; y: number; width: number; height: number };

/** Native input/drawing regions in window-local DIP coordinates. */
export function notificationShape(regions: NoticeRegion[], width: number, height: number): Rect[] {
  if (!Array.isArray(regions) || regions.length > 301) throw Error('Regiones de aviso inválidas.');
  const result: Rect[] = [];
  const add = (x: number, y: number, w: number, h: number) => {
    const left = Math.max(0, Math.floor(x)), top = Math.max(0, Math.floor(y));
    const right = Math.min(width, Math.ceil(x + w)), bottom = Math.min(height, Math.ceil(y + h));
    if (right > left && bottom > top) result.push({ x: left, y: top, width: right - left, height: bottom - top });
  };
  for (const region of regions) {
    if (!region || ![region.x, region.y, region.width, region.height, region.radius].every(Number.isFinite)
      || region.width < 0 || region.height < 0 || region.radius < 0) throw Error('Regiones de aviso inválidas.');
    const { x, y, width: w, height: h } = region;
    const r = Math.min(32, region.radius, w / 2, h / 2);
    if (!r) { add(x, y, w, h); continue; }
    const rows = Math.ceil(r);
    for (let row = 0; row < rows; row++) {
      const dy = Math.max(0, r - row - 1);
      const inset = r - Math.sqrt(Math.max(0, r * r - dy * dy));
      add(x + inset, y + row, w - inset * 2, 1);
      add(x + inset, y + h - row - 1, w - inset * 2, 1);
    }
    add(x, y + rows, w, Math.max(0, h - rows * 2));
  }
  return result;
}
