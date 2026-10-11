/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { rememberProjectCover } from '@/lib/db';

import { isDesktop, markProjectsChanged } from './host';

/**
 * Takes the cover of the project in `dir` from `snapshot` and puts it on the
 * project's record (see `ProjectRecord.cover`), where the dashboard reads it
 * from with the rest of the record — never from the folder, which it must
 * not touch at launch. Call it as the project closes, with the snapshot
 * already under way; the list is told once the cover has landed, so a card
 * for a project still closing picks it up.
 */
export async function captureProjectCover(dir: string, snapshot: Promise<Blob | null>): Promise<void> {
	if (!dir || !isDesktop()) return;

	try {
		const blob = await snapshot;
		if (!blob) return;
		await rememberProjectCover(dir, blob);
		markProjectsChanged();
	} catch (error) {
		console.warn('[projects] could not record the project cover', error);
	}
}
