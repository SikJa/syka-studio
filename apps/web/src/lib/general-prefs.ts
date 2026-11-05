/**
 * General settings that belong to this computer, Syka Code's `general-prefs`
 * for Syka Studio. They live in the desktop preferences (main reads
 * `closeToTray` from there) and fall back to localStorage in a browser. Plain
 * functions, so both the Solid settings and the React chat composer read them.
 */

export type GeneralPrefs = {
  /** First message names the chat. */
  autoTitles: boolean;
  /** What Enter does while a turn is running; Ctrl+Enter does the other. */
  followUpMode: 'queue' | 'steer';
  /** Enter sends, or Ctrl+Enter sends and Enter adds a line. */
  enterBehavior: 'enter' | 'ctrl-enter';
  /** The context ring in the composer. */
  showContextUsage: boolean;
  /** Closing the window hides it in the tray and keeps work running. */
  closeToTray: boolean;
};

export const DEFAULT_GENERAL_PREFS: GeneralPrefs = {
  autoTitles: true,
  followUpMode: 'queue',
  enterBehavior: 'enter',
  showContextUsage: true,
  closeToTray: false,
};

export const GENERAL_PREFS_KEY = 'dspro.ui.general.v1';
const CHANGED = 'syka:general-prefs';

function storage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try { return window.desktop?.preferences ?? window.localStorage; } catch { return undefined; }
}

let cached: GeneralPrefs | undefined;
export function generalPrefs(): GeneralPrefs {
  if (cached) return cached;
  let stored: Partial<GeneralPrefs> = {};
  try { stored = JSON.parse(storage()?.getItem(GENERAL_PREFS_KEY) ?? '{}') ?? {}; } catch { stored = {}; }
  cached = { ...DEFAULT_GENERAL_PREFS, ...stored };
  return cached;
}

export function updateGeneralPrefs(patch: Partial<GeneralPrefs>): void {
  const next = { ...generalPrefs(), ...patch };
  cached = next;
  try { storage()?.setItem(GENERAL_PREFS_KEY, JSON.stringify(next)); } catch { /* Kept for this session only. */ }
  window.dispatchEvent(new CustomEvent(CHANGED));
}

/** Calls `listener` whenever the prefs change in this window. */
export function onGeneralPrefsChange(listener: () => void): () => void {
  window.addEventListener(CHANGED, listener);
  return () => window.removeEventListener(CHANGED, listener);
}

/**
 * Ctrl+Enter in the composer sends with the other follow-up mode. The composer
 * marks it right before submitting and the chat panel reads it once.
 */
let alternate = false;
export function markAlternateSubmit(value: boolean): void { alternate = value; }
export function takeAlternateSubmit(): boolean { const value = alternate; alternate = false; return value; }
