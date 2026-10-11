import { TextCache, entityWorldMat, invert2D, isText, transformPoint } from '@diffusionstudio/runtime';
import type { Entity, World } from 'koota';
import type { CaptureBox } from './visual-target-model';

/** Use the shaped glyphs the renderer just drew, including font, alignment and line breaks. */
export function nativeTextTarget(world: World, entity: Entity): { box: CaptureBox; contains(point: { x: number; y: number }): boolean } | null {
  if (!isText(entity)) return null;
  const lines = entity.get(TextCache)?.tokens;
  if (!lines?.length) return null;
  const rects = lines.flat().filter(token => token.chars.trim() &&
    [token.left, token.right, token.top, token.bottom].every(Number.isFinite) && token.right > token.left && token.bottom > token.top);
  if (!rects.length) return null;
  const matrix = entityWorldMat(world, entity);
  if (Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) < 1e-12) return null;
  const inverse = invert2D(matrix);
  const corners = rects.flatMap(rect => [
    transformPoint(matrix, rect.left, rect.top), transformPoint(matrix, rect.right, rect.top),
    transformPoint(matrix, rect.right, rect.bottom), transformPoint(matrix, rect.left, rect.bottom),
  ]);
  const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
  return {
    box: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) },
    contains(point) {
      const local = transformPoint(inverse, point.x, point.y);
      return rects.some(rect => local.x >= rect.left && local.x <= rect.right && local.y >= rect.top && local.y <= rect.bottom);
    },
  };
}
