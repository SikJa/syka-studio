/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { commitSourceEdit, redoSourceEdit, undoSourceEdit } from "./edit-journal";
import { boundedTextRead, extendTextReadCoverage, invalidateTextSnapshot, readTextSnapshot, TEXT_READ_KEYS, TEXT_READ_SCHEMA, type TextReadCoverage, type TextReadOptions } from "./bounded-text";

const MAX_BYTES = 16 * 1024 * 1024;
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".html", ".svg", ".yaml", ".yml", ".txt", ".toml"]);
const RESERVED = new Set(["node_modules", "01 crudos", "01crudos", "02 finales", "02finales", "03 assets reutilizables", "03assetsreutilizables", "90 descartable", "90descartable"]);
const string = { type: "string" };
const schema = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });

export const SOURCE_TOOLS = [
  { type: "function", name: "syka_read_reference", description: "Read bundled editor reference/code examples relative to docs. Supports bounded text, outline, literal search, line ranges and sections. Returns full-file SHA and explicit coverage/next; partial content is incomplete. Use reference/jsx/captions.md before subtitles. Read-only; cannot access arbitrary paths.", inputSchema: schema({ path: string, ...TEXT_READ_SCHEMA }, ['path']) },
  { type: "function", name: "syka_read_source", description: "Read authoring source in the open project with full-file SHA, coverage and next. Supports full/range/outline/search/section; 24000 result characters by default, hard ceiling 96000. Reuse returned ranges for small corrections. Full replacement requires complete content; use syka_patch_source after a partial read. Cannot access outside files or media folders.", inputSchema: schema({ path: string, ...TEXT_READ_SCHEMA }, ['path']) },
  { type: "function", name: "syka_read_transcript", description: "Read a page of real timed words from a transcript JSON inside the open project's 03 Assets reutilizables/Transcripciones folder. Read-only, no transcription/provider request and no source edit. Use the path returned by media_transcribe. offset starts at 0; limit is 1-500 words. Returns text, word timestamps, totalWords and nextOffset (null when complete).", inputSchema: schema({ path: string, offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 500 } }) },
  { type: "function", name: "syka_edit_source", description: "Replace an existing authoring file with a reversible edit. Must supply SHA-256 from syka_read_source; stale edits fail. Source backup and historyId are returned. No shell or network.", inputSchema: schema({ path: string, expectedSha256: string, content: string }) },
  { type: "function", name: "syka_patch_source", description: "Reversibly replace one unique exact source fragment after a bounded read. Requires the full-file SHA and nonempty oldText matching exactly once; ambiguity/stale SHA fails. Preserves all unread bytes. Uses the same backup and shared undo/redo journal as syka_edit_source.", inputSchema: schema({ path: string, expectedSha256: string, oldText: string, newText: string }) },
  { type: "function", name: "syka_undo_source", description: "Undo the latest shared source edit from its Syka historyId. Must supply current SHA-256. Refuses to overwrite newer manual edits or undo an older history entry; participates in the same undo/redo history as the editor.", inputSchema: schema({ historyId: string, expectedSha256: string }) },
  { type: "function", name: "syka_redo_source", description: "Redo the shared source edit previously undone, using the same Syka historyId and current SHA-256. Refuses stale or superseded edits.", inputSchema: schema({ historyId: string, expectedSha256: string }) },
];

const hash = (content: Buffer | string) => createHash("sha256").update(content).digest("hex");
function inside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return !!rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep);
}
function fields(value: unknown, names: string[]): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid tool arguments");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !names.includes(key)) || names.some((key) => typeof record[key] !== "string")) throw new Error("Invalid tool arguments");
  return record as Record<string, string>;
}

export class SourceTools {
  private pending = Promise.resolve();
  // Coverage is authority local to this tool/session, never shared through the text cache.
  // Unknown coverage retains compatibility with existing SHA-only integrations.
  private readonly sourceCoverage = new Map<string, TextReadCoverage>();
  private readonly cwd: string;
  private readonly docsDir?: string;
  constructor(cwd: string, docsDir?: string) { this.cwd = cwd; this.docsDir = docsDir; }

