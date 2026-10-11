/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// A project's first scene, and the assets that started it. Dropping media
// into a project that has no scene to put it in makes one around it rather
// than leaving the clips loose at the root, which is what `insertAsset`
// would otherwise do. The canvas and the timeline share this; they differ
// only in where the new scene should end up on screen.

import { Scene as SceneElement, SolidPaint } from '@diffusionstudio/reconciler';
import { focusRect, getCameraMatrix, getNextName, Root, Source } from '@diffusionstudio/runtime';

import { FORMAT_PROP } from './formats/model';
import { assetFormat } from './formats/native';
import { getDocumentEditor } from './editor';
import { isCameraLocked } from './camera';
import { AUDIO_SIZE, insertAsset } from './insert-asset';

import type { Asset } from '@diffusionstudio/assets';
import type { Rect } from '@diffusionstudio/runtime';
import type { Entity, World } from 'koota';

export interface Size {
	width: number;
	height: number;
}

/** The format a new scene gets when nothing going into it brings one. */
export const DEFAULT_SCENE_FORMAT: Size = { width: 1920, height: 1080 };

export interface NewSceneOptions {
	/** The scene's name; the next free "Scene N" by default. */
	name?: string;
	/** Explicit user format; takes precedence over media metadata. */
	format?: Size;
	/**
	 * Brings the new scene into view, given the rect it occupies in world
	 * space. The camera is framed on it by default; the canvas placeholder
	 * puts it exactly where the placeholder was instead.
	 */
	focus?: (rect: Rect) => void;
	/** Where on the timeline the assets start, in seconds; the playhead by default. */
	start?: number;
	/** Initial audio gain when the first scene is created from linked sounds. */
	volume?: number;
	/** Display label for a linked resource creating the first scene. */
	label?: string;
}

/**
 * Adds the project's first scene, of `format`, centered on the world origin,
 * makes it the active one, and brings it into view. Returns the scene, or
 * null when there is no project for it to be written under.
 */
export function createScene(world: World, format: Size, options: NewSceneOptions = {}): Entity | null {
	const root = world.get(Root)!;
	if (!root.get(Source)?.value) return null;

	const editor = getDocumentEditor(world);
	const rect: Rect = { x: Math.round(-format.width / 2), y: Math.round(-format.height / 2), ...format };
	const name = options.name ?? getNextName(world, 'Scene');

	// The camera moves first, so the scene is in view the moment it exists.
	if (!isCameraLocked(world)) {
		(options.focus ?? ((target: Rect) => focusRect(world, target)))(rect);
		editor.reportEdit(root, 'camera', getCameraMatrix(world));
	}

	const [scene] = editor.insertElement(root, () => (
		<SceneElement {...{ [FORMAT_PROP]: JSON.stringify({ version: 1, mode: options.format ? "manual" : "auto", provenance: options.format ? "manual" : "first-media", destination: "none", revision: 0, awaitingFirstMedia: !options.format, initialScene: format }) }} name={name} x={rect.x} y={rect.y} width={rect.width} height={rect.height}>
			<SolidPaint color="#000000" />
		</SceneElement>
	));
	if (!scene) return null;

	editor.activate(scene);
	return scene;
}

/**
 * Puts `assets` in a scene of their own and selects them. The scene's format
 * is the explicit format, or the first asset with a valid size — that one fills the scene
 * exactly, and the rest are centered in it; a drop of nothing but audio or a
 * transcript falls back to `options.format`. Returns the scene, or null when
 * there is nothing to insert into.
 */
export function insertAssetsInNewScene(
	world: World,
	assets: ReadonlyArray<Asset>,
	options: NewSceneOptions = {},
): Entity | null {
	const sized = assets.find(asset => hasSize(asset) && assetFormat(asset));
	const format = options.format ?? (sized ? assetFormat(sized)! : DEFAULT_SCENE_FORMAT);

	const scene = createScene(world, format, options);
	if (!scene) return null;

	const inserted: Entity[] = [];
	for (const asset of assets) {
		const size = hasSize(asset) ? sizeOf(asset) : AUDIO_SIZE;
		const entity = insertAsset(world, asset, {
			parent: scene,
			// The scene is new, so its computed bounds are not there to center
			// against yet: the format is what it will measure.
			x: (format.width - size.width) / 2,
			y: (format.height - size.height) / 2,
			start: options.start,
			volume: options.volume,
			label: options.label,
		});
		if (entity) inserted.push(entity);
	}

	getDocumentEditor(world).select(inserted.length ? inserted : scene);
	return scene;
}

/** Assets that bring a format with them; the rest are laid out inside one. */
export const hasSize = (asset: Asset): asset is Extract<Asset, Size> => 'width' in asset && 'height' in asset;

export const sizeOf = (asset: Extract<Asset, Size>): Size => assetFormat(asset) ?? DEFAULT_SCENE_FORMAT;
