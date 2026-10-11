/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { FONT_LIMIT } from "@diffusionstudio/dapi";
import { FontStyle } from "@diffusionstudio/runtime";
import { getAvailableFonts } from "@/engine/fonts";

import type { FontFamily } from "@diffusionstudio/dapi";
import type { ToolHandler } from "../handler";

/**
 * The machine's fonts, from the same Local Font Access listing the text
 * inspector shows, so the tool answers alike on every platform and names
 * exactly the families the editor can render. The catalog knows two styles;
 * an oblique is an italic to anyone choosing a font.
 */
export const fonts: ToolHandler<"fonts"> = async ({ family, weights, style, limit = FONT_LIMIT }) => {
  const pattern = family?.toLowerCase();
  const wanted = weights && weights.length > 0 ? new Set(weights) : null;

  const local = await getAvailableFonts();

  const families: FontFamily[] = [];
  for (const entry of local) {
    if (entry.family.startsWith(".") || (pattern && !entry.family.toLowerCase().includes(pattern))) continue;

    const variants = entry.variants
      .map((v) => ({
        weight: v.weight ?? "400",
        style: (v.style ?? FontStyle.NORMAL) === FontStyle.NORMAL ? ("normal" as const) : ("italic" as const),
        source: entry.origin === 'imported' ? 'native-import' : v.source,
      }))
      .filter((v) => (!wanted || wanted.has(v.weight)) && (!style || v.style === style));

    if (variants.length > 0) {
      families.push({
        family: entry.family,
        variants,
        origin: entry.origin,
        license: entry.license,
        missingSpanish: entry.missingSpanish,
      });
    };
  }

  families.sort((a, b) => a.family.localeCompare(b.family));

  return { families: families.slice(0, limit), total: families.length };
};
