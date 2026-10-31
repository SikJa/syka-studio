import { closeResourceIndexes } from '../src/host/resource-index';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { CreativeResearch } from '../src/host/creative-research';
import { resourceScore, smallResponse } from '../src/host/creative-search';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let root: string, docs: string, config: string, first: string, second: string;
const query = { action: 'list', kind: 'sounds', audioType: 'music', query: 'música elegante' } as const;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'syka-creative-search-'));
  docs = join(root, 'docs'); config = join(root, 'profile', 'resources.json');
  first = join(root, 'project-a'); second = join(root, 'project-b');
  const sounds = join(docs, 'resources', 'sounds');
  await Promise.all([mkdir(sounds, { recursive: true }), mkdir(first), mkdir(second)]);
  const entries = ['A', 'B', 'C', 'D'].map((name, i) => ({ path: name + '.wav', title: 'Elegant ' + name, brand: 'fixture', audioType: 'music', compositionFamily: i < 2 ? 'same-chords' : name, license: 'MIT' }));
  await Promise.all(entries.map(entry => writeFile(join(sounds, entry.path), 'fixture-' + entry.path)));
  await writeFile(join(sounds, 'catalog.json'), JSON.stringify({ version: 1, entries }));
});
afterEach(async () => {
  await closeResourceIndexes(config);
  if (!root.startsWith(join(tmpdir(), 'syka-creative-search-'))) throw Error('Unexpected cleanup root');
  await rm(root, { recursive: true, force: true });
});

