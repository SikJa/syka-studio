import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { replayAssetImport } from '../src/host/edit-journal';
const original = { version: 1, folders: ['Antes'], assets: [{ id: 'old', path: 'Antes/a.svg', source: '/original/a.svg' }] };
const imported = { id: 'new', path: 'Fotos/b.svg', source: '/original/b.svg' };
const generated = { id: 'generated', path: 'Fotos/render.svg', source: 'assets/render.svg', generation: { key: 'gen' } };
const after = { ...original, folders: ['Antes', 'Fotos'], assets: [imported, ...original.assets] };
describe('replay of imported asset metadata', () => {
  it('undoes and redoes imported additions while preserving later generation metadata and occupied folders', () => {
    const current = { ...after, assets: [generated, ...after.assets] };
    const undone = parse(replayAssetImport(stringify(original), stringify(after), stringify(current), false));
    expect(undone.assets).toEqual([generated, ...original.assets]); expect(undone.folders).toEqual(['Antes', 'Fotos']);
    const redone = parse(replayAssetImport(stringify(original), stringify(after), stringify(undone), true));
    expect(redone.assets).toEqual([imported, generated, ...original.assets]);
  });
  it('refuses to erase later changes to the imported asset or overwrite a conflicting path', () => {
    const renamed = { ...after, assets: [{ ...imported, path: 'Fotos/renamed.svg' }, ...original.assets] };
    expect(() => replayAssetImport(stringify(original), stringify(after), stringify(renamed), false)).toThrow('cambió');
    const conflict = { ...original, assets: [{ id: 'different', path: imported.path }, ...original.assets] };
    expect(() => replayAssetImport(stringify(original), stringify(after), stringify(conflict), true)).toThrow('ocupa');
  });
});
