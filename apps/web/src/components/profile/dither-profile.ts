import { createSignal } from 'solid-js';

/**
 * The dithercn avatar picked as the profile picture, after Syka Code's
 * `dither-profile.ts`: the values of its controls (name, fill, colour,
 * status, shape, glow, ring). Only on this computer; null = none chosen.
 */
export type DitherProfile = Readonly<Record<string, string | number | boolean>>;

const KEY = 'syka.profile.dither-avatar.v1';

function read(): DitherProfile | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return parsed !== null && typeof parsed === 'object' ? parsed as DitherProfile : null;
  } catch { return null; }
}

const [profile, setProfile] = createSignal<DitherProfile | null>(typeof localStorage === 'undefined' ? null : read());
export { profile as ditherProfile };

export function saveDitherProfile(value: DitherProfile | null): void {
  try {
    if (value === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(value));
  } catch { /* This session only. */ }
  setProfile(value);
}
