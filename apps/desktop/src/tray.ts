/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Settings › General › Cerrar a la bandeja, from Syka Code's `main/tray.ts`:
 * with it on, closing the window hides it and Syka stays in the system tray
 * with its work; «Salir de Syka Studio» (tray menu) really quits. With it off,
 * closing the last window quits as before.
 */
import { Menu, Tray, app, type BrowserWindow } from 'electron';

let enabled = false;
let quitting = false;
let tray: Tray | null = null;

export function setCloseToTray(next: boolean): void {
  enabled = next;
  if (!next) {
    tray?.destroy();
    tray = null;
  }
}

/** Really quitting: closing no longer hides. */
export function markQuitting(): void {
  quitting = true;
}

function show(window: BrowserWindow): void {
  if (window.isDestroyed()) return;
  window.show();
  if (window.isMinimized()) window.restore();
  window.focus();
}

async function ensureTray(window: BrowserWindow): Promise<void> {
  if (tray !== null) return;
  // The app's own icon, the one of the executable.
  const icon = await app.getFileIcon(process.execPath, { size: 'small' });
  if (tray !== null || !enabled) return;
  tray = new Tray(icon);
  tray.setToolTip('Syka Studio');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Syka Studio', click: () => show(window) },
    { type: 'separator' },
    { label: 'Salir de Syka Studio', click: () => { markQuitting(); app.quit(); } },
  ]));
  tray.on('click', () => show(window));
}

/** Hooks the main window: closing it with the option on hides it. */
export function attachCloseToTray(window: BrowserWindow): void {
  window.on('close', event => {
    if (!enabled || quitting) return;
    event.preventDefault();
    window.hide();
    void ensureTray(window);
  });
}

/** The tray choice inside the general settings stored as a desktop preference. */
export function closeToTrayFrom(value: string | null): boolean {
  try { return JSON.parse(value ?? '{}')?.closeToTray === true; } catch { return false; }
}
