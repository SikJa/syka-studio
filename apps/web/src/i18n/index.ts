/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { createSignal } from 'solid-js';
import { translations } from './translations';
import { sourcePhrases } from './source-phrases';

export type Locale = 'es' | 'en' | 'pt-BR';
export const LOCALE_KEY = 'syka.settings.language.v1';
export function parseLocale(value: unknown): Locale {
  if (typeof value !== 'string') return 'es';
  if (value === 'en' || value.startsWith('en-')) return 'en';
  if (value === 'pt' || value.startsWith('pt-')) return 'pt-BR';
  return 'es';
}
function initialLocale(): Locale {
  try { return parseLocale(localStorage.getItem(LOCALE_KEY) ?? navigator.language); }
  catch { return 'es'; }
}
const [language, changeLanguage] = createSignal<Locale>(initialLocale());
export const locale = language;
export function setLocale(next: Locale): void {
  try { localStorage.setItem(LOCALE_KEY, next); } catch { /* Apply the language even if browser storage is unavailable. */ }
  changeLanguage(next);
  document.documentElement.lang = next;
}
if (typeof document !== 'undefined') document.documentElement.lang = language();

const dictionary = new Map<string, readonly [string, string, string]>();
// A source phrase has one meaning. Cross-language aliases would confuse e.g.
// English "Delete" with a Portuguese keyboard-label translation of "Del".
for (let i = 0; i < sourcePhrases.length; i++) dictionary.set(sourcePhrases[i], translations[i]);
for (const row of translations.slice(sourcePhrases.length)) {
  for (const phrase of row.slice(0, 2)) if (!dictionary.has(phrase)) dictionary.set(phrase, row);
}
/** Only UI-owned text is passed here. Project/chat/media content is untouched. */
export function t<T>(value: T): T {
  if (typeof value !== 'string') return value;
  const current = language();
  const row = dictionary.get(value.trim().replace(/\s+/g, ' '));
  if (!row) return value;
  const translated = row[current === 'en' ? 1 : current === 'pt-BR' ? 2 : 0];
  return value.replace(value.trim(), translated) as T;
}
