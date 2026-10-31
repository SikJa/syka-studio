import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';

export const DEFAULT_READ_CHARS = 24_000;
export const MAX_READ_CHARS = 96_000;
export const MAX_TEXT_BYTES = 16 * 1024 * 1024;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 128;
const CACHE_TTL_MS = 5 * 60_000;

export type TextReadOptions = {
  mode?: 'full' | 'range' | 'outline' | 'search' | 'section';
  offset?: number;
  endOffset?: number;
  startLine?: number;
  lineCount?: number;
  maxChars?: number;
  query?: string;
  sectionId?: string;
};
export type TextSection = { id: string; heading: string; level: number; startLine: number; endLine: number; startOffset: number; endOffset: number };
export type TextSnapshot = { root: string; path: string; content: string; sha256: string; bytes: number; lineStarts: number[]; sections: TextSection[] };
export type TextReadCoverage = { revision: string; ranges: { startOffset: number; endOffset: number }[]; full: boolean };
type CachedText = { snapshot: TextSnapshot; signature: string; checkedAt: number; touchedAt: number; weight: number };
const texts = new Map<string, CachedText>();
let cachedBytes = 0;
const keyOf = (root: string, path: string) => root + '\0' + path;
const within = (root: string, path: string) => { const rel = relative(root, path); return rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep); };
const signature = (info: Awaited<ReturnType<typeof stat>>) => `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
export const textSha256 = (content: string | Buffer) => createHash('sha256').update(content).digest('hex');

function evict(key: string) {
  const old = texts.get(key);
  if (old) { cachedBytes -= old.weight; texts.delete(key); }
}
/** Shared by chats in this host, never a claim that another model has read the text. */
export function invalidateTextSnapshot(root: string, path: string) { evict(keyOf(root, path)); }

/** Tool-instance state: never put model read coverage in the shared file cache. */
export function extendTextReadCoverage(previous: TextReadCoverage | undefined, revision: string, characters: number, readRanges: TextReadCoverage['ranges']): TextReadCoverage {
  const ranges = [...(previous?.revision === revision ? previous.ranges : []), ...readRanges].sort((a, b) => a.startOffset - b.startOffset);
  const merged: TextReadCoverage['ranges'] = [];
  for (const range of ranges) {
    if (range.startOffset < 0 || range.endOffset < range.startOffset || range.endOffset > characters) throw Error('Invalid read coverage');
    const last = merged.at(-1);
    if (last && last.endOffset >= range.startOffset) last.endOffset = Math.max(last.endOffset, range.endOffset);
    else merged.push({ ...range });
  }
  return { revision, ranges: merged, full: merged.length === 1 && merged[0]!.startOffset === 0 && merged[0]!.endOffset === characters };
}

export function indexText(content: string): Pick<TextSnapshot, 'lineStarts' | 'sections'> {
  const lineStarts = [0];
  for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) lineStarts.push(i + 1);
  const sections: TextSection[] = [];
  const openSections: TextSection[] = [];
  const ids = new Map<string, number>();
  let fence: { marker: string; length: number } | undefined;
  for (let line = 0; line < lineStarts.length; line++) {
    const start = lineStarts[line]!;
    const text = content.slice(start, lineStarts[line + 1] ?? content.length).replace(/[\r\n]+$/, '');
    const fenced = /^\s{0,3}(`{3,}|~{3,})/.exec(text);
    if (fenced) {
      const marker = fenced[1]![0]!, length = fenced[1]!.length;
      if (!fence) fence = { marker, length };
      else if (fence.marker === marker && length >= fence.length && /^\s{0,3}(?:`+|~+)\s*$/.test(text)) fence = undefined;
      continue;
    }
    if (fence) continue;
    const match = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(text);
    if (!match) continue;
    const level = match[1]!.length, heading = match[2]!;
    // Only open ancestors can end here; avoid rescanning every previous heading.
    while (openSections.length && openSections.at(-1)!.level >= level) {
      const section = openSections.pop()!;
      section.endOffset = start; section.endLine = line;
    }
    const base = heading.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
    const occurrence = (ids.get(base) ?? 0) + 1; ids.set(base, occurrence);
    const section = { id: occurrence === 1 ? base : `${base}-${occurrence}`, heading, level, startLine: line + 1, endLine: lineStarts.length, startOffset: start, endOffset: content.length };
    sections.push(section); openSections.push(section);
  }
  return { lineStarts, sections };
}

/** Cache hits still stat and resolve the file. Changed versions are read and hashed again. */
export async function readTextSnapshot(root: string, file: string): Promise<TextSnapshot> {
  const canonicalRoot = await realpath(root), path = await realpath(file);
  if (!within(canonicalRoot, path)) throw Error('Text path escapes its allowed root');
  const key = keyOf(canonicalRoot, path);
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await stat(path);
    if (!before.isFile() || before.size > MAX_TEXT_BYTES) throw Error('Text file is missing or exceeds 16 MiB');
    const stamp = signature(before), now = Date.now(), old = texts.get(key);
    if (old?.signature === stamp && now - old.checkedAt < CACHE_TTL_MS) {
      old.touchedAt = now;
      // Returning content is deliberate: the next chat/provider has no read proof.
      return old.snapshot;
    }
    const bytes = await readFile(path);
    if (bytes.length > MAX_TEXT_BYTES) throw Error('Text file exceeds 16 MiB');
    const after = await stat(path);
    if (signature(after) !== stamp || await realpath(path) !== path) { evict(key); continue; }
    const content = bytes.toString('utf8');
    if (content.includes('\0') || !Buffer.from(content).equals(bytes)) throw Error('Binary or invalid UTF-8 asset: use media tools');
    const snapshot = { root: canonicalRoot, path, content, sha256: textSha256(bytes), bytes: bytes.length, ...indexText(content) };
    evict(key);
    // Budget retained strings and index arrays too, not only UTF-8 file size.
    const weight = content.length * 2 + snapshot.lineStarts.length * 8 + snapshot.sections.reduce((sum, section) => sum + 256 + (section.heading.length + section.id.length) * 2, 0);
    if (weight <= MAX_CACHE_BYTES) {
      while (texts.size >= MAX_CACHE_ENTRIES || cachedBytes + weight > MAX_CACHE_BYTES) {
        const oldest = [...texts].sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0];
        if (!oldest) break; evict(oldest[0]);
      }
      texts.set(key, { snapshot, signature: stamp, checkedAt: now, touchedAt: now, weight }); cachedBytes += weight;
    }
    return snapshot;
  }
  throw Error('Text file changed while reading. Retry the read');
}

export const TEXT_READ_SCHEMA = {
  mode: { type: 'string', enum: ['full', 'range', 'outline', 'search', 'section'], description: 'Default: bounded text. Outline lists headings; section reads its stable id; search returns exact literal matches. Partial content is never a full-file replacement.' },
  startLine: { type: 'integer', minimum: 1, description: '1-based first line; cannot combine with offset.' },
  lineCount: { type: 'integer', minimum: 1 },
  offset: { type: 'integer', minimum: 0, description: '0-based UTF-16 character offset; cannot split a Unicode pair.' },
  endOffset: { type: 'integer', minimum: 0, description: 'Exclusive UTF-16 end of a requested text range. Continuations preserve this boundary.' },
  maxChars: { type: 'integer', minimum: 1024, maximum: MAX_READ_CHARS, description: 'Serialized result budget, default 24000, maximum 96000 characters.' },
  query: { type: 'string', description: 'Literal case-insensitive search text, required in search mode.' },
  sectionId: { type: 'string', description: 'Stable heading id from outline, required in section mode.' },
};
export const TEXT_READ_KEYS = Object.keys(TEXT_READ_SCHEMA);
export function validateTextReadOptions(args: TextReadOptions): void {
  if (args.mode !== undefined && !['full', 'range', 'outline', 'search', 'section'].includes(args.mode)) throw Error('Invalid text read mode');
  for (const key of ['offset', 'endOffset', 'startLine', 'lineCount', 'maxChars'] as const) if (args[key] !== undefined && (!Number.isSafeInteger(args[key]) || args[key]! < (key === 'offset' || key === 'endOffset' ? 0 : key === 'maxChars' ? 1024 : 1))) throw Error('Invalid text range or output budget');
  if (args.maxChars !== undefined && args.maxChars > MAX_READ_CHARS) throw Error('Text output budget exceeds 96000 characters');
  if (args.offset !== undefined && args.startLine !== undefined) throw Error('Use offset or startLine, not both');
  if (args.lineCount !== undefined && args.startLine === undefined) throw Error('lineCount requires startLine');
  if (args.mode === 'section' && (args.startLine !== undefined || args.lineCount !== undefined || args.endOffset !== undefined)) throw Error('Section reads use sectionId and optional offset');
  if ((args.mode === 'outline' || args.mode === 'search') && (args.startLine !== undefined || args.lineCount !== undefined || args.endOffset !== undefined)) throw Error('Outline/search use offset pagination, not line ranges');
  if (args.mode === 'search' && (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 512)) throw Error('Search requires 1-512 characters of literal query');
  if (args.mode === 'section' && (typeof args.sectionId !== 'string' || !args.sectionId)) throw Error('Section read requires sectionId from outline');
}

function safeEnd(content: string, offset: number) {
  let end = Math.min(content.length, offset);
  if (end > 0 && end < content.length && /[\uD800-\uDBFF]/.test(content[end - 1]!) && /[\uDC00-\uDFFF]/.test(content[end]!)) end--;
  if (end > 0 && content[end - 1] === '\r' && content[end] === '\n') end--;
  return end;
}
function safeStart(content: string, offset: number) {
  let start = Math.max(0, offset);
  if (start > 0 && start < content.length && /[\uD800-\uDBFF]/.test(content[start - 1]!) && /[\uDC00-\uDFFF]/.test(content[start]!)) start--;
  if (start > 0 && content[start - 1] === '\r' && content[start] === '\n') start--;
  return start;
}
function lineAt(snapshot: TextSnapshot, offset: number) {
  let low = 0, high = snapshot.lineStarts.length;
  while (low + 1 < high) { const mid = (low + high) >>> 1; if (snapshot.lineStarts[mid]! <= offset) low = mid; else high = mid; }
  return low + 1;
}
export type TextReadResult = Record<string, unknown> & { content: string; sha256: string; characters: number; mode: string; truncated: boolean; coverage: { fullFile: boolean; startOffset: number; endOffset: number; startLine: number; endLine: number }; nextOffset: number | null; next: unknown };

/** The ceiling includes JSON escaping and metadata, not just the string body. */
export function boundedTextRead(snapshot: TextSnapshot, args: TextReadOptions = {}, base: Record<string, unknown> = {}, contentLength?: number): TextReadResult {
  validateTextReadOptions(args);
  if (contentLength !== undefined && (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > MAX_READ_CHARS)) throw Error('Invalid text pagination length; maximum 96000');
  const { content } = snapshot, budget = args.maxChars ?? DEFAULT_READ_CHARS;
  const mode = args.mode ?? (args.startLine !== undefined || args.offset !== undefined ? 'range' : 'full');
  let start = args.offset ?? 0, requestedEnd = content.length;
  if (mode !== 'outline' && (start > content.length || safeStart(content, start) !== start)) throw Error('Invalid character offset or split Unicode/CRLF boundary');
  if (args.startLine !== undefined) {
    if (args.startLine > snapshot.lineStarts.length) throw Error('startLine exceeds totalLines');
    start = snapshot.lineStarts[args.startLine - 1]!;
    if (args.lineCount !== undefined) requestedEnd = snapshot.lineStarts[args.startLine - 1 + args.lineCount] ?? content.length;
  }
  if (mode === 'section') {
    const section = snapshot.sections.find(section => section.id === args.sectionId);
    if (!section) throw Error('Unknown sectionId. Read outline first');
    start = args.offset ?? section.startOffset; requestedEnd = section.endOffset;
    if (start < section.startOffset || start > section.endOffset) throw Error('Section offset is outside the selected section');
  }
  if (args.endOffset !== undefined) {
    if (args.endOffset > content.length || safeEnd(content, args.endOffset) !== args.endOffset) throw Error('Invalid endOffset or split Unicode/CRLF boundary');
    requestedEnd = Math.min(requestedEnd, args.endOffset);
  }
  if (requestedEnd < start) throw Error('Text range end precedes its start');
  const common = { ...base, sha256: snapshot.sha256, characters: content.length, totalLines: snapshot.lineStarts.length, mode };
  if (mode === 'outline') {
    const offset = args.offset ?? 0;
    if (offset > snapshot.sections.length) throw Error('Outline offset exceeds section count');
    const selected: TextSection[] = [];
    const result = { ...common, content: '', outlineKind: 'markdown-headings', sections: selected, totalSections: snapshot.sections.length, coverage: { fullFile: false, startOffset: 0, endOffset: 0, startLine: 1, endLine: 1 }, truncated: false, nextOffset: null as number | null, next: null as unknown };
    for (const section of snapshot.sections.slice(offset)) { selected.push(section); if (JSON.stringify(result).length > budget - 150) { selected.pop(); break; } }
    result.truncated = offset + selected.length < snapshot.sections.length;
    result.nextOffset = result.truncated ? offset + selected.length : null;
    result.next = result.truncated ? { mode: 'outline', offset: result.nextOffset } : null;
    if ((result.truncated && !selected.length) || JSON.stringify(result).length > budget) throw Error('Outline metadata exceeds maxChars; increase the output budget');
    return result;
  }
  if (mode === 'search') {
    const query = args.query!;
    // Match against the original string: lowercasing can change UTF-16 offsets (e.g. İ).
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
    const matches: { line: number; offset: number; content: string }[] = [];
    const result = { ...common, content: '', query, matches, coverage: { fullFile: false, startOffset: start, endOffset: content.length, startLine: lineAt(snapshot, start), endLine: snapshot.lineStarts.length }, truncated: false, nextOffset: null as number | null, next: null as unknown };
    let cursor = start;
    while (cursor < content.length) {
      pattern.lastIndex = cursor;
      const match = pattern.exec(content); if (!match) { cursor = content.length; break; }
      const found = match.index;
      const line = lineAt(snapshot, found), lineStart = snapshot.lineStarts[line - 1]!, lineEnd = snapshot.lineStarts[line] ?? content.length;
      const from = safeStart(content, Math.max(lineStart, found - 120)), to = safeEnd(content, Math.min(lineEnd, found + match[0].length + 160));
      matches.push({ line, offset: found, content: content.slice(from, to) });
      if (JSON.stringify(result).length > budget - 200) { matches.pop(); cursor = found; break; }
      cursor = found + match[0].length;
    }
    result.truncated = cursor < content.length;
    result.nextOffset = result.truncated ? cursor : null;
    result.next = result.truncated ? { mode: 'search', query, offset: cursor } : null;
    result.coverage.endOffset = cursor; result.coverage.endLine = lineAt(snapshot, cursor);
    if ((result.truncated && !matches.length) || JSON.stringify(result).length > budget) throw Error('Search metadata exceeds maxChars; increase the output budget');
    return result;
  }
  if (contentLength !== undefined) {
    const limit = Math.min(requestedEnd, start + contentLength);
    requestedEnd = safeEnd(content, limit);
    if (requestedEnd === start && limit > start) throw Error('Text pagination length splits a Unicode/CRLF boundary');
  }
  const make = (end: number): TextReadResult => {
    const moreRequested = end < requestedEnd;
    const legacyNext = contentLength !== undefined && mode !== 'section' && end < content.length;
    const next = moreRequested
      ? mode === 'section' ? { mode: 'section', sectionId: args.sectionId, offset: end }
        : { mode: 'range', offset: end, endOffset: requestedEnd }
      : legacyNext ? { mode: 'range', offset: end } : null;
    return { ...common, content: content.slice(start, end), requestedRange: { startOffset: start, endOffset: requestedEnd }, requestedRangeComplete: !moreRequested,
      coverage: { fullFile: start === 0 && end === content.length, startOffset: start, endOffset: end, startLine: lineAt(snapshot, start), endLine: lineAt(snapshot, Math.max(start, end - 1)) }, truncated: start > 0 || end < content.length,
      nextOffset: moreRequested || legacyNext ? end : null, next };
  };
  let low = start, high = requestedEnd;
  while (low < high) { const mid = Math.ceil((low + high) / 2); if (JSON.stringify(make(safeEnd(content, mid))).length <= budget) low = mid; else high = mid - 1; }
  const end = safeEnd(content, low), result = make(end);
  if (JSON.stringify(result).length > budget || (end === start && requestedEnd > start)) throw Error('Text metadata exceeds maxChars; increase the output budget');
  return result;
}
