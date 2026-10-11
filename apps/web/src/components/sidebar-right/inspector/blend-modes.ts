/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { BlendModeType } from "@diffusionstudio/runtime";
import { BLEND_MODES } from "@diffusionstudio/reconciler";

import type { BlendMode } from "@diffusionstudio/jsx";

// Ordered to match Figma's blend mode menu groupings.
export const BLEND_MODE_ORDER: BlendModeType[] = [
  BlendModeType.SOURCE_OVER,
  BlendModeType.DARKEN,
  BlendModeType.MULTIPLY,
  BlendModeType.COLOR_BURN,
  BlendModeType.LIGHTEN,
  BlendModeType.SCREEN,
  BlendModeType.COLOR_DODGE,
  BlendModeType.OVERLAY,
  BlendModeType.SOFT_LIGHT,
  BlendModeType.HARD_LIGHT,
  BlendModeType.DIFFERENCE,
  BlendModeType.EXCLUSION,
  BlendModeType.HUE,
  BlendModeType.SATURATION,
  BlendModeType.COLOR,
  BlendModeType.LUMINOSITY,
];

// Modes that begin a new group (separator goes before them).
export const BLEND_MODE_SEPARATORS = new Set<BlendModeType>([
  BlendModeType.DARKEN,
  BlendModeType.LIGHTEN,
  BlendModeType.OVERLAY,
  BlendModeType.DIFFERENCE,
  BlendModeType.HUE,
]);

const NAMES = new Map<BlendModeType, BlendMode>(
  Object.entries(BLEND_MODES).map(([name, mode]) => [mode, name as BlendMode]),
);

/** The mode as the JSX spells it (`blendMode="colorDodge"`). */
export function blendModeName(mode: BlendModeType): BlendMode {
  return NAMES.get(mode) ?? "sourceOver";
}

/** The mode as the menu labels it: "Normal", "Color dodge", ... */
export function displayBlendMode(mode: BlendModeType): string {
  if (mode === BlendModeType.SOURCE_OVER) return "Normal";
  const name = BlendModeType[mode].replace("_", " ");
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
