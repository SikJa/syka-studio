/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { z } from "zod";
import { defineTool } from "../tool";

const FontStyle = z.enum(["normal", "italic"]);

export const FontFamily = z.object({
  family: z.string(),
  origin: z.enum(['included', 'imported', 'system']).optional(),
  license: z.string().optional(),
  missingSpanish: z.array(z.string()).optional().describe('Characters absent in at least one variant; avoid these fonts for Spanish subtitles.'),
  variants: z.array(
    z.object({
      weight: z.string().describe("CSS weight, 100-900"),
      style: FontStyle,
      source: z.string().describe("Font source identifier. Use the family in JSX; native imports are loaded by Syka."),
    }),
  ),
});

/** Families returned when no limit is given. */
export const FONT_LIMIT = 50;

export const fonts = defineTool({
  name: "fonts",
  title: "Available fonts",
  description:
    "List Syka's included fonts, native user imports, and permitted system fonts. These family names work in fontFamily on text and captions. Prefer included fonts for portable projects; imported fonts require the user's license and installation on the target machine. Use actual weights/styles, check missingSpanish, and suggest a coherent font pair rather than randomly changing fonts within a scene. Filter by family; total reports matches before the limit.",
  input: z.object({
    family: z.string().optional().describe("filter to families whose name contains this (case-insensitive)"),
    weights: z.array(z.string()).optional().describe('filter to variants with the given CSS weights, e.g. ["400", "700"]'),
    style: FontStyle.optional().describe("filter to variants with the given style, normal or italic"),
    limit: z.int().min(1).optional().describe(`return at most this many families (default: ${FONT_LIMIT})`),
  }),
  output: z.object({
    families: z.array(FontFamily),
    total: z.int().describe("families matching the filters before the limit; more than were returned means the list was cut"),
  }),
  environment: "renderer",
});
