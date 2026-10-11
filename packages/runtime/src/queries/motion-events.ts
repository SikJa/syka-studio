import { parseSource } from '@diffusionstudio/jsx';
import { Audio, Computed, FrameRate, Geometry, Group, Source } from '../traits';
import { store } from '../world/store';
import { getEntityTree } from './hierarchy';
import type { Entity, World } from 'koota';

export type MotionEventAnchor = { id: string; element: string; edge: 'start' | 'end'; offsetSeconds?: number };

/** Resolve IDs against native computed timing, including trims and nested placement. Never another clock. */
export function resolveMotionEvents(world: World, anchors: MotionEventAnchor[], scope?: Entity) {
  const fps = world.get(FrameRate)?.value ?? 30;
  const computed = store(world, Computed);
  const entities = (scope ? getEntityTree(world, scope) : [...world.query(Source)]).filter(entity => entity.has(Source) && (entity.has(Geometry) || entity.has(Group) || entity.has(Audio)));
  const ids = new Set<string>();
  return anchors.map(anchor => {
    if (!anchor.id || ids.has(anchor.id) || !['start', 'end'].includes(anchor.edge)
        || !Number.isFinite(anchor.offsetSeconds ?? 0)) throw Error('Invalid or duplicate motion event.');
    ids.add(anchor.id);
    const matches = entities.filter(entity => {
      const stamp = entity.get(Source)!.value;
      return stamp === anchor.element || parseSource(stamp)?.locator === anchor.element;
    });
    if (matches.length !== 1) return { ...anchor, status: 'unresolved' as const, seconds: null,
      reason: matches.length ? 'Ambiguous element: use its full Source stamp.' : 'Element missing from native composition.' };
    const target = matches[0]!;
    const frame = computed[anchor.edge][target.id()];
    if (!Number.isFinite(frame)) return { ...anchor, status: 'unresolved' as const, seconds: null, reason: 'Native timing is unavailable.' };
    return { ...anchor, status: 'resolved' as const, seconds: frame! / fps + (anchor.offsetSeconds ?? 0),
      element: target.get(Source)!.value, reason: null };
  });
}
