/**
 * Settings › Apariencia options of this computer, after Syka Code's
 * `appearance.ts`: pointer cursors and pausing looping motion while another
 * window is in front, applied as attributes on <html>; the interface scale is
 * the window zoom main keeps under `dspro.ui.scale`.
 */

export type AppearancePrefs = { pointerCursors: boolean; pauseInBackground: boolean };
export const DEFAULT_APPEARANCE_PREFS: AppearancePrefs = { pointerCursors: true, pauseInBackground: true };
export const APPEARANCE_PREFS_KEY = 'dspro.ui.appearance.v1';
export const UI_SCALE_KEY = 'dspro.ui.scale';
export const UI_SCALE_STEPS = [80, 90, 100, 110, 125, 150] as const;
const CHANGED = 'syka:appearance-prefs';

function storage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try { return window.desktop?.preferences ?? window.localStorage; } catch { return undefined; }
}

export function appearancePrefs(): AppearancePrefs {
  try { return { ...DEFAULT_APPEARANCE_PREFS, ...JSON.parse(storage()?.getItem(APPEARANCE_PREFS_KEY) ?? '{}') }; }
  catch { return DEFAULT_APPEARANCE_PREFS; }
}

export function updateAppearancePrefs(patch: Partial<AppearancePrefs>): void {
  try { storage()?.setItem(APPEARANCE_PREFS_KEY, JSON.stringify({ ...appearancePrefs(), ...patch })); } catch { /* This session only. */ }
  applyAppearancePrefs();
  window.dispatchEvent(new CustomEvent(CHANGED));
}

export function onAppearancePrefsChange(listener: () => void): () => void {
  window.addEventListener(CHANGED, listener);
  return () => window.removeEventListener(CHANGED, listener);
}

export function uiScale(): number {
  const percent = Number(storage()?.getItem(UI_SCALE_KEY));
  return UI_SCALE_STEPS.includes(percent as (typeof UI_SCALE_STEPS)[number]) ? percent : 100;
}

/** Main applies the zoom as soon as the preference is written. */
export function setUiScale(percent: number): void {
  try { storage()?.setItem(UI_SCALE_KEY, String(percent)); } catch { /* This session only. */ }
  window.dispatchEvent(new CustomEvent(CHANGED));
}

let syncPause: (() => void) | undefined;
/** Puts the prefs on <html>; call once at startup and after each change. */
export function applyAppearancePrefs(): void {
  const prefs = appearancePrefs();
  const root = document.documentElement;
  root.dataset.sykaPointer = prefs.pointerCursors ? 'true' : 'false';
  if (!syncPause) {
    syncPause = () => { root.dataset.sykaPaused = appearancePrefs().pauseInBackground && !document.hasFocus() ? 'true' : 'false'; };
    window.addEventListener('focus', syncPause);
    window.addEventListener('blur', syncPause);
  }
  syncPause();
}
