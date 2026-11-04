import { createSignal } from 'solid-js';

/** Seen per release: a new version opens the story once, a reopen never marks anything. */
export const WHATS_NEW_RELEASE = '0.211.0';
export const WHATS_NEW_STORAGE_KEY = 'syka.whatsNew.seen';

const [open, setOpen] = createSignal(false);
const [session, setSession] = createSignal(0);
export { open as whatsNewOpen, session as whatsNewSession };

export function hasSeenWhatsNew(release = WHATS_NEW_RELEASE): boolean {
  try { return localStorage.getItem(WHATS_NEW_STORAGE_KEY) === release; }
  catch { return true; }
}

export function rememberWhatsNewSeen(release = WHATS_NEW_RELEASE): void {
  try { localStorage.setItem(WHATS_NEW_STORAGE_KEY, release); }
  catch { /* Private storage: it simply opens again next time. */ }
}

export function openWhatsNew(): void {
  if (open()) return;
  setSession(value => value + 1);
  setOpen(true);
}

export function closeWhatsNew(): void {
  rememberWhatsNewSeen();
  setOpen(false);
}
