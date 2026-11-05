import { describe, expect, it } from 'vitest';
import { parseUiScale, stepUiScale } from './ui-scale';

describe('interface scale', () => {
  it('only accepts the offered steps and walks them with Ctrl + / Ctrl − / Ctrl 0', () => {
    expect(parseUiScale('110')).toBe(110);
    expect(parseUiScale('113')).toBe(100);
    expect(parseUiScale(null)).toBe(100);
    expect(stepUiScale(100, 1)).toBe(110);
    expect(stepUiScale(150, 1)).toBe(150);
    expect(stepUiScale(80, -1)).toBe(80);
    expect(stepUiScale(125, 0)).toBe(100);
  });
});
