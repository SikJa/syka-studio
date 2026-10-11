import { describe, expect, it } from 'vitest';
import { sameProjectFolder } from '../src/host/project-folder';

describe('project folder identity', () => {
  it('accepts Windows paths coming back from the editor with different separators, casing and trailing slashes', () => {
    const stored = 'F:\\Motions\\calm-forest-8-oct';
    for (const incoming of ['F:/Motions/calm-forest-8-oct', 'f:/motions/calm-forest-8-oct/', 'F:\\Motions\\.\\calm-forest-8-oct\\']) {
      expect(sameProjectFolder(stored, incoming, 'win32')).toBe(true);
    }
  });
  it('keeps different directories, drives and UNC shares distinct', () => {
    expect(sameProjectFolder('F:\\Motions\\one', 'F:/Motions/two', 'win32')).toBe(false);
    expect(sameProjectFolder('F:\\Motions\\one', 'C:/Motions/one', 'win32')).toBe(false);
    expect(sameProjectFolder('\\\\server\\share\\one', '//server/share/one/', 'win32')).toBe(true);
    expect(sameProjectFolder('\\\\server\\share\\one', '//server/other/one', 'win32')).toBe(false);
  });
  it('preserves case and literal backslashes on case-sensitive platforms', () => {
    expect(sameProjectFolder('/motions/one', '/motions/one/', 'linux')).toBe(true);
    expect(sameProjectFolder('/motions/One', '/motions/one', 'linux')).toBe(false);
    expect(sameProjectFolder('/motions/a\\b', '/motions/a/b', 'linux')).toBe(false);
  });
});