  async call(tool: string, raw: unknown): Promise<unknown> {
    if (tool === "syka_read_reference") {
      const args = this.readArgs(raw);
      if (!this.docsDir) throw new Error("Bundled editor documentation is not configured");
      const root = await realpath(this.docsDir);
      const candidate = resolve(root, args.path!);
      if (!inside(root, candidate) || !EXTENSIONS.has(extname(candidate).toLowerCase())) throw new Error("Only bundled reference files are allowed");
      const file = await realpath(candidate);
      if (!inside(root, file)) throw new Error("Reference path escapes the bundled docs");
      return boundedTextRead(await readTextSnapshot(root, file), args, { path: relative(root, file) });
    }
    if (tool === "syka_read_transcript") return this.readTranscript(raw);
    if (tool === "syka_read_source") {
      const args = this.readArgs(raw);
      const file = await this.sourcePath(args.path!);
      const root = await realpath(this.cwd);
      const result = boundedTextRead(await readTextSnapshot(root, file), args, { path: relative(root, file) });
      const ranges = ['full', 'range', 'section'].includes(result.mode) ? [result.coverage] : [];
      // Exact ranges accumulate, including paginated reads, only in this tool/session.
      this.sourceCoverage.set(file, extendTextReadCoverage(this.sourceCoverage.get(file), result.sha256, result.characters, ranges));
      return result;
    }
    let result!: unknown;
    let failure: unknown;
    const task = this.pending.then(async () => {
      try {
        if (tool === "syka_edit_source") {
          const args = fields(raw, ["path", "expectedSha256", "content"]);
          result = await this.edit(args.path!, args.expectedSha256!, args.content!, true);
        } else if (tool === "syka_patch_source") {
          const args = fields(raw, ["path", "expectedSha256", "oldText", "newText"]);
          result = await this.patch(args.path!, args.expectedSha256!, args.oldText!, args.newText!);
        } else if (tool === "syka_undo_source" || tool === "syka_redo_source") {
          const args = fields(raw, ["historyId", "expectedSha256"]);
          if (!/^[a-f0-9-]{36}$/i.test(args.historyId!)) throw new Error("Invalid historyId");
          const history = await this.historyPath();
          const metadata = JSON.parse((await this.historyRead(history, args.historyId! + ".json")).toString("utf8")) as { path?: string; previousSha256?: string; journalEntryId?: string };
          if (typeof metadata.path !== "string") throw new Error("Invalid history record");
          const content = await this.historyRead(history, args.historyId! + ".source");
          if (hash(content) !== metadata.previousSha256) throw new Error("Source backup integrity mismatch");
          if (!metadata.journalEntryId) throw new Error("This legacy backup predates shared undo. Its original source is preserved, but use the current editor history to avoid overwriting newer edits.");
          await this.sourcePath(metadata.path);
          const restore = tool === "syka_redo_source" ? redoSourceEdit : undoSourceEdit;
          const restored = await restore({ projectDir: this.cwd, expectedEntryId: metadata.journalEntryId, expectedSha256: args.expectedSha256, expectedFilePath: metadata.path });
          result = { ...restored, historyId: args.historyId };
          const file = await this.sourcePath(metadata.path);
          invalidateTextSnapshot(await realpath(this.cwd), file);
          // Restore returns a revision, not all source text. Do not turn known
          // partial coverage into legacy/unknown permission to replace everything.
          if (this.sourceCoverage.has(file) && restored.sha256) this.sourceCoverage.set(file, { revision: restored.sha256, ranges: [], full: false });
          else this.sourceCoverage.delete(file);
        } else throw new Error("Unknown source tool");
      } catch (error) { failure = error; }
    });
    this.pending = task;
    await task;
    if (failure) throw failure;
    return result;
  }

  private readArgs(raw: unknown): TextReadOptions & { path: string } {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Invalid tool arguments');
    const args = raw as Record<string, unknown>;
    if (typeof args.path !== 'string' || Object.keys(args).some(key => key !== 'path' && !TEXT_READ_KEYS.includes(key))) throw Error('Invalid tool arguments');
    return args as TextReadOptions & { path: string };
  }

