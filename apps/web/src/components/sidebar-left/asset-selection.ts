/** Selection mechanics shared by pointer, keyboard and rubber-band gestures. */
export function clickedSelection(visible: readonly string[], selected: readonly string[], key: string,
  anchor: string | null, modifiers: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) {
  const additive = modifiers.ctrlKey || modifiers.metaKey;
  const start = anchor ? visible.indexOf(anchor) : -1, end = visible.indexOf(key);
  if (modifiers.shiftKey && start >= 0 && end >= 0) {
    const range = visible.slice(Math.min(start, end), Math.max(start, end) + 1);
    return [...new Set([...(additive ? selected : []), ...range])];
  }
  if (additive) return selected.includes(key) ? selected.filter(id => id !== key) : [...selected, key];
  return [key];
}

export type SelectionRect = { left: number; top: number; right: number; bottom: number };
export function selectionIntersects(a: SelectionRect, b: SelectionRect) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}
