/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { useTrait, useWorld } from '@diffusionstudio/koota-solid';
import { createMemo } from 'solid-js';

import { AssetSelection } from '../traits';
import { useLibrary } from '../library';

import type { Asset, PartialAsset } from '@diffusionstudio/assets';

/**
 * Reactive read and write of the AssetSelection trait: the one library entry
 * the assets panel has picked and the inspector describes — an asset, or the
 * partial document of a generation without bytes. Shared between the two
 * sidebars, so it lives on the world rather than in either panel.
 */
export function useAssetSelection() {
	const world = useWorld();
	const library = useLibrary();
	const selection = useTrait(world, AssetSelection);

	const id = () => selection()?.id ?? null;

	// `list()` is the library's signal, so a removed or relinked asset drops
	// out here without the panel having to watch for it.
	const asset = createMemo(() => {
		const lib = library();
		const current = id();
		if (!lib || !current) return undefined;
		return lib.list().find((entry) => entry.id === current);
	});

	/** The picked partial document, when the pick is one; drops out as its bytes land. */
	const partial = createMemo(() => {
		const lib = library();
		const current = id();
		if (!lib || !current) return undefined;
		return lib.partials().find((entry) => entry.id === current);
	});

	const select = (next: Asset | PartialAsset | string | null) => {
		world.set(AssetSelection, { id: typeof next === 'string' ? next : (next?.id ?? null) });
	};

	return { id, asset, partial, select };
}
