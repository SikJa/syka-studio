/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { describe, expect, it } from "vitest";
import { glossaryEntryFromDraft, matchingGlossaryEntries } from "./glossary-model";

const draft = { id: "58da7d5b-5a55-4aeb-91c6-29645965db6a", term: "Syka", variantsText: "", enabled: true };

describe("glossary form and search", () => {
  it("turns multiline phrases into variants without splitting words or changing preferred spelling", () => {
    const entry = glossaryEntryFromDraft({ ...draft, term: "  Syka  Clips ", variantsText: " Sica   Clips\r\n\n Zika Clips  " });
    expect(entry).toEqual({ id: draft.id, enabled: true, term: "Syka Clips", variants: ["Sica Clips", "Zika Clips"] });
  });
  it("supports a preferred term with no corrections and preserves disabled state", () => {
    expect(glossaryEntryFromDraft({ ...draft, enabled: false }).variants).toEqual([]);
    expect(glossaryEntryFromDraft({ ...draft, enabled: false }).enabled).toBe(false);
  });
  it("rejects empty preferred terms and over-limit entries before a save request", () => {
    expect(() => glossaryEntryFromDraft({ ...draft, term: "   " })).toThrow("Escribí");
    expect(() => glossaryEntryFromDraft({ ...draft, term: "a".repeat(81) })).toThrow("80");
    expect(() => glossaryEntryFromDraft({ ...draft, variantsText: Array.from({ length: 13 }, (_, i) => `Variant ${i}`).join("\n") })).toThrow("12");
    expect(() => glossaryEntryFromDraft({ ...draft, variantsText: "b".repeat(81) })).toThrow("80");
  });
  it("searches preferred terms and variants without rewriting saved case or accents", () => {
    const entries = [glossaryEntryFromDraft({ ...draft, term: "Mirel", variantsText: "Mirelle" }), glossaryEntryFromDraft({ ...draft, id: "other", term: "Córdoba", variantsText: "Cordova" })];
    expect(matchingGlossaryEntries(entries, "  mireLLE ")[0]?.term).toBe("Mirel");
    expect(matchingGlossaryEntries(entries, "cordoba")[0]?.term).toBe("Córdoba");
    expect(matchingGlossaryEntries(entries, "")).toHaveLength(2);
    expect(matchingGlossaryEntries(entries, "absent")).toHaveLength(0);
    expect(entries[1]?.term).toBe("Córdoba");
  });
});
