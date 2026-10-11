/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { commitSourceEdit, redoSourceEdit, undoSourceEdit } from "./edit-journal";

const MAX_BYTES = 16 * 1024 * 1024;
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".html", ".svg", ".yaml", ".yml", ".txt", ".toml"]);
const RESERVED = new Set(["node_modules", "01 crudos", "01crudos", "02 finales", "02finales", "03 assets reutilizables", "03assetsreutilizables", "90 descartable", "90descartable"]);
const string = { type: "string" };
const schema = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

export const SOURCE_TOOLS = [
  { type: "function", name: "syka_read_reference", description: "Read the editor's bundled reference and code examples, relative to its docs folder. Use reference/jsx/captions.md before authoring subtitles; INSTRUCTIONS.md and skills/editor.md describe the editing workflow. Read-only; cannot access project files or arbitrary paths.", inputSchema: schema({ path: string }) },
  { type: "function", name: "syka_read_source", description: "Read an existing authoring source, stylesheet, document, configuration or skill file in the open Syka project. Returns content and SHA-256; cannot access outside files or media folders.", inputSchema: schema({ path: string }) },
  { type: "function", name: "syka_read_transcript", description: "Read a page of real timed words from a transcript JSON inside the open project's 03 Assets reutilizables/Transcripciones folder. Read-only, no transcription/provider request and no source edit. Use the path returned by media_transcribe. offset starts at 0; limit is 1-500 words. Returns text, word timestamps, totalWords and nextOffset (null when complete).", inputSchema: schema({ path: string, offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 500 } }) },
  { type: "function", name: "syka_edit_source", description: "Replace an existing authoring file with a reversible edit. Must supply SHA-256 from syka_read_source; stale edits fail. Source backup and historyId are returned. No shell or network.", inputSchema: schema({ path: string, expectedSha256: string, content: string }) },
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
  private readonly cwd: string;
  private readonly docsDir?: string;
  constructor(cwd: string, docsDir?: string) { this.cwd = cwd; this.docsDir = docsDir; }

  async call(tool: string, raw: unknown): Promise<unknown> {
    if (tool === "syka_read_reference") {
      const args = fields(raw, ["path"]);
      if (!this.docsDir) throw new Error("Bundled editor documentation is not configured");
      const root = await realpath(this.docsDir);
      const candidate = resolve(root, args.path!);
      if (!inside(root, candidate) || !EXTENSIONS.has(extname(candidate).toLowerCase())) throw new Error("Only bundled reference files are allowed");
      const file = await realpath(candidate);
      if (!inside(root, file)) throw new Error("Reference path escapes the bundled docs");
      const info = await stat(file);
      if (!info.isFile() || info.size > 16 * 1024 * 1024) throw new Error("Reference exceeds 16 MiB");
      const content = await readFile(file, "utf8");
      if (Buffer.byteLength(content) > 16 * 1024 * 1024) throw new Error("Reference exceeds 16 MiB");
      return { path: relative(root, file), content };
    }
    if (tool === "syka_read_transcript") return this.readTranscript(raw);
    if (tool === "syka_read_source") {
      const args = fields(raw, ["path"]);
      const file = await this.sourcePath(args.path!);
      const content = await this.read(file);
      return { path: relative(await realpath(this.cwd), file), content: content.toString("utf8"), sha256: hash(content) };
    }
    let result!: unknown;
    let failure: unknown;
    const task = this.pending.then(async () => {
      try {
        if (tool === "syka_edit_source") {
          const args = fields(raw, ["path", "expectedSha256", "content"]);
          result = await this.edit(args.path!, args.expectedSha256!, args.content!);
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
          result = { ...await restore({ projectDir: this.cwd, expectedEntryId: metadata.journalEntryId, expectedSha256: args.expectedSha256, expectedFilePath: metadata.path }), historyId: args.historyId };
        } else throw new Error("Unknown source tool");
      } catch (error) { failure = error; }
    });
    this.pending = task;
    await task;
    if (failure) throw failure;
    return result;
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

  private async edit(path: string, expected: string, content: string): Promise<unknown> {
    if (!/^[a-f0-9]{64}$/i.test(expected) || Buffer.byteLength(content) > MAX_BYTES) throw new Error("Invalid source hash or oversized edit");
    const file = await this.sourcePath(path);
    const before = await this.read(file);
    if (hash(before) !== expected) throw new Error("Source changed since it was read. Read it again before editing");
    const nextHash = hash(content);
    if (nextHash === expected) return { path, sha256: expected, changed: false };
    const history = await this.historyPath();
    const historyId = randomUUID();
    const canonicalPath = relative(await realpath(this.cwd), file);
    await writeFile(join(history, historyId + ".source"), before, { flag: "wx" });
    const committed = await commitSourceEdit({ projectDir: this.cwd, filePath: canonicalPath, before, after: content, origin: "chat", label: "Edición de Codex" });
    await writeFile(join(history, historyId + ".json"), JSON.stringify({ path: canonicalPath, previousSha256: expected, nextSha256: nextHash, journalEntryId: committed.entryId, createdAt: new Date().toISOString() }), { flag: "wx" });
    return { ...committed, path: canonicalPath, sha256: nextHash, historyId };
  }
}
