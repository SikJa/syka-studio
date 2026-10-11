import { isPointerInEntity } from '@diffusionstudio/runtime';
import type { Entity, World } from 'koota';
import { isHtmlOnlyTarget, pickHtmlTarget, type HtmlVisualTarget } from './html-visual-target';
import { nativeTargets } from './visual-target-model';
import { nativeTextTarget } from './native-text-target';

/** Walk the render stack: a full-frame transparent HTML overlay must not steal text below it. */
export function pickVisualTarget(world: World, scene: Entity, point: { x: number; y: number }): { entity: Entity; html?: HtmlVisualTarget } | null {
  for (const entity of nativeTargets(world, scene).reverse()) {
    const text = nativeTextTarget(world, entity);
    if (text) {
      if (text.contains(point)) return { entity };
      continue;
    }
    if (!isPointerInEntity(world, entity, point)) continue;
    const html = pickHtmlTarget(world, entity, point);
    if (html) return { entity, html };
    if (!isHtmlOnlyTarget(entity)) return { entity };
  }
  return null;
}
