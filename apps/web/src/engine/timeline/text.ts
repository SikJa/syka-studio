/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Measuring is the expensive part of drawing a label, and a clip's label does
// not change from frame to frame, so widths are kept. Widths measured before
// the web fonts land describe the fallback and under-report once the real
// font swaps in, so the cache is dropped when that happens.
const WIDTHS = new Map<string, number>();

document?.fonts.addEventListener('loadingdone', () => WIDTHS.clear());

/**
 * `text` if it fits in `maxWidth`, otherwise as much of it as fits with an
 * ellipsis, or null when not even the ellipsis does. `font` keys the cache,
 * since the same string measures differently in two of them.
 */
export function truncateText(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	font: string = 'default',
): string | null {
	const measure = (value: string): number => {
		const key = `${font}-${value}`;
		const cached = WIDTHS.get(key);
		if (cached !== undefined) return cached;

		const width = ctx.measureText(value).width;
		WIDTHS.set(key, width);
		return width;
	};

	if (measure(text) <= maxWidth) return text;

	const available = maxWidth - measure('...');
	if (available <= 0) return null;

	// Binary search rather than a walk: a long label is measured a handful of
	// times instead of once per character.
	let low = 0;
	let high = text.length;
	let best = 0;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		if (measure(text.slice(0, mid)) <= available) {
			best = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}

	return best > 0 ? `${text.slice(0, best)}...` : null;
}
