/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { app } from "electron";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { MAIN_CHANNELS } from "./main-channels";
import type { SykaGlossary, SykaGlossaryEntry, SykaTranscriptSegment } from "./main-channels";
import type { mainBridge } from "./main-manager";

export const GLOSSARY_LIMITS = { entries: 200, characters: 80, variants: 12, bytes: 256 * 1024, promptBytes: 200 } as const;
const EMPTY_REVISION = "00000000-0000-0000-0000-000000000000";
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const edgePunctuation = /^\p{P}+|\p{P}+$/gu;
const fold = (value: string): string => value.normalize("NFC").toLocaleLowerCase("es");
const lookup = (value: string): string => fold(value.trim().replace(edgePunctuation, ""));
const escaped = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let saves: Promise<void> = Promise.resolve();

function label(value: unknown): string {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value)) throw new Error("Usá palabras sin saltos de línea ni caracteres ocultos.");
  const text = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (!text || [...text].length > GLOSSARY_LIMITS.characters || !/[\p{L}\p{N}]/u.test(text)) throw new Error("Cada término o variante debe tener entre 1 y 80 caracteres e incluir letras o números.");
  return text;
}

/** Exact, case-insensitive names; diacritics remain meaningful. No fuzzy rules. */
export function validateGlossaryEntries(value: unknown): SykaGlossaryEntry[] {
  if (!Array.isArray(value) || value.length > GLOSSARY_LIMITS.entries) throw new Error("El glosario admite hasta 200 términos.");
  const ids = new Set<string>();
  const names = new Set<string>();
  return value.map(raw => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).some(key => !["id", "term", "variants", "enabled"].includes(key))) throw new Error("Entrada de glosario inválida.");
    const entry = raw as Record<string, unknown>;
    if (typeof entry.id !== "string" || !UUID.test(entry.id) || ids.has(entry.id.toLowerCase()) || typeof entry.enabled !== "boolean" || !Array.isArray(entry.variants) || entry.variants.length > GLOSSARY_LIMITS.variants) throw new Error("Cada entrada necesita un ID único, un estado y hasta 12 variantes.");
    ids.add(entry.id.toLowerCase());
    const term = label(entry.term);
    const variants = entry.variants.map(label);
    // Disabled entries also reserve their names, so enabling one cannot
    // silently change which competing correction wins.
    for (const name of [term, ...variants]) {
      const normalized = fold(name);
      if (names.has(normalized)) throw new Error(`«${name}» ya está usado como término o variante. No dupliques la palabra preferida ignorando mayúsculas.`);
      names.add(normalized);
    }
    return { id: entry.id, term, variants, enabled: entry.enabled };
  });
}

function document(value: unknown): SykaGlossary {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Glosario local inválido; no se sobrescribió.");
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || typeof data.revision !== "string" || !UUID.test(data.revision) || Object.keys(data).some(key => !["version", "revision", "entries"].includes(key))) throw new Error("Versión o revisión de glosario inválida; no se sobrescribió.");
  return { version: 1, revision: data.revision, entries: validateGlossaryEntries(data.entries) };
}

async function filePath(): Promise<string> {
  const root = await realpath(app.getPath("userData"));
  const dir = join(root, "settings");
  await mkdir(dir).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
  const actual = await realpath(dir);
  const rel = relative(root, actual);
  if (!rel || isAbsolute(rel) || rel === ".." || rel.startsWith(".." + sep)) throw new Error("La carpeta del glosario sale del perfil local.");
  const file = join(actual, "glossary.json");
  const info = await lstat(file).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error; });
  if (info && (!info.isFile() || info.isSymbolicLink() || info.size > GLOSSARY_LIMITS.bytes)) throw new Error("El glosario local no es un archivo regular válido de hasta 256 KiB.");
  return file;
}

