/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

type Row = readonly [string, string, string];

export function uiDictionary(phrases: readonly string[], sourceRows: readonly Row[], supplemental: readonly Row[]): Map<string, Row> {
  const dictionary = new Map<string, Row>();
  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i], row = sourceRows[i];
    // A shifted or incomplete catalog must retain the authored label, never
    // replace it with unrelated copy. Source coverage tests detect the mismatch.
    dictionary.set(phrase, row?.includes(phrase) ? row : [phrase, phrase, phrase]);
  }
  for (const row of supplemental) {
    for (const phrase of row.slice(0, 2)) if (!dictionary.has(phrase)) dictionary.set(phrase, row);
  }
  return dictionary;
}
