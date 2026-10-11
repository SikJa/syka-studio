import {describe,it,expect} from 'vitest';
import {recipeFormat} from './recipe-format';
describe('existing skills and recipe categories', () => {
  it('keeps old skills usable and ignores body instructions masquerading as metadata', () => {
    expect(recipeFormat('---\nname: old\ndescription: Old skill\n---\nmetadata:\n  format: reels')).toBe('general');
    expect(recipeFormat('---\nname: old\n---\n')).toBe('general');
  });
  it('reads optional YAML metadata for several independent recipes', () => {
    for (const format of ['reels','youtube'] as const) expect(recipeFormat('---\nname: style\nmetadata:\n  format: '+format+'\n---\n')).toBe(format);
    expect(recipeFormat('---\nname: style\nmetadata:\n  format: typo\n---\n')).toBe('general');
  });
});
