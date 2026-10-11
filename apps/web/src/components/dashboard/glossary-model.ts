/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { SykaGlossaryEntry } from "@desktop/main-channels";

/** Form-only checks; the local service owns duplicate/conflict validation. */
export function glossaryEntryFromDraft(draft: { id: string; term: string; variantsText: string; enabled: boolean }): SykaGlossaryEntry {
  const clean = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, " ");
  const term = clean(draft.term);
  const variants = draft.variantsText.split(/\r?\n/).map(clean).filter(Boolean);
  if (!term) throw new Error("Escribí el término tal como querés que aparezca.");
  if (Array.from(term).length > 80) throw new Error("El término puede tener hasta 80 caracteres.");
  if (variants.length > 12) throw new Error("Podés agregar hasta 12 variantes por término.");
  if (variants.some(variant => Array.from(variant).length > 80)) throw new Error("Cada variante puede tener hasta 80 caracteres.");
  return { id: draft.id, term, variants, enabled: draft.enabled };
}

/** Search is accent-insensitive; exact spelling is preserved in saved entries. */
export function matchingGlossaryEntries(entries: readonly SykaGlossaryEntry[], query: string): SykaGlossaryEntry[] {
  const searchable = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  const needle = searchable(query.trim());
  return entries.filter(entry => !needle || [entry.term, ...entry.variants].some(value => searchable(value).includes(needle)));
}
