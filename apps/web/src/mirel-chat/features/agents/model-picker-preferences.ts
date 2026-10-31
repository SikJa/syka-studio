import { useEffect, useState } from 'react';

export type EffortOrientation = 'vertical' | 'horizontal';
export type ComposerMaterial = 'solid' | 'glass';
export type ModelPickerPreferences = { orientation: EffortOrientation; material: ComposerMaterial; favorites: string[] };
export const MODEL_PICKER_PRESENTATION_KEY = 'dspro.ui.agentChat.pickerPresentation';
const LEGACY_PRESENTATION_KEY = 'syka.studio.model-picker.presentation.v1';
export const MODEL_PICKER_PRESENTATION_EVENT = 'syka:model-picker-presentation';
const defaults: ModelPickerPreferences = { orientation: 'vertical', material: 'solid', favorites: [] };

/** Presentation only: never persist a chat's model, account, effort or service tier. */
export function readModelPickerPreferences(storage?: Pick<Storage, 'getItem'>): ModelPickerPreferences {
  try {
    const text = storage ? storage.getItem(MODEL_PICKER_PRESENTATION_KEY) : window.desktop?.preferences?.getItem(MODEL_PICKER_PRESENTATION_KEY) ?? localStorage.getItem(MODEL_PICKER_PRESENTATION_KEY) ?? localStorage.getItem(LEGACY_PRESENTATION_KEY);
    const data = JSON.parse(text ?? 'null');
    const raw = data?.value ?? data;
    return {
      orientation: raw?.orientation === 'horizontal' ? 'horizontal' : 'vertical',
      material: raw?.material === 'glass' ? 'glass' : 'solid',
      favorites: Array.isArray(raw?.favorites) ? [...new Set<string>(raw.favorites.filter((x: unknown): x is string => typeof x === 'string'))] : [],
    };
  } catch { return { ...defaults, favorites: [] }; }
}

export function applyModelPickerMaterial(preferences = readModelPickerPreferences()) {
  if (typeof document !== 'undefined') document.documentElement.dataset.sykaChatMaterial = preferences.material;
}

export function saveModelPickerPreferences(patch: Partial<ModelPickerPreferences>) {
  const next = { ...readModelPickerPreferences(), ...patch };
  const text = JSON.stringify({ value: next });
  // The stable runtime preference store survives app paths, ports and updates.
  const durable = window.desktop?.preferences;
  durable?.setItem(MODEL_PICKER_PRESENTATION_KEY, text);
  try { localStorage.setItem(MODEL_PICKER_PRESENTATION_KEY, text); } catch (error) { if (!durable) throw error; }
  applyModelPickerMaterial(next);
  window.dispatchEvent(new Event(MODEL_PICKER_PRESENTATION_EVENT));
}

export function subscribeModelPickerPreferences(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === MODEL_PICKER_PRESENTATION_KEY || event.key === null) listener(); };
  window.addEventListener('storage', storage);
  window.addEventListener(MODEL_PICKER_PRESENTATION_EVENT, listener);
  return () => { window.removeEventListener('storage', storage); window.removeEventListener(MODEL_PICKER_PRESENTATION_EVENT, listener); };
}

export function useModelPickerPreferences() {
  const [preferences, setPreferences] = useState(readModelPickerPreferences);
  useEffect(() => subscribeModelPickerPreferences(() => { const next = readModelPickerPreferences(); applyModelPickerMaterial(next); setPreferences(next); }), []);
  return preferences;
}

export function toggleModelFavorite(key: string) {
  const { favorites } = readModelPickerPreferences();
  saveModelPickerPreferences({ favorites: favorites.includes(key) ? favorites.filter(x => x !== key) : [...favorites, key] });
}
