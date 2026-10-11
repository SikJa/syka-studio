/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { FontStyle, getWebFonts, registerFontSources } from '@diffusionstudio/runtime';
import { createSignal } from 'solid-js';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';

import type { FontSources } from '@diffusionstudio/runtime';
import type { FontCatalog } from '@desktop/font-import';

export const [fontCatalogRevision, setFontCatalogRevision] = createSignal(0);
let nativeCatalog: Promise<void> | undefined;

function registerCatalog(catalog: FontCatalog): void {
  const families = new Map<string, FontSources>();
  for (const face of catalog.fonts) {
    let family = families.get(face.family);
    if (!family) {
      family = { family: face.family, origin: 'imported', license: face.license, licenseUrl: face.licenseUrl, missingSpanish: [], variants: [] };
      families.set(face.family, family);
    }
    family.variants.push({ family: face.family, source: face.source, weight: face.weight, style: face.style === 'italic' ? FontStyle.ITALIC : FontStyle.NORMAL });
    family.missingSpanish = [...new Set([...family.missingSpanish!, ...face.missingSpanish])];
  }
  registerFontSources([...families.values()]);
  setFontCatalogRevision(n => n + 1);
}

/** Native fonts are available independently of the OS font-access permission. */
export function initializeFontCatalog(): Promise<void> {
  if (typeof window === 'undefined' || !window.desktop) return Promise.resolve();
  return nativeCatalog ??= mainBridge.call(MAIN_CHANNELS.SYKA_FONTS, { action: 'list' }).then(registerCatalog).catch(error => {
    nativeCatalog = undefined;
    console.warn('[fonts] No se pudieron restaurar las fuentes importadas.', error);
  });
}

export async function importNativeFonts(): Promise<FontCatalog> {
  if (!window.desktop) throw Error('La importación de fuentes está disponible en Syka Desktop.');
  const catalog = await mainBridge.call(MAIN_CHANNELS.SYKA_FONTS, { action: 'import' });
  registerCatalog(catalog);
  return catalog;
}

export async function getAvailableFonts(): Promise<FontSources[]> {
  await initializeFontCatalog();
  const included = getWebFonts();
  const local = typeof window.queryLocalFonts === 'function' ? await getLocalFonts().catch(() => []) : [];
  const names = new Set(included.map(f => f.family));
  return [...included, ...local.filter(f => !names.has(f.family)).map(f => ({ ...f, origin: 'system' as const }))];
}

interface LocalFont {
	family: string;
	fullName: string;
	postscriptName: string;
	style: string;
}

/**
 * Every family installed on the machine, grouped by family. Requires the Local
 * Font Access API and a granted permission; the caller handles the rejection.
 */
export async function getLocalFonts(): Promise<FontSources[]> {
  if (window.desktop) {
    const permissions = await mainBridge.call(MAIN_CHANNELS.SYKA_PERMISSIONS, { action: 'get' });
    if (!permissions.fonts) return [];
  }
	const families = new Map<string, LocalFont[]>();

	for (const font of (await window.queryLocalFonts()) as LocalFont[]) {
		const variants = families.get(font.family);
		if (variants) variants.push(font);
		else families.set(font.family, [font]);
	}

	return [...families].map(([family, fonts]) => ({
		family,
		variants: fonts.map((font) => ({
			family,
			source: `local('${font.fullName}'), local('${font.postscriptName}')`,
			weight: matchFontWeight(font.style),
			style: matchFontStyle(font.style),
		})),
	}));
}

/** The style a local font names itself in, as the runtime spells it. */
function matchFontStyle(style: string): FontStyle {
	if (/oblique/i.test(style)) return FontStyle.OBLIQUE;
	if (/italic/i.test(style)) return FontStyle.ITALIC;
	return FontStyle.NORMAL;
}

/**
 * The CSS weight a local font's style name comes to. Ordered so the longer
 * names win: "extrabold" is not a bold, and "extralight" is not a light.
 */
function matchFontWeight(weight: string): string {
	const matches: [RegExp, string][] = [
		[/black|heavy/i, '900'],
		[/(extra|ultra)[ -]?bold/i, '800'],
		[/(semi|demi)[ -]?bold/i, '600'],
		[/bold|strong/i, '700'],
		[/medium/i, '500'],
		[/normal|regular|book|plain/i, '400'],
		[/(extra|ultra)[ -]?light/i, '200'],
		[/thin|hairline/i, '100'],
		[/light/i, '300'],
	];

	return matches.find(([pattern]) => pattern.test(weight))?.[1] ?? '400';
}
