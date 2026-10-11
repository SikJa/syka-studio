import type { AuthoredTree } from '@diffusionstudio/reconciler';

export type AudioDetachPlan = { audio: AuthoredTree; reason?: never } | { reason: string; audio?: never };

/** Build an independent audio clip without baking or transcoding its source. */
export function planAudioDetach(tree: AuthoredTree, channels?: number): AudioDetachPlan {
	if (!channels || channels < 1) return { reason: 'El archivo no tiene una pista de audio disponible.' };
	const paints = tree.children.filter(child => child.tag === 'videoPaint');
	const media = tree.tag === 'video' ? tree : tree.tag === 'rect' && paints.length === 1 ? paints[0] : undefined;
	if (!media || (tree.tag === 'video' && paints.length)) {
		return { reason: 'Seleccioná un video individual. Los grupos y las composiciones con varios videos se separan clip por clip.' };
	}
	if (!media.props.src) return { reason: 'Esperá a que termine de cargar el archivo de video.' };
	if (tree.props.hidden || media.props.hidden) return { reason: 'Mostrá el video antes de separar su audio para mantener el estado de escucha.' };
	// Nested geometry can carry additional sound; muting that parent would silence it too.
	const safeChildren = new Set(['videoPaint', 'color', 'gradient', 'stroke', 'shadow', 'effect', 'animation', 'keyframeTrack']);
	if (tree.children.some(child => !safeChildren.has(child.tag))) {
		return { reason: 'Este video contiene otros elementos. Separá primero el clip de su composición.' };
	}
	if (tree.props.syncTo || tree.props.frameRate || media.props.frameRate) {
		return { reason: 'La separación de audio todavía no admite sincronización automática ni cambios del FPS de origen.' };
	}
	const props: Record<string, unknown> = { src: media.props.src, name: `${tree.props.name || 'Video'} · audio` };
	for (const key of ['start', 'end', 'sourceIn', 'sourceOut', 'playbackRate', 'volume', 'muted']) {
		if (tree.props[key] !== undefined) props[key] = tree.props[key];
	}
	const clone = (node: AuthoredTree): AuthoredTree => ({ ...node, props: { ...node.props }, children: node.children.map(clone) });
	const children = tree.children.filter(child =>
		(child.tag === 'keyframeTrack' && child.props.property === 'volume') ||
		(child.tag === 'animation' && child.props.type === 'gain'),
	).map(clone);
	return { audio: { tag: 'audio', props, children } };
}
