/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Settings › Apariencia › Escala de interfaz: the window's zoom, kept as a
 * desktop preference so it survives restarts. Ctrl + / Ctrl − / Ctrl 0 (the
 * View menu) and the settings slider both go through here.
 */
import type { BrowserWindow } from 'electron';

export const UI_SCALE_KEY = 'dspro.ui.scale';
export const UI_SCALE_STEPS = [80, 90, 100, 110, 125, 150] as const;

export function parseUiScale(value: string | null): number {
  const percent = Number(value);
  return UI_SCALE_STEPS.includes(percent as (typeof UI_SCALE_STEPS)[number]) ? percent : 100;
}

/** The next step up (+1) or down (−1) from `percent`; 0 resets. */
export function stepUiScale(percent: number, direction: -1 | 0 | 1): number {
  if (direction === 0) return 100;
  const index = UI_SCALE_STEPS.indexOf(parseUiScale(String(percent)) as (typeof UI_SCALE_STEPS)[number]);
  return UI_SCALE_STEPS[Math.min(Math.max(index + direction, 0), UI_SCALE_STEPS.length - 1)]!;
}

export function applyUiScale(window: BrowserWindow | null | undefined, percent: number): void {
  if (!window || window.isDestroyed()) return;
  window.webContents.setZoomFactor(parseUiScale(String(percent)) / 100);
}
