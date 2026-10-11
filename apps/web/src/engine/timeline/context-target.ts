import { AdjustmentLayer, Geometry, Group, Selected } from '@diffusionstudio/runtime';
import { Or } from 'koota';
import { getDocumentEditor } from '../editor';
import type { Entity, World } from 'koota';

/** Regions are scoped to their rendered entity. Ruler/playhead/keyframes are not clips. */
export function contextClip(world: World, region: string | null): Entity | undefined {
	const scope = region?.split('/')[0];
	if (!scope || !/^\d+$/.test(scope)) return undefined;
	return world.query(Or(Geometry, Group, AdjustmentLayer)).find(entity => entity.isAlive() && String(entity.id()) === scope);
}

/** Right-clicking a selected member preserves the group; another clip targets only itself. */
export function selectContextClip(world: World, target: Entity | undefined): Entity[] {
	if (!target?.isAlive()) return [];
	const selected = [...world.query(Selected)];
	if (selected.includes(target)) return selected;
	getDocumentEditor(world).select(target);
	return [target];
}
