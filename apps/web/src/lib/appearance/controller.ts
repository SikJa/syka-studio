import { createSignal } from 'solid-js';
import { accentTokens, DEFAULT_ACCENT, parseColor } from './color.ts';

export const APPEARANCE_KEY = 'syka.appearance.v1';
export function readAccent(storage: Pick<Storage, 'getItem'>): string {
  try { const data = JSON.parse(storage.getItem(APPEARANCE_KEY) ?? 'null'); return data?.version === 1 ? parseColor(data.accent) ?? DEFAULT_ACCENT : DEFAULT_ACCENT; }
  catch { return DEFAULT_ACCENT; }
}
function initialAccent() { try { return readAccent(localStorage); } catch { return DEFAULT_ACCENT; } }
export const [accent, setAccentSignal] = createSignal(initialAccent());
export const [appearanceSaved, setAppearanceSaved] = createSignal(true);
let root: HTMLElement | undefined;
function apply() {
  if (!root) return;
  // Kobalte is the source of truth. The embedded React composer and MetalFX
  // still consume data-theme; keep the alias in sync for portalled surfaces too.
  root.dataset.theme = root.dataset.kbTheme === 'dark' ? 'dark' : 'light';
  for (const [key, value] of Object.entries(accentTokens(accent(), root.dataset.kbTheme === 'dark'))) root.style.setProperty(key, value);
}
export function previewAccent(value: string) { const parsed = parseColor(value); if (!parsed) return false; setAccentSignal(parsed); apply(); return true; }
export function saveAccent(value: string) {
  if (!previewAccent(value)) return false;
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ version: 1, accent: accent() })); setAppearanceSaved(true); }
  catch { setAppearanceSaved(false); }
  return true;
}
/** Mount before the app's first paint. Observe Kobalte's actual root theme. */
export function initializeAppearance(element = document.documentElement) {
  root = element; apply();
  const observer = new MutationObserver(apply);
  observer.observe(element, { attributes: true, attributeFilter: ['data-kb-theme'] });
  const sync = (event: StorageEvent) => {
    if (event.key !== APPEARANCE_KEY && event.key !== null) return;
    setAccentSignal(initialAccent()); apply();
  };
  window.addEventListener('storage', sync);
  return () => { observer.disconnect(); window.removeEventListener('storage', sync); root = undefined; };
}