export async function getSykaGlossary(): Promise<SykaGlossary> {
  const file = await filePath();
  try {
    const bytes = await readFile(file);
    if (bytes.length > GLOSSARY_LIMITS.bytes) throw new Error("El glosario local supera 256 KiB.");
    return document(JSON.parse(bytes.toString("utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, revision: EMPTY_REVISION, entries: [] };
    if (error instanceof SyntaxError) throw new Error("El glosario local contiene JSON inválido; no se sobrescribió.");
    throw error;
  }
}

/** One Electron main owns settings. A queue + revision CAS protects open panels. */
export async function saveSykaGlossary(request: unknown): Promise<SykaGlossary> {
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("Solicitud de glosario inválida.");
  const data = request as Record<string, unknown>;
  if (typeof data.expectedRevision !== "string" || !UUID.test(data.expectedRevision) || Object.keys(data).some(key => !["expectedRevision", "entries"].includes(key))) throw new Error("Revisión de glosario inválida.");
  const entries = validateGlossaryEntries(data.entries);
  let result!: SykaGlossary;
  const task = saves.then(async () => {
    const current = await getSykaGlossary();
    if (current.revision !== data.expectedRevision) throw new Error("El glosario cambió en otra ventana. Recargalo antes de guardar; tu borrador no se guardó.");
    result = { version: 1, revision: randomUUID(), entries };
    const bytes = Buffer.from(JSON.stringify(result, null, 2) + "\n");
    if (bytes.length > GLOSSARY_LIMITS.bytes) throw new Error("El glosario supera el tamaño máximo de 256 KiB.");
    const file = await filePath();
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temp, "wx", 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
      await rename(temp, file);
    } finally { await unlink(temp).catch(() => {}); }
  });
  saves = task.catch(() => {});
  await task;
  return result;
}

/** Groq accepts 224 prompt tokens; a small byte budget avoids a large hint list. */
export function glossaryPrompt(glossary: SykaGlossary): string {
  let prompt = "";
  for (const entry of glossary.entries) {
    if (!entry.enabled) continue;
    const next = prompt ? `${prompt}, ${entry.term}` : entry.term;
    if (Buffer.byteLength(next, "utf8") <= GLOSSARY_LIMITS.promptBytes) prompt = next;
  }
  return prompt;
}

type Word = SykaTranscriptSegment["words"][number];
type Pattern = { parts: RegExp[]; term: string; target: string[]; length: number };

/** Validates IPC without inventing/alignment of any additional word times. */
function transcriptWords(segments: unknown): Word[] {
  if (!Array.isArray(segments) || segments.length > 50_000) throw new Error("Transcripción demasiado grande o inválida para el glosario.");
  const words: Word[] = [];
  let previous = -1;
  let bytes = 0;
  for (const raw of segments) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.words) || typeof raw.text !== "string") throw new Error("Segmento de transcripción inválido.");
    for (const word of raw.words) {
      if (!word || typeof word.text !== "string" || !word.text.trim() || word.text.length > 500 || typeof word.start !== "number" || typeof word.end !== "number" || !Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < previous || word.start < 0 || word.end < word.start || word.end > 86400.5) throw new Error("Tiempos o palabras de transcripción inválidos.");
      previous = word.start; bytes += Buffer.byteLength(word.text, "utf8");
      words.push({ text: word.text, start: word.start, end: word.end });
      if (words.length > 300_000 || bytes > 8 * 1024 * 1024) throw new Error("La transcripción excede los límites locales del glosario.");
    }
  }
  return words;
}

export function applyGlossaryToTranscript(segments: unknown, glossary: SykaGlossary): SykaTranscriptSegment[] {
  const words = transcriptWords(segments);
  const firstParts = new Map<string, Pattern[]>();
  for (const entry of glossary.entries) {
    if (!entry.enabled) continue;
    for (const variant of [entry.term, ...entry.variants]) {
      const parts = variant.split(" ");
      const pattern: Pattern = { term: entry.term, target: entry.term.split(" "), length: variant.length,
        parts: parts.map((part, index) => new RegExp(`^(${index === 0 ? "\\p{P}*" : ""})${escaped(part)}(${index === parts.length - 1 ? "\\p{P}*" : ""})$`, "iu")) };
      const key = lookup(parts[0]!);
      const bucket = firstParts.get(key) ?? [];
      bucket.push(pattern); firstParts.set(key, bucket);
    }
  }
  for (const bucket of firstParts.values()) bucket.sort((a, b) => b.parts.length - a.parts.length || b.length - a.length);
  const corrected: Word[] = [];
  for (let index = 0; index < words.length;) {
    let matched = false;
    for (const pattern of firstParts.get(lookup(words[index]!.text)) ?? []) {
      if (index + pattern.parts.length > words.length) continue;
      const matches = pattern.parts.map((part, offset) => part.exec(words[index + offset]!.text.trim().normalize("NFC")));
      if (matches.some(match => !match)) continue;
      const prefix = matches[0]![1]!;
      const suffix = matches.at(-1)![2]!;
      if (pattern.target.length === pattern.parts.length) {
        // Keep every existing word interval when the spelling has the same
        // number of words. Punctuation remains attached to the outside words.
        for (let offset = 0; offset < pattern.parts.length; offset++) corrected.push({ ...words[index + offset]!, text: `${offset === 0 ? prefix : ""}${pattern.target[offset]}${offset === pattern.parts.length - 1 ? suffix : ""}` });
      } else {
        // A contraction/expansion becomes one timed caption unit. Only real
        // boundaries are used; we never manufacture per-word timestamps.
        corrected.push({ text: prefix + pattern.term + suffix, start: words[index]!.start, end: words[index + pattern.parts.length - 1]!.end });
      }
      index += pattern.parts.length; matched = true; break;
    }
    if (!matched) corrected.push(words[index++]!);
  }
  const result: SykaTranscriptSegment[] = [];
  for (let index = 0; index < corrected.length; index += 12) {
    const group = corrected.slice(index, index + 12);
    result.push({ text: group.map(word => word.text).join(" "), words: group });
  }
  return result;
}

export function registerSykaGlossary(bridge: typeof mainBridge): void {
  bridge.handle(MAIN_CHANNELS.SYKA_GLOSSARY_GET, getSykaGlossary);
  bridge.handle(MAIN_CHANNELS.SYKA_GLOSSARY_SAVE, saveSykaGlossary);
  bridge.handle(MAIN_CHANNELS.SYKA_GLOSSARY_APPLY_TRANSCRIPT, async request => {
    if (!request || typeof request !== "object") throw new Error("Transcripción inválida.");
    return applyGlossaryToTranscript(request.segments, await getSykaGlossary());
  });
}
