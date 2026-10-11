/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { EASINGS } from "@diffusionstudio/reconciler";

import type { Easing } from "@diffusionstudio/jsx";

/**
 * The easings the JSX has a word for, which are exactly the presets the
 * interpolation panel offers. `descriptor` is what the runtime stores for the
 * name (`EASINGS` is the one table mapping them, linear being the empty
 * string); the panel matches on it to know which preset a keyframe is set to,
 * and writes `name` back so the file reads `easing="easeOut"` rather than the
 * bezier behind it.
 */
export type EasingPreset = {
  name: Easing;
  label: string;
  descriptor: string;
};

const preset = (name: Easing, label: string): EasingPreset => ({
  name,
  label,
  descriptor: EASINGS[name] ?? name,
});

export const EASE_PRESETS: EasingPreset[] = [
  preset("linear", "Linear"),
  preset("easeIn", "Ease In"),
  preset("easeOut", "Ease Out"),
  preset("easeInOut", "Ease In & Out"),
];

export const SPRING_PRESETS: EasingPreset[] = [
  preset("gentle", "Gentle"),
  preset("snappy", "Snappy"),
  preset("bouncy", "Bouncy"),
  preset("strong", "Strong"),
];

/** What the Spring tab starts a keyframe at. */
export const DEFAULT_SPRING: EasingPreset = SPRING_PRESETS[0]!;

/** `<keyframe>`'s default: absent easing is linear. */
export const LINEAR: EasingPreset = EASE_PRESETS[0]!;

const BY_DESCRIPTOR = new Map<string, EasingPreset>(
  [...EASE_PRESETS, ...SPRING_PRESETS].map((option) => [option.descriptor, option]),
);

/** The named easing a descriptor is, or null for one the JSX can only spell out. */
export function easingPreset(descriptor: string): EasingPreset | null {
  return BY_DESCRIPTOR.get(descriptor) ?? null;
}
