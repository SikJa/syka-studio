import { describe, expect, it } from 'vitest';
import { clickedSelection, selectionIntersects } from './asset-selection';

describe('asset explorer selection', () => {
  const visible = ['folder:Clips', 'a', 'b', 'c', 'd'];
  it('replaces an ordinary click, toggles Ctrl and selects anchored Shift ranges', () => {
    expect(clickedSelection(visible, ['a', 'b'], 'c', 'a', {})).toEqual(['c']);
    expect(clickedSelection(visible, ['a', 'b'], 'b', 'a', { ctrlKey: true })).toEqual(['a']);
    expect(clickedSelection(visible, ['a'], 'c', 'a', { metaKey: true })).toEqual(['a', 'c']);
    expect(clickedSelection(visible, ['d'], 'c', 'a', { shiftKey: true })).toEqual(['a', 'b', 'c']);
    expect(clickedSelection(visible, ['d'], 'c', 'a', { ctrlKey: true, shiftKey: true })).toEqual(['d', 'a', 'b', 'c']);
  });
  it('handles filtered-out anchors and folder selections without stale ranges', () => {
    expect(clickedSelection(['a', 'c'], ['a'], 'c', 'b', { shiftKey: true })).toEqual(['c']);
    expect(clickedSelection(visible, [], 'b', 'folder:Clips', { shiftKey: true })).toEqual(['folder:Clips', 'a', 'b']);
  });
  it('selects intersecting cards and ignores cards outside the drag rectangle', () => {
    const box = { left: 8, right: 220, top: 20, bottom: 160 };
    expect(selectionIntersects(box, { left: 10, right: 110, top: 30, bottom: 95 })).toBe(true);
    expect(selectionIntersects(box, { left: 120, right: 240, top: 110, bottom: 170 })).toBe(true);
    expect(selectionIntersects(box, { left: 10, right: 110, top: 180, bottom: 250 })).toBe(false);
  });
});
