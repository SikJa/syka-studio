import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DEFAULT_READ_CHARS, MAX_READ_CHARS, readTextSnapshot, type TextReadOptions, type TextSnapshot, type TextSection, validateTextReadOptions } from './bounded-text';

type Dependency = { name: string; sectionId: string; file?: string; when: string };
type Section = { id: string; heading: string; description?: string; dependencies?: Dependency[] };
type Manifest = { version: 1; required: string[]; sections: Section[] };
const manifests = new Map<string, Manifest>();
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value);

async function sectionManifest(snapshot: TextSnapshot): Promise<Manifest | undefined> {
  const path = join(dirname(snapshot.path), 'syka-sections.json');
  try { if ((await stat(path)).size > 32_768) throw Error('Bundled skill section manifest exceeds 32 KiB'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  const manifestText = await readTextSnapshot(snapshot.root, path);
  const cacheKey = manifestText.root + '\0' + manifestText.path + '\0' + manifestText.sha256;
  const cached = manifests.get(cacheKey); if (cached) return cached;
  let raw: unknown;
  try { raw = JSON.parse(manifestText.content); } catch { throw Error('Invalid bundled skill section manifest JSON'); }
  const manifest = raw as Manifest;
  if (!raw || typeof raw !== 'object' || manifest.version !== 1 || !Array.isArray(manifest.required) || !manifest.required.length || !Array.isArray(manifest.sections) || !manifest.sections.length || manifest.sections.length > 64) throw Error('Invalid bundled skill section manifest');
  const ids = new Set<string>();
  for (const section of manifest.sections) {
    if (!section || !identifier(section.id) || ids.has(section.id) || typeof section.heading !== 'string' || !section.heading || section.heading.length > 300) throw Error('Invalid or duplicate bundled skill section');
    ids.add(section.id);
    if (section.description !== undefined && (typeof section.description !== 'string' || section.description.length > 1000)) throw Error('Invalid bundled skill section description');
    if (section.dependencies !== undefined && (!Array.isArray(section.dependencies) || section.dependencies.length > 32 || section.dependencies.some(dep => !dep || typeof dep.name !== 'string' || !dep.name || !identifier(dep.sectionId) || typeof dep.when !== 'string' || (dep.file !== undefined && typeof dep.file !== 'string')))) throw Error('Invalid bundled skill dependencies');
  }
  if (new Set(manifest.required).size !== manifest.required.length || manifest.required.some(id => !identifier(id) || !ids.has(id))) throw Error('Invalid required bundled skill sections');
  if (manifests.size >= 128) manifests.delete(manifests.keys().next().value!);
  manifests.set(cacheKey, manifest);
  return manifest;
}

/** Explicit opt-in only. Dependency metadata is returned, never followed recursively. */
export async function readBundledSkill(snapshot: TextSnapshot, args: TextReadOptions & { phase?: string }, base: Record<string, unknown>): Promise<Record<string, unknown> | undefined> {
  const manifest = await sectionManifest(snapshot); if (!manifest) return;
  if (args.phase !== undefined && args.sectionId !== undefined && args.phase !== args.sectionId) throw Error('Use phase or the same sectionId');
  const sectionId = args.sectionId ?? args.phase;
  validateTextReadOptions({ ...args, ...(args.phase ? { mode: 'section' as const, sectionId } : {}) });
  if (args.mode && !['section', 'outline'].includes(args.mode) && !args.phase) return;
  if (args.offset !== undefined || args.endOffset !== undefined || args.startLine !== undefined || args.lineCount !== undefined) throw Error('Bundled section reads use sectionId; use explicit mode full/range/search for text pagination');
  const indexed = new Map<string, TextSection>();
  for (const section of manifest.sections) {
    const matches = snapshot.sections.filter(heading => heading.heading === section.heading);
    if (matches.length !== 1) throw Error(`Bundled skill section heading is missing or ambiguous: ${section.heading}`);
    indexed.set(section.id, matches[0]!);
  }
  const ordered = [...indexed.values()].sort((a, b) => a.startOffset - b.startOffset);
  for (let i = 1; i < ordered.length; i++) if (ordered[i - 1]!.endOffset > ordered[i]!.startOffset) throw Error('Bundled skill section headings must not overlap');
  if (sectionId && !indexed.has(sectionId)) throw Error('Unknown bundled skill sectionId. Read its outline first');
  const loaded = [...new Set([...manifest.required, ...(sectionId ? [sectionId] : [])])];
  const firstSection = Math.min(...[...indexed.values()].map(section => section.startOffset));
  const selected = loaded.map(id => ({ ...indexed.get(id)!, id })).sort((a, b) => a.startOffset - b.startOffset);
  const ranges = [{ startOffset: 0, endOffset: firstSection }, ...selected.map(section => ({ startOffset: section.startOffset, endOffset: section.endOffset }))];
  const merged: { startOffset: number; endOffset: number }[] = [];
  for (const range of ranges.sort((a, b) => a.startOffset - b.startOffset)) {
    const previous = merged.at(-1);
    if (previous && previous.endOffset >= range.startOffset) previous.endOffset = Math.max(previous.endOffset, range.endOffset);
    else merged.push({ ...range });
  }
  const content = merged.map(range => snapshot.content.slice(range.startOffset, range.endOffset)).join('\n\n');
  const omitted = manifest.sections.filter(section => !loaded.includes(section.id)).map(section => section.id);
  const result = { ...base, content, sha256: snapshot.sha256, characters: snapshot.content.length, totalLines: snapshot.lineStarts.length, mode: sectionId ? 'section' : 'outline',
    sections: manifest.sections.map(section => ({ ...section, required: manifest.required.includes(section.id), startLine: indexed.get(section.id)!.startLine, endLine: indexed.get(section.id)!.endLine })),
    loadedSections: loaded, dependencies: manifest.sections.filter(section => loaded.includes(section.id)).flatMap(section => section.dependencies ?? []),
    coverage: { fullFile: merged.length === 1 && merged[0]!.startOffset === 0 && merged[0]!.endOffset === snapshot.content.length, mandatoryComplete: true, selectedComplete: true, ranges: merged },
    truncated: omitted.length > 0, omittedSections: omitted, next: null,
    note: 'Required and selected sections are complete. Omitted sections and conditional dependencies are available on demand, not a continuation queue. They have not been loaded.' };
  const budget = args.maxChars ?? DEFAULT_READ_CHARS;
  if (budget > MAX_READ_CHARS || JSON.stringify(result).length > budget) throw Error('Required skill contract, selected section and index exceed maxChars; increase the output budget up to 96000. No mandatory instructions were truncated');
  return result;
}
