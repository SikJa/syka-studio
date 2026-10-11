/** Resolve SVG export dimensions without treating relative units as pixels. */
export function svgDimensions(widthValue: string | null, heightValue: string | null, viewBox: string | null): { width: number; height: number } {
  const length = (value: string | null): number => {
    const match = value?.trim().match(/^([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(px|in|cm|mm|q|pt|pc)?$/i);
    if (!match) return 0;
    const factors: Record<string, number> = { px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, pt: 96 / 72, pc: 16 };
    const n = Number(match[1]) * (factors[match[2]?.toLowerCase() ?? 'px'] ?? 1);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  let width = length(widthValue), height = length(heightValue);
  const parts = viewBox?.trim().split(/[\s,]+/).map(Number);
  if (parts?.length === 4 && parts.every(Number.isFinite) && parts[2]! > 0 && parts[3]! > 0) {
    const ratio = parts[2]! / parts[3]!;
    if (width && !height) height = width / ratio;
    else if (height && !width) width = height * ratio;
    else if (!width && !height) { width = parts[2]!; height = parts[3]!; }
  }
  return { width: width || 300, height: height || 150 };
}
