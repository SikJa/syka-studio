import { createSignal } from 'solid-js';

export type SettingsPage = 'general' | 'profile' | 'appearance' | 'brand-kit' | 'zernio' | 'groq' | 'codex' | 'plugins' | 'skills' | 'tools' | 'storage' | 'shortcuts' | 'glossary' | 'help';
export const [settingsPage, setSettingsPage] = createSignal<SettingsPage | null>(null);
export function openSettings(page: SettingsPage = 'general') { setSettingsPage(page); }
export function closeSettings() { setSettingsPage(null); }

const motionKey = 'syka.settings.motion.v1';
function readMotion(): 'system' | 'reduced' {
  try { return localStorage.getItem(motionKey) === 'reduced' ? 'reduced' : 'system'; } catch { return 'system'; }
}
export const [motionPreference, setMotionPreference] = createSignal(readMotion());
export function saveMotionPreference(value: 'system' | 'reduced') {
  localStorage.setItem(motionKey, value);
  setMotionPreference(value);
}
