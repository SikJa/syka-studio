import { authoredTree, renderAuthored } from '@diffusionstudio/reconciler';
import { Computed, FrameRate, Hidden, Muted, Selected, Sequential, Source, findGeometryAsset, framesToSeconds, getParentEntity, getSourceWindow } from '@diffusionstudio/runtime';
import type { Entity, World } from 'koota';
import { getDocumentEditor } from './editor';
import { getEditHistory } from './history';
import { planAudioDetach } from './audio-detach-plan';

function prepare(world: World, entity: Entity) {
	const asset = findGeometryAsset(world, entity);
	const tree = authoredTree(world, entity);
	if (!tree || asset?.type !== 'VIDEO') return { reason: 'Seleccioná un clip de video con audio.' } as const;
	let below = entity;
	let parent = getParentEntity(below);
	while (parent?.has(Sequential)) {
		if (parent.has(Muted) || parent.has(Hidden) || (parent.get(Computed)?.volume ?? 0) !== 0) {
			return { reason: 'La secuencia tiene silencio, ocultación o volumen propio. Restablecé esos controles antes de separar audio.' } as const;
		}
		below = parent;
		parent = getParentEntity(below);
	}
	if (!parent?.get(Source)?.value) return { reason: 'El clip necesita una escena editable.' } as const;
	const plan = planAudioDetach(tree, asset.channels);
	if (!plan.audio) return plan;
	const timing = entity.get(Computed);
	const fps = world.get(FrameRate)?.value ?? 30;
	const parentOrigin = parent.get(Computed)?.origin ?? 0;
	if (!timing || ![timing.start, timing.end, timing.playbackRate, parentOrigin].every(Number.isFinite) || timing.end <= timing.start || timing.playbackRate <= 0) {
		return { reason: 'Esperá a que se resuelva la duración y la posición del clip.' } as const;
	}
	const source = getSourceWindow(entity);
	// Pin the resolved placement in the new parent's space. This also handles a
	// later sequence clip whose position came from reconciliation, not a start prop.
	Object.assign(plan.audio.props, {
		start: framesToSeconds(timing.start - parentOrigin, fps),
		end: framesToSeconds(timing.end - parentOrigin, fps),
		sourceIn: framesToSeconds(source.in, fps),
		sourceOut: framesToSeconds(source.out, fps),
		playbackRate: timing.playbackRate,
	});
	// The timeline displays siblings in reverse paint order. Inserting before
	// the video (or its sequence) puts the sound directly below it in the UI.
	return { audio: plan.audio, parent, anchor: below };
}

export function audioDetachReason(world: World, entities = [...world.query(Selected)]): string | undefined {
	if (entities.length !== 1) return 'Seleccioná un solo clip de video para separar su audio.';
	return prepare(world, entities[0]).reason;
}

/** The two authored edits share one undo step and the normal project writer. */
export function detachAudio(world: World, entities = [...world.query(Selected)]): Entity {
	const reason = audioDetachReason(world, entities);
	if (reason) throw new Error(reason);
	const entity = entities[0];
	const plan = prepare(world, entity);
	if (!('parent' in plan) || !plan.audio) throw new Error(plan.reason);
	const editor = getDocumentEditor(world);
	return getEditHistory(world).command(() => {
		const [audio] = editor.insertElement(plan.parent, () => renderAuthored(plan.audio), plan.anchor);
		if (!audio) throw new Error('No se pudo crear la pista de audio. El video no se modificó.');
		editor.editProperty(entity, 'muted', true);
		editor.select(audio);
		return audio;
	});
}