  private async readTranscript(raw: unknown): Promise<unknown> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid transcript arguments");
    const args = raw as { path?: unknown; offset?: unknown; limit?: unknown };
    if (Object.keys(args).some((key) => !["path", "offset", "limit"].includes(key)) || typeof args.path !== "string" ||
        !Number.isSafeInteger(args.offset) || (args.offset as number) < 0 ||
        !Number.isSafeInteger(args.limit) || (args.limit as number) < 1 || (args.limit as number) > 500) {
      throw new Error("Use a transcript path, offset >= 0 and a limit of 1-500 words");
    }
    const root = await realpath(this.cwd);
    const allowed = (file: string): boolean => {
      if (!inside(root, file) || extname(file).toLowerCase() !== ".json") return false;
      const parts = relative(root, file).split(sep);
      return parts.length >= 3 && parts[0]?.toLowerCase() === "03 assets reutilizables" &&
        parts[1]?.toLowerCase() === "transcripciones" && parts.every((part) => !part.startsWith("."));
    };
    const candidate = resolve(root, args.path);
    if (!allowed(candidate)) throw new Error("Only transcript JSON files in this project's 03 Assets reutilizables/Transcripciones are allowed");
    const file = await realpath(candidate);
    if (!allowed(file)) throw new Error("Transcript path escapes the project's transcript folder");
    const info = await stat(file);
    if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error("Transcript is missing or exceeds 8 MiB");
    const data = await readFile(file);
    if (data.length > 8 * 1024 * 1024) throw new Error("Transcript exceeds 8 MiB");
    let parsed: unknown;
    try { parsed = JSON.parse(data.toString("utf8")); }
    catch { throw new Error("Transcript JSON is invalid"); }
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { segments?: unknown }).segments)) throw new Error("Transcript must contain timed segments");
    const words: { text: string; start: number; end: number }[] = [];
    for (const segment of (parsed as { segments: unknown[] }).segments) {
      if (!segment || typeof segment !== "object" || !Array.isArray((segment as { words?: unknown }).words)) throw new Error("Transcript segment has no real word times");
      for (const entry of (segment as { words: unknown[] }).words) {
        if (!entry || typeof entry !== "object") throw new Error("Invalid transcript word");
        const word = entry as { text?: unknown; start?: unknown; end?: unknown };
        if (typeof word.text !== "string" || !word.text.trim() || word.text.length > 4000 ||
            typeof word.start !== "number" || typeof word.end !== "number" ||
            !Number.isFinite(word.start) || !Number.isFinite(word.end) ||
            word.start < 0 || word.end < word.start || word.end > 86400) throw new Error("Invalid transcript word timing");
        words.push({ text: word.text, start: word.start, end: word.end });
        if (words.length > 300000) throw new Error("Transcript exceeds the timed word limit");
      }
    }
    const offset = args.offset as number;
    const selected = words.slice(offset, offset + (args.limit as number));
    return { path: relative(root, file), text: selected.map((word) => word.text).join(" "), words: selected,
      totalWords: words.length, offset, nextOffset: offset + selected.length < words.length ? offset + selected.length : null };
  }

  private async sourcePath(path: string): Promise<string> {
    const root = await realpath(this.cwd);
    const candidate = resolve(root, path);
    if (!inside(root, candidate) || !EXTENSIONS.has(extname(candidate).toLowerCase())) throw new Error("Only authoring source files inside the open project are allowed");
    const parts = relative(root, candidate).split(sep);
    if (parts.some((part) => (part.startsWith(".") && ![".agents", ".codex"].includes(part)) || RESERVED.has(part.toLowerCase()))) throw new Error("Media, generated files and hidden folders cannot be edited as source");
    const resolved = await realpath(candidate);
    if (!inside(root, resolved) || !EXTENSIONS.has(extname(resolved).toLowerCase())) throw new Error("Source path escapes the open project");
    if (relative(root, resolved).split(sep).some((part) => (part.startsWith(".") && ![".agents", ".codex"].includes(part)) || RESERVED.has(part.toLowerCase()))) throw new Error("Resolved source path is a protected file");
    return resolved;
  }

  private async read(file: string): Promise<Buffer> {
    const info = await stat(file);
    if (!info.isFile() || info.size > MAX_BYTES) throw new Error("Source file is missing or exceeds 16 MiB");
    const data = await readFile(file);
    if (data.length > MAX_BYTES) throw new Error("Source file exceeds 16 MiB");
    return data;
  }

  private async historyPath(): Promise<string> {
    const root = await realpath(this.cwd);
    let directory = root;
    for (const name of ["90 Descartable", "Trabajo temporal", ".syka-history"]) {
      const next = join(directory, name);
      await mkdir(next).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
      directory = await realpath(next);
      if (!inside(root, directory)) throw new Error("History path escapes the open project");
    }
    return directory;
  }

  private async historyRead(history: string, name: string): Promise<Buffer> {
    const file = await realpath(join(history, name));
    if (!inside(history, file)) throw new Error("Backup path escapes Syka history");
    return this.read(file);
  }

  private async patch(path: string, expected: string, oldText: string, newText: string): Promise<unknown> {
    if (!oldText || Buffer.byteLength(oldText) > MAX_BYTES || Buffer.byteLength(newText) > MAX_BYTES) throw Error('Patch requires a nonempty exact fragment within 16 MiB');
    if (Buffer.from(oldText).toString('utf8') !== oldText || Buffer.from(newText).toString('utf8') !== newText) throw Error('Patch fragments must contain well-formed Unicode text');
    const file = await this.sourcePath(path);
    const before = await this.read(file);
    if (!/^[a-f0-9]{64}$/i.test(expected) || hash(before) !== expected) throw Error('Source changed since it was read. Read it again before editing');
    const content = before.toString('utf8');
    if (!Buffer.from(content).equals(before)) throw Error('Source is not valid UTF-8');
    const start = content.indexOf(oldText);
    if (start < 0) throw Error('Exact source fragment was not found; read the target range again');
    if (content.indexOf(oldText, start + 1) >= 0) throw Error('Exact source fragment is ambiguous; include more surrounding text');
    return this.edit(path, expected, content.slice(0, start) + newText + content.slice(start + oldText.length));
  }

  private async edit(path: string, expected: string, content: string, requireComplete = false): Promise<unknown> {
    if (!/^[a-f0-9]{64}$/i.test(expected) || Buffer.byteLength(content) > MAX_BYTES) throw new Error("Invalid source hash or oversized edit");
    if (content.includes('\0') || Buffer.from(content).toString('utf8') !== content) throw Error('Source edit must contain valid UTF-8 text without binary NUL bytes');
    const file = await this.sourcePath(path);
    const before = await this.read(file);
    if (hash(before) !== expected) throw new Error("Source changed since it was read. Read it again before editing");
    const coverage = this.sourceCoverage.get(file);
    if (requireComplete && coverage?.revision === expected && !coverage.full) throw Error('Only partial source content was read. Use syka_patch_source with an exact fragment, or read the complete file before replacing it');
    const nextHash = hash(content);
    if (nextHash === expected) return { path, sha256: expected, changed: false };
    const history = await this.historyPath();
    const historyId = randomUUID();
    const canonicalPath = relative(await realpath(this.cwd), file);
    await writeFile(join(history, historyId + ".source"), before, { flag: "wx" });
    const committed = await commitSourceEdit({ projectDir: this.cwd, filePath: canonicalPath, before, after: content, origin: "chat", label: "Edición de Codex" });
    await writeFile(join(history, historyId + ".json"), JSON.stringify({ path: canonicalPath, previousSha256: expected, nextSha256: nextHash, journalEntryId: committed.entryId, createdAt: new Date().toISOString() }), { flag: "wx" });
    invalidateTextSnapshot(await realpath(this.cwd), file);
    // A successful fragment patch does not grant knowledge of the remaining source.
    const full = requireComplete || coverage?.full === true;
    this.sourceCoverage.set(file, { revision: nextHash, ranges: full ? [{ startOffset: 0, endOffset: content.length }] : [], full });
    return { ...committed, path: canonicalPath, sha256: nextHash, historyId };
  }
}
