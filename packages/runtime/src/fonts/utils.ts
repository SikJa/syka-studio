/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Web font loading (was engine/font/utils.ts, minus the app-side pieces:
// getLocalFonts needs window.queryLocalFonts, and font persistence is the
// app's IndexedDB concern; it wraps loadWebFont and re-calls it on restore).

import { WebFonts } from './fixtures';
import { FontStyle } from '../constants';
import { Fonts, FramePromises, TextStyle } from '../traits';

import type { World } from 'koota';
import type * as types from './types';

const STYLE_MAP = {
	[FontStyle.NORMAL]: 'normal',
	[FontStyle.ITALIC]: 'italic',
	[FontStyle.OBLIQUE]: 'oblique',
} as const;

const pendingFonts = new WeakMap<World, Map<string, Promise<types.FontSource>>>();
const importedFonts = new Map<string, types.FontSources>();
let catalogRevision = 0;

/** Imported variants are process-local; the native host persists their files. */
export function registerFontSources(families: types.FontSources[]): void {
	importedFonts.clear();
	for (const family of families) importedFonts.set(family.family, family);
	catalogRevision++;
}

function waitForFont(world: World, loading: Promise<types.FontSource>): Promise<types.FontSource> {
	const promises = world.get(FramePromises)?.list;
	// Capture's existing resolver awaits this rejecting promise before sampling
	// a frame. A failed font aborts that capture; its fresh world is disposed.
	if (promises && !promises.includes(loading)) promises.push(loading);
	return loading;
}

/** The environment's FontFaceSet: document.fonts on a page, self.fonts in a worker. */
function getFontFaceSet(): FontFaceSet | null {
	const scope = globalThis as { document?: { fonts?: FontFaceSet }; fonts?: FontFaceSet };
	return scope.document?.fonts ?? scope.fonts ?? null;
}

/**
 * Get common web fonts
 */
export function getWebFonts(): types.FontSources[] {
	const included: types.FontSources[] = Object.keys(WebFonts).map((family) => {
		return {
			family,
			origin: 'included',
			license: family === 'Chewy' ? 'Apache License 2.0' : 'SIL Open Font License 1.1',
			licenseUrl: WebFonts[family as keyof typeof WebFonts].licenseUrl,
			variants: WebFonts[family as keyof typeof WebFonts].weights.map((weight) => {
				const config = WebFonts[family as keyof typeof WebFonts];
				return {
					family,
					source: `url("${config.url}")`,
					weight: weight,
					style: 'style' in config && config.style === 'italic' ? FontStyle.ITALIC : FontStyle.NORMAL,
				};
			}),
		};
	});
	return [...included.filter(f => !importedFonts.has(f.family)), ...importedFonts.values()];
}

export function loadWebFont(
	world: World,
	family: string,
	style: FontStyle = FontStyle.NORMAL,
	weight?: string,
): Promise<types.FontSource> {
	const config = WebFonts[family as keyof typeof WebFonts];
	const imported = importedFonts.get(family);
	const variants = imported?.variants;
	const compatible = variants?.filter(v => (v.style ?? FontStyle.NORMAL) === style);
	const variant = (compatible?.length ? compatible : variants)?.toSorted((a, b) => Math.abs(Number(a.weight ?? 400) - Number(weight ?? 400)) - Math.abs(Number(b.weight ?? 400) - Number(weight ?? 400)))[0];
	if (!config && !variant) return Promise.reject(Error(`Fuente desconocida: ${family}`));
	const source = variant?.source ?? `url("${config.url}")`;
	if (variant) { style = variant.style ?? FontStyle.NORMAL; weight = variant.weight; }
	else if ('style' in config && config.style === 'italic') style = FontStyle.ITALIC;
	const font: types.FontSource = {
		source,
		family,
		weight,
		style,
	};

	const fonts = world.get(Fonts)?.list;
	// No FontFace = headless environment without font rasterization; text
	// measurement falls back to the system font.
	if (!fonts || typeof FontFace === 'undefined') return Promise.resolve(font);

	const sameVariant = (candidate: types.FontSource) => candidate.family === family
		&& candidate.source === source && candidate.weight === weight
		&& (candidate.style ?? FontStyle.NORMAL) === style;
	const key = JSON.stringify([family, source, style, weight]);
	let pending = pendingFonts.get(world);
	if (!pending) {
		pending = new Map();
		pendingFonts.set(world, pending);
	}
	const existing = pending.get(key);
	if (existing) return waitForFont(world, existing);

	const loaded = fonts.find(sameVariant);
	if (loaded) return Promise.resolve(loaded);

	// Load all weights if no weight is specified
	let faceWeight = weight;
	if (!faceWeight) {
		const config = WebFonts[family as keyof typeof WebFonts];
		const weights = config.weights;
		faceWeight = weights.length > 1 ? `${weights[0]} ${weights[weights.length - 1]}` : weights[0];
	}

	// Register the operation before FontFace construction/load can fail. The
	// list advertises loaded variants only, so rollback never removes another
	// family's same-weight font, and capture cannot copy a false ready state.
	const loading = Promise.resolve().then(async () => {
		const face = new FontFace(family, source, { weight: faceWeight, style: STYLE_MAP[style] });
		const loadedFace = await face.load();
		getFontFaceSet()?.add(loadedFace);
		const current = world.get(Fonts)?.list;
		if (current && !current.some(sameVariant)) current.push(font);
		return font;
	}).finally(() => pending.delete(key));
	pending.set(key, loading);
	// Preset/picker callers intentionally do not await. Observe their errors
	// without turning the promise returned to callers/capture into success.
	void loading.catch((error: unknown) => console.warn(`[fonts] Could not load ${family} (${weight ?? 'all weights'}, ${STYLE_MAP[style]})`, error));
	return waitForFont(world, loading);
}

const requestedStyles = new WeakMap<World, Map<number, string>>();
/** Also loads fonts authored by the agent/JSX, with the same export barrier as presets. */
export function fontSystem(world: World): void {
	let requested = requestedStyles.get(world);
	if (!requested) { requested = new Map(); requestedStyles.set(world, requested); }
	for (const entity of world.query(TextStyle)) {
		const text = entity.get(TextStyle)!;
		if (!text.fontFamily) continue;
		if (!(text.fontFamily in WebFonts) && !importedFonts.has(text.fontFamily)) continue;
		const key = `${catalogRevision}:${text.fontFamily}:${text.fontStyle}:${text.fontWeight}`;
		if (requested.get(entity.id()) === key) continue;
		requested.set(entity.id(), key);
		void loadWebFont(world, text.fontFamily, text.fontStyle, text.fontWeight);
	}
}
