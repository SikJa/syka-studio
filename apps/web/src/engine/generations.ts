/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Asking again for a generation that failed. A failed generation stands in
 * the library as a partial document in error, and a declaration whose key
 * stands there resolves to the failure rather than to another run — in
 * this session and the next. Removing the record is what asks again; this
 * is that removal, plus making the elements still waiting on the answer ask
 * right away rather than on the next mount.
 */

import { isAssetRef } from '@diffusionstudio/jsx';
import { authoredElement } from '@diffusionstudio/reconciler';
import {
	Caption, Generating, GenerationRequest, PendingSource, SourceError, TranscriptionRequest,
} from '@diffusionstudio/runtime';

import type { AssetLibrary, PartialAsset } from '@diffusionstudio/assets';
import type { World } from 'koota';

/** Forgets the failure `partial` records and re-asks for every failed source. */
export async function retryGeneration(world: World, library: AssetLibrary, partial: PartialAsset): Promise<void> {
	await library.remove([partial]);

	for (const entity of world.query(SourceError)) {
		if (!entity.get(SourceError)!.generated) continue;
		const authored = authoredElement(entity);

		if (!authored) continue;

		const src = authored.props.src;
		entity.remove(SourceError, PendingSource, Generating);

		if (isAssetRef(src)) {
			entity.add(GenerationRequest);
			entity.set(GenerationRequest, { ref: src });
		} else if (entity.has(Caption)) {
			entity.add(TranscriptionRequest);
			entity.set(TranscriptionRequest, { seed: Number(authored.props.seed) || 0 });
		}
	}
}
