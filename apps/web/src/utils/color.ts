/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { colord } from "colord";
import { clamp } from "./common";

const NAMED_COLORS: Record<string, string> = {
  red: "FF0000",
  green: "008000",
  blue: "0000FF",
  white: "FFFFFF",
  black: "000000",
  yellow: "FFFF00",
  cyan: "00FFFF",
  magenta: "FF00FF",
  orange: "FFA500",
  purple: "800080",
  pink: "FFC0CB",
  gray: "808080",
  grey: "808080",
  brown: "A52A2A",
  lime: "00FF00",
  navy: "000080",
  teal: "008080",
  maroon: "800000",
  olive: "808000",
  aqua: "00FFFF",
  coral: "FF7F50",
  salmon: "FA8072",
  gold: "FFD700",
  silver: "C0C0C0",
  indigo: "4B0082",
  violet: "EE82EE",
  crimson: "DC143C",
  tomato: "FF6347",
  khaki: "F0E68C",
  plum: "DDA0DD",
  orchid: "DA70D6",
  tan: "D2B48C",
  beige: "F5F5DC",
  ivory: "FFFFF0",
  lavender: "E6E6FA",
  turquoise: "40E0D0",
  chartreuse: "7FFF00",
  sienna: "A0522D",
  peru: "CD853F",
  firebrick: "B22222",
  skyblue: "87CEEB",
  hotpink: "FF69B4",
  mint: "3EB489",
};

/**
 * Parses any colord-compatible input (hex with or without `#`, short hex,
 * `rgb()`, `hsl()`, named colors, etc.) into a numeric hex color (0xRRGGBB).
 *
 * For string input, applies a hex input fallback — normalizes
 * arbitrary input to a valid 6-char hex string.
 *
 * Rules (matches Figma's behavior):
 *   1. Strip all non-hex characters [^0-9A-Fa-f].
 *   2. Normalize the surviving hex string by length:
 *        0 chars → null (revert to previous color, no change)
 *        1 char  → repeat 6×              "A"     → "AAAAAA"
 *        2 chars → repeat 3×              "AB"    → "ABABAB"
 *        3 chars → CSS shorthand, double  "ABC"   → "AABBCC"
 *        4 chars → pad right with 0s      "ABCD"  → "ABCD00"
 *        5 chars → pad right with 0       "ABCDE" → "ABCDE0"
 *        6 chars → use as-is             "ABCDEF" → "ABCDEF"
 *        7+ chars → truncate to first 6  "ABCDEFG" → "ABCDEF"
 *   3. Return the result uppercased.
 *
 * This means typing gibberish still produces a deterministic color:
 *   "redredred"    → strip non-hex → "ededed" (6) → "EDEDED"
 *   "blueblueblue" → strip non-hex → "bebebe" (6) → "BEBEBE"
 *   "hello"        → strip non-hex → "e"      (1) → "EEEEEE"
 */
export function parseColor(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const named = NAMED_COLORS[trimmed.toLowerCase()];
  if (named) {
    return parseInt(named, 16);
  }

  const c = colord(trimmed);
  if (c.isValid()) {
    const { r, g, b } = c.toRgb();
    return rgbToColor(r, g, b);
  }

  const hex = trimmed.replace(/[^0-9A-Fa-f]/g, "");
  if (hex.length === 0) return null;

  let normalized: string;
  if (hex.length === 1) normalized = hex.repeat(6);
  else if (hex.length === 2) normalized = hex.repeat(3);
  else if (hex.length === 3) normalized = hex.split("").map((ch) => ch + ch).join("");
  else if (hex.length === 4) normalized = hex + "00";
  else if (hex.length === 5) normalized = hex + "0";
  else if (hex.length === 6) normalized = hex;
  else normalized = hex.slice(0, 6);

  return parseInt(normalized.toUpperCase(), 16);
}

/**
 * Converts RGB values to HSL values.
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns An object with h (0-360), s (0-100), l (0-100) values
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;

  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === nr) {
      h = ((ng - nb) / delta) % 6;
    } else if (max === ng) {
      h = (nb - nr) / delta + 2;
    } else {
      h = (nr - ng) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts HSL values to RGB channel values (0-255).
 * @param h - Hue value (0-360)
 * @param s - Saturation value (0-100)
 * @param l - Lightness value (0-100)
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sat = s / 100;
  const light = l / 100;

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/**
 * Converts RGB values to HSV values.
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns An object with h (0-360), s (0-100), v (0-100) values
 */
export function rgbToHsv(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; v: number } {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }

  if (h < 0) h += 360;

  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;
  return { h: Math.round(h), s, v };
}

/**
 * Converts HSV values to RGB values.
 * @param h - Hue value (0-360)
 * @param s - Saturation value (0-100)
 * @param v - Value value (0-100)
 * @returns An object with r, g, b values (0-255)
 */
export function hsvToRgb(
  h: number,
  s: number,
  v: number,
): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const val = clamp(v, 0, 100) / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hue < 60) {
    r1 = c;
    g1 = x;
  } else if (hue < 120) {
    r1 = x;
    g1 = c;
  } else if (hue < 180) {
    g1 = c;
    b1 = x;
  } else if (hue < 240) {
    g1 = x;
    b1 = c;
  } else if (hue < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/**
 * Merges a numeric hex color (0xRRGGBB) with an opacity to create a rgba string.
 * @param color - The numeric hex color to merge with the opacity
 * @param opacity - The opacity to merge with the color
 * @returns A rgba string representing the color with the opacity merged
 */
export function mergeColorWithOpacity(color: number = 0xFFFFFF, opacity: number = 1) {
  const clampedOpacity = Math.round(clamp(opacity, 0, 1) * 100) / 100;
  const r = (color >> 16) & 0xFF;
  const g = (color >> 8) & 0xFF;
  const b = color & 0xFF;
  return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`;
}

/**
 * Converts a numeric hex color (0xRRGGBB) to a CSS hex string (#RRGGBB).
 */
export function colorToHex(color: number): string {
  return "#" + ((1 << 24) | (color & 0xFFFFFF)).toString(16).slice(1).toUpperCase();
}

/**
 * Packs RGB channel values (0-255) into a numeric hex color (0xRRGGBB).
 */
export function rgbToColor(r: number, g: number, b: number): number {
  const rc = clamp(Math.round(r), 0, 255);
  const gc = clamp(Math.round(g), 0, 255);
  const bc = clamp(Math.round(b), 0, 255);
  return (rc << 16) | (gc << 8) | bc;
}

/**
 * Unpacks a numeric hex color (0xRRGGBB) into RGB channel values (0-255).
 */
export function colorToRgb(color: number): { r: number; g: number; b: number } {
  return {
    r: (color >> 16) & 0xFF,
    g: (color >> 8) & 0xFF,
    b: color & 0xFF,
  };
}
