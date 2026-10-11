/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SykaGlossary, SykaGlossaryEntry, SykaTranscriptSegment } from "./main-channels";

const storage = vi.hoisted(() => ({ root: "" }));
vi.mock("electron", () => ({ app: { getPath: () => storage.root } }));
import { applyGlossaryToTranscript, getSykaGlossary, glossaryPrompt, GLOSSARY_LIMITS, registerSykaGlossary, saveSykaGlossary, validateGlossaryEntries } from "./syka-glossary";
import { MAIN_CHANNELS } from "./main-channels";
import type { mainBridge } from "./main-manager";

const qaRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.runtime/diffusion/qa");
let fixture: string;
const entry = (term: string, variants: string[] = [], enabled = true): SykaGlossaryEntry => ({ id: randomUUID(), term, variants, enabled });
const glossary = (...entries: SykaGlossaryEntry[]): SykaGlossary => ({ version: 1, revision: randomUUID(), entries });
const timed = (tokens: string[]): SykaTranscriptSegment[] => [{ text: tokens.join(" "), words: tokens.map((text, index) => ({ text, start: index + 0.1, end: index + 0.8 })) }];
const flat = (segments: SykaTranscriptSegment[]) => segments.flatMap(segment => segment.words);
const path = (): string => join(storage.root, "settings/glossary.json");
const save = async (...entries: SykaGlossaryEntry[]): Promise<SykaGlossary> => saveSykaGlossary({ expectedRevision: (await getSykaGlossary()).revision, entries });

beforeEach(async () => {
  await mkdir(qaRoot, { recursive: true });
  fixture = await mkdtemp(join(qaRoot, "glossary-test-"));
  storage.root = join(fixture, "Perfil 🧩 local");
  await mkdir(storage.root);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); }));
});
afterEach(async () => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  const rel = relative(qaRoot, resolve(fixture));
  if (!rel || rel === ".." || rel.startsWith(".." + sep)) throw new Error("Invalid QA cleanup target");
  await rm(fixture, { recursive: true, force: true });
});

