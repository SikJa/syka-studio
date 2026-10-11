/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * What a menu item, a key or the zoom control does to the view. The camera is
 * the project's — the file says where it stands — so every move of it is
 * reported to the document, the same way a pan is (see `CameraController`).
 */

import {
	Root,
	focusContent,
	focusEntities,
	getActiveEntity,
	getCameraMatrix,
	getSelection,
	setCameraZoom,
	zoomCameraBy,
} from '@diffusionstudio/runtime';

import { getDocumentEditor } from './editor';
import { CameraNavigation } from './traits';

import type { World } from 'koota';

function reportCamera(world: World): void {
	getDocumentEditor(world).reportEdit(world.get(Root)!, 'camera', getCameraMatrix(world));
}

/** Zooms around the center of the viewport: above 1 in, below 1 out. */
export function zoomBy(world: World, factor: number): void {
	if (isCameraLocked(world)) return;
	zoomCameraBy(world, factor);
	reportCamera(world);
}

/** Zooms to an absolute scale, 1 being 100%. */
export function zoomTo(world: World, scale: number): void {
	if (isCameraLocked(world)) return;
	setCameraZoom(world, scale);
	reportCamera(world);
}

/** Frame the scene being edited; other scenes must not shrink its preview. */
export function zoomToFit(world: World): void {
	if (isCameraLocked(world)) return;
	const active = getActiveEntity(world);
	if (active) focusEntities(world, [active]);
	else focusContent(world);
	reportCamera(world);
}

/** Explicit overview of all scenes and loose stage objects. */
export function zoomToStageContent(world: World): void {
	if (isCameraLocked(world)) return;
	focusContent(world);
	reportCamera(world);
}

/** Frames the selection, wherever on the stage it sits. */
export function zoomToSelection(world: World): void {
	if (isCameraLocked(world)) return;
	const selected = getSelection(world);
	if (!selected.length) return;

	focusEntities(world, selected);
	reportCamera(world);
}

/** A per-editor navigation preference, separate from authored camera values. */
export function isCameraLocked(world: World): boolean {
	return world.get(CameraNavigation)?.locked ?? false;
}

export function setCameraLocked(world: World, locked: boolean): void {
	if (!world.has(CameraNavigation)) world.add(CameraNavigation);
	world.set(CameraNavigation, { locked });
}
