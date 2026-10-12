import { colord } from 'colord';

export const DEFAULT_ACCENT = '#008CFF'; // Existing hsl(207 100% 50%), rounded to sRGB.
export type ColorFormat = 'HEX' | 'RGB' | 'HSL' | 'OKLCH';
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const linear = (n: number) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
const gamma = (n: number) => 255 * clamp(n <= .0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - .055);

/** A closed numeric grammar: never forward user CSS to a style property. */
export function parseColor(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 100) return null;
  const value = input.trim();
  if (/^#?(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
    return colord(value.startsWith('#') ? value : `#${value}`).toHex().toUpperCase();
  }
  const match = /^(rgb|hsl|oklch)\(\s*([\d.+-]+)(%?)\s*[, ]\s*([\d.+-]+)(%?)\s*[, ]\s*([\d.+-]+)(%?)\s*(?:\/\s*([\d.+-]+)(%?))?\s*\)$/i.exec(value);
  if (!match) return null;
  const [, mode, x, xp, y, yp, z, zp, alpha, ap] = match;
  const [a, b, c] = [Number(x), Number(y), Number(z)];
  const opacity = alpha === undefined ? 1 : Number(alpha) / (ap ? 100 : 1);
  if (![a, b, c, opacity].every(Number.isFinite) || opacity < 0 || opacity > 1) return null;
  let color;
  if (mode.toLowerCase() === 'rgb') {
    const rgb = [a / (xp ? 100 : 255), b / (yp ? 100 : 255), c / (zp ? 100 : 255)];
    if (rgb.some(v => v < 0 || v > 1)) return null;
    color = colord({ r: rgb[0] * 255, g: rgb[1] * 255, b: rgb[2] * 255, a: opacity });
  } else if (mode.toLowerCase() === 'hsl') {
    if (xp || !yp || !zp || a < 0 || a > 360 || b < 0 || b > 100 || c < 0 || c > 100) return null;
    color = colord({ h: a, s: b, l: c, a: opacity });
  } else {
    const l = a / (xp ? 100 : 1);
    if (yp || zp || l < 0 || l > 1 || b < 0 || b > .5 || c < 0 || c > 360) return null;
    const angle = c * Math.PI / 180, aa = b * Math.cos(angle), bb = b * Math.sin(angle);
    const ll = (l + .3963377774 * aa + .2158037573 * bb) ** 3;
    const mm = (l - .1055613458 * aa - .0638541728 * bb) ** 3;
    const ss = (l - .0894841775 * aa - 1.291485548 * bb) ** 3;
    color = colord({ r: gamma(4.0767416621 * ll - 3.3077115913 * mm + .2309699292 * ss), g: gamma(-1.2684380046 * ll + 2.6097574011 * mm - .3413193965 * ss), b: gamma(-.0041960863 * ll - .7034186147 * mm + 1.707614701 * ss), a: opacity });
  }
  return color.isValid() ? color.toHex().toUpperCase() : null;
}

export function formatColor(hex: string, format: ColorFormat): string {
  const color = colord(hex), { r, g, b, a } = color.toRgb();
  const alpha = a < 1 ? ` / ${Math.round(a * 100)}%` : '';
  if (format === 'HEX') return hex;
  if (format === 'RGB') return `rgb(${r} ${g} ${b}${alpha})`;
  if (format === 'HSL') { const hsl = color.toHsl(); return `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%${alpha})`; }
  const [rr, gg, bb] = [r, g, b].map(v => linear(v / 255));
  const l = Math.cbrt(.4122214708 * rr + .5363325363 * gg + .0514459929 * bb);
  const m = Math.cbrt(.2119034982 * rr + .6806995451 * gg + .1073969566 * bb);
  const s = Math.cbrt(.0883024619 * rr + .2817188376 * gg + .6299787005 * bb);
  const L = .2104542553 * l + .793617785 * m - .0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s;
  const B = .0259040371 * l + .7827717662 * m - .808675766 * s;
  return `oklch(${(L * 100).toFixed(2)}% ${Math.hypot(A, B).toFixed(4)} ${((Math.atan2(B, A) * 180 / Math.PI + 360) % 360).toFixed(2)}${alpha})`;
}

export function mix(a: string, b: string, t: number): string {
  const x = colord(a).toRgb(), y = colord(b).toRgb();
  return colord({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t }).toHex();
}
export function contrast(a: string, b: string): number {
  const luminance = (hex: string) => { const { r, g, b } = colord(hex).toRgb(); return .2126 * linear(r / 255) + .7152 * linear(g / 255) + .0722 * linear(b / 255); };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export const foreground = (hex: string) => contrast(hex, '#000000') >= contrast(hex, '#FFFFFF') ? '#000000' : '#FFFFFF';
function readable(color: string, surface: string, ratio: number): string {
  const target = foreground(surface);
  for (let i = 0; i <= 100; i++) { const candidate = mix(color, target, i / 100); if (contrast(candidate, surface) >= ratio) return candidate; }
  return target;
}
export function accentTokens(input: string, dark: boolean): Record<string, string> {
  const color = parseColor(input) ?? DEFAULT_ACCENT;
  const surface = dark ? '#171717' : '#FFFFFF';
  // Composite alpha once. Controls remain opaque and contrast is measurable.
  const primary = mix(surface, color, colord(color).alpha());
  const fg = foreground(primary), away = fg === '#000000' ? '#FFFFFF' : '#000000';
  const selected = mix(surface, primary, dark ? .24 : .14);
  const selectedFg = readable(primary, selected, 5);
  return {
    '--primary': primary, '--primary-foreground': fg,
    '--primary-hover': mix(primary, away, .12), '--primary-pressing': mix(primary, away, .22),
    '--tertiary': selected, '--tertiary-foreground': selectedFg,
    '--tertiary-hover': mix(selected, surface, .15), '--tertiary-pressing': mix(selected, surface, .3),
    '--selection': primary, '--selection-foreground': fg,
    '--ring': readable(primary, surface, 4.5), '--syka-accent-text': readable(primary, surface, 4.5),
  };
}