describe("local Syka glossary", () => {
  it("starts empty and survives a new service instance with NFC/space normalization", async () => {
    const before = await getSykaGlossary(); expect(before.entries).toEqual([]);
    const saved = await save(entry("  Syka   Clips  ", [" zika   clips "]), entry("Cafe\u0301"));
    expect(saved.entries.map(term => term.term)).toEqual(["Syka Clips", "Café"]);
    expect(saved.entries[0]!.variants).toEqual(["zika clips"]);
    expect(saved.revision).not.toBe(before.revision);
    type Handler = (request?: unknown) => unknown | Promise<unknown>;
    const handlers = new Map<string, Handler>();
    registerSykaGlossary({ handle: (name: string, handler: Handler) => handlers.set(name, handler) } as unknown as typeof mainBridge);
    expect(await handlers.get(MAIN_CHANNELS.SYKA_GLOSSARY_GET)!()).toEqual(saved);
    expect(JSON.parse(await readFile(path(), "utf8"))).toEqual(saved);
  });

  it("rejects stale panels and concurrent saves instead of overwriting their changes", async () => {
    const before = await getSykaGlossary();
    const requests = [entry("Syka"), entry("Remotion")].map(term => saveSykaGlossary({ expectedRevision: before.revision, entries: [term] }));
    const results = await Promise.allSettled(requests);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect((results.find(result => result.status === "rejected") as PromiseRejectedResult).reason.message).toMatch(/otra ventana/);
    expect((await getSykaGlossary()).entries[0]!.term).toBe("Syka");
    await expect(saveSykaGlossary({ expectedRevision: before.revision, entries: [] })).rejects.toThrow(/otra ventana/);
    expect((await getSykaGlossary()).entries).toHaveLength(1);
  });

  it("preserves a corrupt file instead of replacing it with an empty glossary", async () => {
    const before = await getSykaGlossary();
    await writeFile(path(), "{broken");
    await expect(getSykaGlossary()).rejects.toThrow(/JSON inválido/);
    await expect(saveSykaGlossary({ expectedRevision: before.revision, entries: [] })).rejects.toThrow(/no se sobrescribió/);
    expect(await readFile(path(), "utf8")).toBe("{broken");
  });

  it("rejects settings junctions outside the profile", async () => {
    const outside = join(fixture, "outside"); await mkdir(outside);
    await symlink(outside, join(storage.root, "settings"), process.platform === "win32" ? "junction" : "dir");
    await expect(getSykaGlossary()).rejects.toThrow(/sale del perfil/);
    await expect(readFile(join(outside, "glossary.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("bounds entries, variants, labels and rejects ambiguous names, IDs or hidden controls", () => {
    const same = entry("Syka", ["Sika"]);
    expect(() => validateGlossaryEntries([same, entry("SYKA")])).toThrow(/ya está usado/);
    expect(() => validateGlossaryEntries([same, entry("Other", ["sika"], false)])).toThrow(/ya está usado/);
    expect(() => validateGlossaryEntries([entry("Syka", ["syka"])])).toThrow(/ya está usado/);
    expect(() => validateGlossaryEntries([same, { ...entry("Other"), id: same.id }])).toThrow(/ID único/);
    expect(() => validateGlossaryEntries([entry("hidden\u200Bterm")])).toThrow(/ocultos/);
    expect(() => validateGlossaryEntries([entry("!!!")])).toThrow(/letras o números/);
    expect(() => validateGlossaryEntries([entry("a".repeat(81))])).toThrow(/80 caracteres/);
    expect(() => validateGlossaryEntries(Array.from({ length: 201 }, (_, index) => entry("term " + index)))).toThrow(/200/);
    expect(() => validateGlossaryEntries([entry("Term", Array.from({ length: 13 }, (_, index) => "alias " + index))])).toThrow(/12 variantes/);
    expect(() => validateGlossaryEntries([{ ...same, id: "not-an-id" }])).toThrow(/ID único/);
    expect(() => validateGlossaryEntries([{ ...same, extra: true }])).toThrow(/inválida/);
  });

  it("limits prompt UTF-8 bytes, includes enabled preferred terms only, and omits variants", () => {
    const data = glossary(entry("Syka", ["Zika"]), entry("Disabled", [], false), ...Array.from({ length: 100 }, (_, index) => entry(`José ${index} 🧩`)));
    const prompt = glossaryPrompt(data);
    expect(prompt).toContain("Syka"); expect(prompt).not.toContain("Zika"); expect(prompt).not.toContain("Disabled");
    expect(Buffer.byteLength(prompt, "utf8")).toBeLessThanOrEqual(GLOSSARY_LIMITS.promptBytes);
    expect(glossaryPrompt(glossary(entry("😀".repeat(80))))).toBe(""); // A huge Unicode hint never gets truncated mid-character.
  });

  it("corrects case/aliases and preserves punctuation, timestamps, diacritics and input bytes", () => {
    const input = timed(["¡zika!", "SIKA,", "sikario", "OPENAI", "aun", "aún"]);
    const original = structuredClone(input);
    const result = flat(applyGlossaryToTranscript(input, glossary(entry("Syka", ["zika", "sika"]), entry("AI"), entry("Todavía", ["aún"]))));
    expect(result.map(word => word.text)).toEqual(["¡Syka!", "Syka,", "sikario", "OPENAI", "aun", "Todavía"]);
    expect(result.map(({ start, end }) => ({ start, end }))).toEqual(flat(input).map(({ start, end }) => ({ start, end })));
    expect(input).toEqual(original);
  });

  it("prefers longer phrases across caption groups and keeps every interval for equal word counts", () => {
    const full = timed(["Hablamos", "de", "ZIKA", "CLIPS,"]);
    const words = full[0]!.words;
    const input = [{ text: "Hablamos de ZIKA", words: words.slice(0, 3) }, { text: "CLIPS,", words: words.slice(3) }];
    const result = flat(applyGlossaryToTranscript(input, glossary(entry("Syka", ["Zika"]), entry("Syka Clips", ["Zika Clips"]))));
    expect(result.map(word => word.text)).toEqual(["Hablamos", "de", "Syka", "Clips,"]);
    expect(result.map(({ start, end }) => ({ start, end }))).toEqual(words.map(({ start, end }) => ({ start, end })));
  });

  it("contracts or expands a phrase using only original outer timing boundaries", () => {
    const input = timed(["Re", "Motion,", "maestro"]);
    const result = flat(applyGlossaryToTranscript(input, glossary(entry("Remotion", ["re motion"]), entry("El Mago", ["maestro"]))));
    expect(result).toEqual([{ text: "Remotion,", start: 0.1, end: 1.8 }, { text: "El Mago", start: 2.1, end: 2.8 }]);
    expect(new Set(result.flatMap(word => [word.start, word.end]))).toEqual(new Set([0.1, 1.8, 2.1, 2.8]));
  });

  it("does not recurse newly corrected text or cross intervening punctuation", () => {
    const data = glossary(entry("Syka", ["Zika"]), entry("Otro", ["Syka Clips"]));
    expect(flat(applyGlossaryToTranscript(timed(["Zika", "Clips"]), data)).map(word => word.text)).toEqual(["Syka", "Clips"]);
    expect(flat(applyGlossaryToTranscript(timed(["Zika,", "Clips"]), glossary(entry("Syka Clips", ["Zika Clips"])))).map(word => word.text)).toEqual(["Zika,", "Clips"]);
    expect(flat(applyGlossaryToTranscript(timed(["Zika"]), glossary(entry("Syka", ["Zika"], false))))[0]!.text).toBe("Zika");
  });

  it("supports escaped punctuation in technical terms without interpreting it as regex", () => {
    expect(flat(applyGlossaryToTranscript(timed(["cpp,", "#sika!", "sykaXai"]), glossary(entry("C++", ["cpp"]), entry("#Syka", ["#sika"]), entry("Syka.ai"))))).toEqual([
      { text: "C++,", start: 0.1, end: 0.8 }, { text: "#Syka!", start: 1.1, end: 1.8 }, { text: "sykaXai", start: 2.1, end: 2.8 },
    ]);
  });

  it("rejects malformed timing on the apply IPC rather than creating estimated word times", async () => {
    expect(() => applyGlossaryToTranscript([{ text: "bad", words: [{ text: "bad", start: 3, end: 1 }] }], glossary())).toThrow(/Tiempos/);
    expect(() => applyGlossaryToTranscript([{ text: "bad", words: [{ text: "bad", start: NaN, end: 1 }] }], glossary())).toThrow(/Tiempos/);
    expect(() => applyGlossaryToTranscript([{ text: "bad", words: [{ text: "a".repeat(501), start: 0, end: 1 }] }], glossary())).toThrow(/Tiempos/);
    expect(applyGlossaryToTranscript([], glossary())).toEqual([]);
  });
});
