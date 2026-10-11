/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Camera, Root, type Camera2D } from '@diffusionstudio/runtime';
import { useTrait, useWorld } from '@diffusionstudio/koota-solid';
import { CameraNavigation } from '../traits';

import type { Accessor } from 'solid-js';

/**
 * Reactive read of the document's Camera trait. Write it with the operations
 * in ../camera (they take the world), never by mutating the record.
 */
export function useCamera(): Accessor<Camera2D | undefined> {
	const world = useWorld();
	return useTrait(world.get(Root)!, Camera);
}

/** Reactive zoom factor of the stage camera (1 = 100%). */
export function useCameraScale(): Accessor<number> {
	const camera = useCamera();
	return () => {
		const { a = 1, b = 0 } = camera() ?? {};
		return Math.hypot(a, b);
	};
}

export function useCameraLocked(): Accessor<boolean> {
	const navigation = useTrait(useWorld(), CameraNavigation);
	return () => navigation()?.locked ?? false;
}
