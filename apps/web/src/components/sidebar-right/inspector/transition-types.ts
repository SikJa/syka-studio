/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { TRANSITION_TYPES } from "@diffusionstudio/reconciler";

import type { TransitionType as TransitionName } from "@diffusionstudio/jsx";
import type { TransitionType } from "@diffusionstudio/runtime";

export type TransitionOption = {
  name: TransitionName;
  label: string;
};

/** The transition styles, in menu order. */
export const TRANSITION_OPTIONS: TransitionOption[] = [
  { name: "dissolve", label: "Dissolve" },
  { name: "slideFromRight", label: "Slide From Right" },
  { name: "slideFromLeft", label: "Slide From Left" },
  { name: "fadeToBlack", label: "Fade To Black" },
  { name: "fadeToWhite", label: "Fade To White" },
];

/** What the panel's plus authors: a one second dissolve, the prop's own defaults. */
export const DEFAULT_TRANSITION: TransitionOption = TRANSITION_OPTIONS[0]!;
export const DEFAULT_TRANSITION_DURATION = 1;

const BY_TYPE = new Map<TransitionType, TransitionOption>(
  TRANSITION_OPTIONS.map((option) => [TRANSITION_TYPES[option.name]!, option]),
);

/**
 * The option for the type a `Transition` trait holds. Identity matters: the
 * type select compares its value against the array it was given, so this
 * hands back the option itself rather than a copy.
 */
export function transitionOption(type: TransitionType | undefined): TransitionOption {
  return (type === undefined ? undefined : BY_TYPE.get(type)) ?? DEFAULT_TRANSITION;
}
