import { describe, expect, it } from 'vitest';
import { uiDictionary } from './dictionary';
import { sourcePhrases } from './source-phrases';
import { sourceTranslations, supplementalTranslations } from './translations';

describe('stable UI dictionary', () => {
  it('keeps every authored Spanish phrase verbatim and maintains the reviewed source mapping', () => {
    expect(sourceTranslations).toHaveLength(sourcePhrases.length);
    const dictionary = uiDictionary(sourcePhrases, sourceTranslations, supplementalTranslations);
    for (let i = 0; i < sourcePhrases.length; i++) {
      expect(sourceTranslations[i].includes(sourcePhrases[i])).toBe(true);
      expect(dictionary.get(sourcePhrases[i])).toEqual(sourceTranslations[i]);
      if (sourcePhrases[i] === sourceTranslations[i][0]) expect(dictionary.get(sourcePhrases[i])![0]).toBe(sourcePhrases[i]);
    }
    expect(dictionary.get('Syka Studio')).toEqual(['Syka Studio', 'Syka Studio', 'Syka Studio']);
  });
  it('adding supplemental copy ahead of other extras cannot change existing names', () => {
    const row = ['Nuevo aviso', 'New notice', 'Novo aviso'] as const;
    const before = uiDictionary(sourcePhrases, sourceTranslations, supplementalTranslations);
    const after = uiDictionary(sourcePhrases, sourceTranslations, [row, ...supplementalTranslations]);
    for (const phrase of sourcePhrases) expect(after.get(phrase)).toEqual(before.get(phrase));
    expect(after.get(row[0])).toEqual(row);
  });
  it('retains authored labels when a source row is shifted instead of showing unrelated text', () => {
    const dictionary = uiDictionary(['Syka Studio', 'Inicio'], [
      ['Supr', 'Del', 'Delete'], ['Otro texto', 'Other text', 'Outro texto'],
    ], []);
    expect(dictionary.get('Syka Studio')).toEqual(['Syka Studio', 'Syka Studio', 'Syka Studio']);
    expect(dictionary.get('Inicio')).toEqual(['Inicio', 'Inicio', 'Inicio']);
  });
});
