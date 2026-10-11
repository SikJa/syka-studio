/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ANIMATION_TYPES } from "@diffusionstudio/reconciler";

import type { AnimationType as AnimationName } from "@diffusionstudio/jsx";
import type { AnimationType } from "@diffusionstudio/runtime";
import { t } from '@/i18n';

export type AnimationOption = {
  name: AnimationName;
  label: string;
};

/**
 * Which nodes a group is offered on: a text animation needs glyphs to move,
 * a gain needs something to hear. A group without a kind fits every node.
 */
export type AnimationGroupKind = "text" | "audio";

export type AnimationGroup = {
  label: string;
  kind?: AnimationGroupKind;
  options: AnimationOption[];
};

/** The presets, grouped as the type select shows them. */
export const ANIMATION_GROUPS: AnimationGroup[] = [
  {
    get label() { return t("Fade"); },
    options: [
      { name: "fade", get label() { return t("Fade"); } },
      { name: "slideLeft", get label() { return t("Slide left"); } },
      { name: "slideRight", get label() { return t("Slide right"); } },
      { name: "slideUp", get label() { return t("Slide up"); } },
      { name: "softRise", get label() { return t("Subida suave"); } },
      { name: "slideDown", get label() { return t("Slide down"); } },
    ],
  },
  {
    get label() { return t("Scale"); },
    options: [
      { name: "grow", get label() { return t("Grow"); } },
      { name: "shrink", get label() { return t("Shrink"); } },
      { name: "spin", get label() { return t("Spin"); } },
      { name: "twist", get label() { return t("Twist"); } },
    ],
  },
  {
    get label() { return t("Blur"); },
    options: [{ name: "blur", get label() { return t("Blur"); } }],
  },
  {
    get label() { return t("Text"); },
    kind: "text",
    options: [
      { name: "appearWord", get label() { return t("Appear word"); } },
      { name: "appearChar", get label() { return t("Appear character"); } },
      { name: "scramble", get label() { return t("Scramble"); } },
    ],
  },
  {
    get label() { return t("Audio"); },
    kind: "audio",
    options: [{ name: "gain", get label() { return t("Volume"); } }],
  },
];

const ALL_OPTIONS = ANIMATION_GROUPS.flatMap((group) => group.options);

/** What the panel's plus authors: a fade, the one preset every node can play. */
export const DEFAULT_ANIMATION: AnimationOption = ALL_OPTIONS[0]!;

const BY_TYPE = new Map<AnimationType, AnimationOption>(
  ALL_OPTIONS.map((option) => [ANIMATION_TYPES[option.name]!, option]),
);

/**
 * The option for the type an `Animation` trait holds. Identity matters: the
 * type select compares its value against the groups it was given, so this
 * hands back the option itself rather than a copy.
 */
export function animationOption(type: AnimationType | undefined): AnimationOption {
  return (type === undefined ? undefined : BY_TYPE.get(type)) ?? DEFAULT_ANIMATION;
}