describe('bounded creative research', () => {
  it('requires the specific intent while matching Spanish/English audio terms', () => {
    expect(resourceScore('música elegante', 'music elegant glass')).toBeGreaterThan(0);
    expect(resourceScore('metal suave', 'metallic soft')).toBeGreaterThan(0);
    expect(resourceScore('Cuelume press', 'Cuelume success')).toBe(0);
    expect(resourceScore('2', 'whoosh-1')).toBe(0);
  });
  it('holds the serialized budget, paginates without gaps and rejects a single oversized payload', () => {
    const result = smallResponse({ entries: Array.from({ length: 8 }, (_, id) => ({ id, content: 'x'.repeat(900) })), nextOffset: null }, 3000, 5);
    const characters = JSON.stringify(result, null, 2).length;
    expect(characters).toBeLessThanOrEqual(3000);
    expect(result.budget.characters).toBe(characters);
    expect(result.nextOffset).toBe(5 + result.entries.length);
    expect(() => smallResponse({ entries: ['x'.repeat(12000)], nextOffset: null }, 3000)).toThrow('exceeds');
  });
  it('diversifies a new piece and other projects, but retains a revision choice', async () => {
    const a = new CreativeResearch(first, docs, config), b = new CreativeResearch(second, docs, config);
    const initial = await a.resources(query), chosen = initial.entries[0]!;
    await a.call({ action: 'choose', id: chosen.id, role: 'music', reason: 'Encaja con el carácter de la pieza.' });
    expect((await a.resources(query)).entries[0]!.id).toBe(chosen.id);
    const other = (await b.resources(query)).entries[0]!;
    expect(other.id).not.toBe(chosen.id);
    expect(other.compositionFamily).not.toBe(chosen.compositionFamily);
    const newPiece = (await a.resources({ ...query, newPiece: true })).entries[0]!;
    expect(newPiece.id).not.toBe(chosen.id);
    expect(newPiece.compositionFamily).not.toBe(chosen.compositionFamily);
    const events = await readdir(join(root, 'profile', 'creative-usage', 'choices'));
    const shared = JSON.parse(await readFile(join(root, 'profile', 'creative-usage', 'choices', events[0]!), 'utf8'));
    expect(shared.items[0].path).toBeUndefined();
    expect(shared.reason).toBeUndefined();
    expect(shared.project).toMatch(/^[a-f0-9]{64}$/);
  });
  it('requires a returned receipt and verifies the actual imported copy and source revision', async () => {
    const research = new CreativeResearch(first, docs, config);
    await expect(research.call({ action: 'choose', id: 'invented', role: 'music', reason: 'Guess' })).rejects.toThrow('receipt');
    const selected = (await research.resources(query)).entries[0]!;
    await expect(research.call({ action: 'choose', id: selected.id, role: 'sfx', reason: 'Wrong type' })).rejects.toThrow('SFX');
    await copyFile(selected.path, join(first, 'music.wav'));
    const result = await research.call({ action: 'choose', id: selected.id, role: 'music', reason: 'Actual copy', projectAsset: 'music.wav' });
    expect(result).toMatchObject({ imported: 'music.wav' });
    await writeFile(join(first, 'music.wav'), 'different');
    await expect(research.call({ action: 'choose', id: selected.id, role: 'music', reason: 'Bad copy', projectAsset: 'music.wav' })).rejects.toThrow('differs');
    await expect(research.call({ action: 'choose', id: selected.id, role: 'music', reason: 'Outside', projectAsset: '../file.wav' })).rejects.toThrow('belong');
    await writeFile(selected.path, 'updated source');
    await expect(research.call({ action: 'choose', id: selected.id, role: 'music', reason: 'Stale' })).rejects.toThrow('changed');
  });
  it('routes missing local music to permitted sources without claiming an external search or downloading', async () => {
    const research = new CreativeResearch(first, docs, config);
    const missing = await research.resources({ ...query, query: 'nonexistentfixtureinstrument' });
    expect(missing).toMatchObject({ entries: [], musicDecision: { state: 'source_or_create_or_ask', freshCandidates: 0 } });
    expect(missing).toMatchObject({ musicDecision: { nextAction: expect.stringContaining('Mixkit') } });
    expect(missing).toMatchObject({ musicDecision: { nextAction: expect.stringContaining('did not query or download') } });
  });
  it('distinguishes discovery, actual text reads and stale reference evidence', async () => {
    const research = new CreativeResearch(first);
    const path = join(first, 'reference.md'), text = 'A real source with a reading hold.';
    await writeFile(path, text);
    const row = { id: 'ref-a', sourcePath: path, sourceSha256: createHash('sha256').update(text).digest('hex') };
    await research.recordReferences({ results: [row] });
    expect((await research.planEvidence({ brief: { references: [{ id: row.id }] } })).references[0]!.recordedRead).toBe(false);
    await research.recordReferences({ results: [{ ...row, sourceText: text.slice(0, 12), textOffset: 0 }] });
    expect((await research.planEvidence({ brief: { references: [{ id: row.id }] } })).references[0]).toMatchObject({ recordedRead: true, sourceUnchanged: true, characters: 12 });
    await research.call({ action: 'choose', id: row.id, role: 'motion', reason: 'Apply the hold.' });
    await writeFile(path, text + ' revised');
    expect((await research.planEvidence({ brief: { references: [{ id: row.id }] } })).references[0]!.sourceUnchanged).toBe(false);
  });
  it('does not lose independent choices written concurrently and rejects redirected history', async () => {
    const a = new CreativeResearch(first, docs, config), b = new CreativeResearch(first, docs, config);
    const selected = (await a.resources(query)).entries[0]!;
    await Promise.all([a.call({ action: 'choose', id: selected.id, role: 'music', reason: 'Audio' }), b.call({ action: 'choose', id: selected.id, role: 'technical', reason: 'License checked' })]);
    expect((await a.call({ action: 'status' }) as { choices: unknown[] }).choices).toHaveLength(2);
    await symlink(first, join(second, '.syka'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(new CreativeResearch(second).call({ action: 'status' })).rejects.toThrow('configured root');
  });
  it('returns the real eight shipped music beds, relevant matches and excluded alternatives', async () => {
    const research = new CreativeResearch(first, join(repo, 'docs'), config);
    const all = await research.resources({ ...query, query: '', limit: 12 });
    expect(all.total).toBe(8);
    expect(new Set(all.entries.map(entry => entry.id)).size).toBe(all.entries.length);
    expect(JSON.stringify(all, null, 2).length).toBeLessThanOrEqual(6000);
    const matched = await research.resources(query);
    expect(matched.total).toBeGreaterThanOrEqual(2);
    await research.call({ action: 'choose', id: matched.entries[0]!.id, role: 'music', reason: 'Prueba con el catálogo realmente distribuido.' });
    const otherProject = new CreativeResearch(second, join(repo, 'docs'), config);
    expect((await otherProject.resources(query)).entries[0]!.id).not.toBe(matched.entries[0]!.id);
    const alternatives = await research.resources({ ...query, excludeIds: matched.entries.map(entry => entry.id!) });
    expect(alternatives.entries.every(entry => !matched.entries.some(original => original.id === entry.id))).toBe(true);
  });
});
