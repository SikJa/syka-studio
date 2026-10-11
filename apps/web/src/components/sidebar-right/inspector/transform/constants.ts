/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ConstraintType } from "@diffusionstudio/runtime";
import { HORIZONTAL_CONSTRAINTS, VERTICAL_CONSTRAINTS } from "@diffusionstudio/reconciler";

import type { HorizontalConstraint, VerticalConstraint } from "@diffusionstudio/jsx";
import { t } from '@/i18n';

export type Constraint = {
  key: ConstraintType;
  label: string;
};

export type AnchorPosition = {
  x: number;
  y: number;
  icon: string;
  tooltip: string;
};

export const anchorPositions: AnchorPosition[] = [
  { x: 0, y: 0, icon: 'anchor-align-top-left', get tooltip() { return t('Align top left'); } },
  { x: 0.5, y: 0, icon: 'anchor-align-top-center', get tooltip() { return t('Align top center'); } },
  { x: 1, y: 0, icon: 'anchor-align-top-right', get tooltip() { return t('Align top right'); } },
  { x: 0, y: 0.5, icon: 'anchor-align-left', get tooltip() { return t('Align left'); } },
  { x: 0.5, y: 0.5, icon: 'anchor-align-center', get tooltip() { return t('Align center'); } },
  { x: 1, y: 0.5, icon: 'anchor-align-right', get tooltip() { return t('Align right'); } },
  { x: 0, y: 1, icon: 'anchor-align-bottom-left', get tooltip() { return t('Align bottom left'); } },
  { x: 0.5, y: 1, icon: 'anchor-align-bottom-center', get tooltip() { return t('Align bottom center'); } },
  { x: 1, y: 1, icon: 'anchor-align-bottom-right', get tooltip() { return t('Align bottom right'); } },
];

export const horizontalConstraints: Constraint[] = [
  { key: ConstraintType.MIN, get label() { return t('Left'); } },
  { key: ConstraintType.MAX, get label() { return t('Right'); } },
  { key: ConstraintType.CENTER, get label() { return t('Center'); } },
  { key: ConstraintType.STRETCH, get label() { return t('Left & right'); } },
  { key: ConstraintType.SCALE, get label() { return t('Scale'); } },
];

export const verticalConstraints: Constraint[] = [
  { key: ConstraintType.MIN, get label() { return t('Top'); } },
  { key: ConstraintType.MAX, get label() { return t('Bottom'); } },
  { key: ConstraintType.CENTER, get label() { return t('Center'); } },
  { key: ConstraintType.STRETCH, get label() { return t('Top & bottom'); } },
  { key: ConstraintType.SCALE, get label() { return t('Scale'); } },
];

const HORIZONTAL_NAMES = new Map<ConstraintType, HorizontalConstraint>(
  Object.entries(HORIZONTAL_CONSTRAINTS).map(([name, type]) => [type, name as HorizontalConstraint]),
);

const VERTICAL_NAMES = new Map<ConstraintType, VerticalConstraint>(
  Object.entries(VERTICAL_CONSTRAINTS).map(([name, type]) => [type, name as VerticalConstraint]),
);

/** The anchor as the JSX spells it on the horizontal axis (`constrainX="right"`). */
export function horizontalConstraintName(type: ConstraintType): HorizontalConstraint {
  return HORIZONTAL_NAMES.get(type) ?? "left";
}

/** The same on the vertical axis (`constrainY="bottom"`). */
export function verticalConstraintName(type: ConstraintType): VerticalConstraint {
  return VERTICAL_NAMES.get(type) ?? "top";
}
