/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity, World } from 'koota';

const harness = vi.hoisted(() => ({
	root: Symbol('root'),
	active: null as Entity | null,
	focusContent: vi.fn(),
	focusEntities: vi.fn(),
	reportEdit: vi.fn(),
	zoomCameraBy: vi.fn(),
	setCameraZoom: vi.fn(),
	locked: false,
	matrix: [0.75, 0, 0, 0.75, 40, 70],
}));

vi.mock('@diffusionstudio/runtime', () => ({
	Root: harness.root,
	getActiveEntity: () => harness.active,
	focusContent: harness.focusContent,
	focusEntities: harness.focusEntities,
	getCameraMatrix: () => harness.matrix,
	getSelection: () => [harness.active].filter(Boolean),
	setCameraZoom: harness.setCameraZoom,
	zoomCameraBy: harness.zoomCameraBy,
}));
vi.mock('./editor', () => ({
	getDocumentEditor: () => ({ reportEdit: harness.reportEdit }),
}));

import { isCameraLocked, setCameraLocked, zoomBy, zoomTo, zoomToFit, zoomToSelection, zoomToStageContent } from './camera';
import { CameraNavigation } from './traits';

const stage = {} as Entity;
const world = {
	get: (target: unknown) => target === CameraNavigation ? { locked: harness.locked } : stage,
	has: () => true,
	set: (_target: unknown, value: { locked: boolean }) => { harness.locked = value.locked; },
} as unknown as World;

describe('editor fit target', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		harness.active = null;
		harness.locked = false;
	});

	it('blocks all navigation commands and source writes while locked, then restores navigation', () => {
		harness.active = {} as Entity;
		setCameraLocked(world, true);
		expect(isCameraLocked(world)).toBe(true);
		zoomBy(world, 1.25);
		zoomTo(world, 0.5);
		zoomToFit(world);
		zoomToStageContent(world);
		zoomToSelection(world);
		expect(harness.focusContent).not.toHaveBeenCalled();
		expect(harness.focusEntities).not.toHaveBeenCalled();
		expect(harness.zoomCameraBy).not.toHaveBeenCalled();
		expect(harness.setCameraZoom).not.toHaveBeenCalled();
		expect(harness.reportEdit).not.toHaveBeenCalled();
		setCameraLocked(world, false);
		expect(isCameraLocked(world)).toBe(false);
		zoomToFit(world);
		expect(harness.focusEntities).toHaveBeenCalledWith(world, [harness.active]);
		expect(harness.reportEdit).toHaveBeenCalledOnce();
	});

	it('uses the current active scene even after switching scenes', () => {
		const first = {} as Entity;
		const second = {} as Entity;
		harness.active = first;
		zoomToFit(world);
		harness.active = second;
		zoomToFit(world);
		expect(harness.focusEntities.mock.calls).toEqual([[world, [first]], [world, [second]]]);
		expect(harness.focusEntities.mock.calls[0]?.[1]?.[0]).toBe(first);
		expect(harness.focusEntities.mock.calls[1]?.[1]?.[0]).toBe(second);
		expect(harness.focusContent).not.toHaveBeenCalled();
	});

	it('still fits the available stage when no scene is active and persists that camera', () => {
		zoomToFit(world);
		expect(harness.focusContent).toHaveBeenCalledWith(world);
		expect(harness.focusEntities).not.toHaveBeenCalled();
		expect(harness.reportEdit).toHaveBeenCalledWith(stage, 'camera', harness.matrix);
	});

	it('keeps the all-stage overview available even when a scene is active', () => {
		harness.active = {} as Entity;
		zoomToStageContent(world);
		expect(harness.focusContent).toHaveBeenCalledWith(world);
		expect(harness.focusEntities).not.toHaveBeenCalled();
		expect(harness.reportEdit).toHaveBeenCalledWith(stage, 'camera', harness.matrix);
	});
});
