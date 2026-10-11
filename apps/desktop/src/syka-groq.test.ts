/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import type { mainBridge } from "./main-manager";

const storage = vi.hoisted(() => ({ root: "", encrypted: true }));
vi.mock("electron", () => ({
  app: { getPath: () => storage.root },
  safeStorage: {
    isEncryptionAvailable: () => storage.encrypted,
    getSelectedStorageBackend: () => "test-secure-store",
    // Fake encryption only inside this test. Production uses Electron DPAPI.
    encryptString: (value: string) => Buffer.from(value, "utf8").reverse(),
    decryptString: (value: Buffer) => Buffer.from(value).reverse().toString("utf8"),
  },
}));

const { groqChunkFingerprint, parseGroqTranscript, registerSykaGroq } = await import("./syka-groq");
const { MAIN_CHANNELS } = await import("./main-channels");
const { getSykaGlossary, saveSykaGlossary } = await import("./syka-glossary");
import { randomUUID } from "node:crypto";

type Handler = (request?: unknown) => unknown | Promise<unknown>;
let handlers: Map<string, Handler>;
const fakeKey = "gsk_this_is_a_fake_test_key_not_a_credential";
const audio = new Uint8Array(40);
audio.set(Buffer.from("OggS"));
audio[26] = 1;
audio[27] = 12;

beforeEach(async () => {
  const qaRoot = resolve(process.cwd(), "../../.runtime/qa/groq-tests");
  await mkdir(qaRoot, { recursive: true });
  storage.root = await mkdtemp(join(qaRoot, "case-"));
  storage.encrypted = true;
  handlers = new Map();
  registerSykaGroq({ handle: (name: string, handler: Handler) => handlers.set(name, handler) } as unknown as typeof mainBridge);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network call"); }));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  const qaRoot = resolve(process.cwd(), "../../.runtime/qa/groq-tests");
  if (!resolve(storage.root).startsWith(qaRoot + sep)) throw new Error("Unexpected test cleanup directory");
  await rm(storage.root, { recursive: true, force: true });
});

const call = (name: string, request?: unknown) => Promise.resolve(handlers.get(name)!(request));

describe("Syka Groq local provider", () => {
  it("caches equivalent OGG content despite random stream serials and CRCs", () => {
    const variant = new Uint8Array(audio);
    variant.set([1, 2, 3, 4], 14);
    variant.set([5, 6, 7, 8], 22);
    expect(groqChunkFingerprint(variant, 1)).toBe(groqChunkFingerprint(audio, 1));
    variant[39] = 99;
    expect(groqChunkFingerprint(variant, 1)).not.toBe(groqChunkFingerprint(audio, 1));
    expect(() => groqChunkFingerprint(audio.subarray(0, 38), 1)).toThrow("página incompleta");
  });
  it("preserves word timings and rejects invented/invalid timing", () => {
    expect(parseGroqTranscript({ words: [{ word: "hola", start: 0.2, end: 0.6 }] }, 1)).toEqual([
      { text: "hola", words: [{ text: "hola", start: 0.2, end: 0.6 }] },
    ]);
    expect(() => parseGroqTranscript({ segments: [{ text: "hola" }] }, 1)).toThrow("tiempos por palabra");
    expect(() => parseGroqTranscript({ words: [{ word: "hola", start: 1, end: 0.6 }] }, 1)).toThrow("inconsistentes");
    expect(() => parseGroqTranscript({ words: [{ word: "hola", start: 0, end: 9 }] }, 1)).toThrow("inconsistentes");
  });

  it("works without credentials and never calls the network to query status", async () => {
    expect(await call(MAIN_CHANNELS.SYKA_GROQ_STATUS)).toMatchObject({ configured: false, secureStorage: true });
    await expect(call(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, { audio, duration: 1 })).rejects.toThrow("clave propia");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps secrets out of status/readback and does not validate on save", async () => {
    expect(await call(MAIN_CHANNELS.SYKA_GROQ_SET_KEY, { key: fakeKey })).toEqual({
      configured: true, secureStorage: true, model: "whisper-large-v3-turbo",
    });
    const encrypted = await readFile(join(storage.root, "providers/groq.key.encrypted"), "utf8");
    expect(encrypted).not.toContain(fakeKey);
    expect(fetch).not.toHaveBeenCalled();
    expect(await call(MAIN_CHANNELS.SYKA_GROQ_SET_KEY, { key: "" })).toMatchObject({ configured: false });
  });

  it("refuses plaintext fallback if secure storage is unavailable", async () => {
    storage.encrypted = false;
    await expect(call(MAIN_CHANNELS.SYKA_GROQ_SET_KEY, { key: fakeKey })).rejects.toThrow("no está disponible");
    expect(await call(MAIN_CHANNELS.SYKA_GROQ_STATUS)).toMatchObject({ configured: false, secureStorage: false });
  });

  it("rejects oversized durations and malformed audio before sending", async () => {
    await expect(call(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, { audio, duration: 601 })).rejects.toThrow("hasta 10 minutos");
    await expect(call(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, { audio: new Uint8Array(40), duration: 1 })).rejects.toThrow("OGG válido");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requests genuine word timestamps and reuses complete chunks across provider instances", async () => {
    await call(MAIN_CHANNELS.SYKA_GROQ_SET_KEY, { key: fakeKey });
    const mockFetch = vi.fn(async (_url: string, options: RequestInit) => {
      expect(_url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
      expect(options.redirect).toBe("error");
      expect((options.body as FormData).get("timestamp_granularities[]")).toBe("word");
      return new Response(JSON.stringify({ words: [{ word: "probando", start: 0.1, end: 0.7 }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", mockFetch);
    const expected = await call(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, { audio, duration: 1 });
    registerSykaGroq({ handle: (name: string, handler: Handler) => handlers.set(name, handler) } as unknown as typeof mainBridge);
    const variant = new Uint8Array(audio);
    variant.set([1, 2, 3, 4], 14);
    variant.set([5, 6, 7, 8], 22);
    expect(await call(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, { audio: variant, duration: 1 })).toEqual(expected);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("forwards preferred terms, caches raw words, and reapplies changed aliases without another request", async () => {
    const id = randomUUID();
    let glossary = await saveSykaGlossary({ expectedRevision: (await getSykaGlossary()).revision, entries: [{ id, term: "Syka", variants: ["Zika"], enabled: true }] });
    await call(MAIN_CHANNELS.SYKA_GROQ_SET_KEY, { key: fakeKey });
    const mockFetch = vi.fn(async (_url: string, options: RequestInit) => {
      expect((options.body as FormData).get("prompt")).toBe("Syka");
      return new Response(JSON.stringify({ words: [{ word: "Sika,", start: 0.1, end: 0.7 }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", mockFetch);
    expect(await call(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, { audio, duration: 1 })).toEqual([{ text: "Sika,", words: [{ text: "Sika,", start: 0.1, end: 0.7 }] }]);
    glossary = await saveSykaGlossary({ expectedRevision: glossary.revision, entries: [{ id, term: "Syka", variants: ["Sika"], enabled: true }] });
    registerSykaGroq({ handle: (name: string, handler: Handler) => handlers.set(name, handler) } as unknown as typeof mainBridge);
    expect(await call(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, { audio, duration: 1 })).toEqual([{ text: "Syka,", words: [{ text: "Syka,", start: 0.1, end: 0.7 }] }]);
    // Multi-chunk renderer explicitly requests raw timing and corrects once.
    expect(await call(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, { audio, duration: 1, applyGlossary: false })).toEqual([{ text: "Sika,", words: [{ text: "Sika,", start: 0.1, end: 0.7 }] }]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("invalidates recognition cache when preferred hint text changes", async () => {
    await call(MAIN_CHANNELS.SYKA_GROQ_SET_KEY, { key: fakeKey });
    const mockFetch = vi.fn(async () => new Response(JSON.stringify({ words: [{ word: "hola", start: 0.1, end: 0.7 }] }), { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    await call(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, { audio, duration: 1 });
    await saveSykaGlossary({ expectedRevision: (await getSykaGlossary()).revision, entries: [{ id: randomUUID(), term: "Syka", variants: [], enabled: true }] });
    await call(MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, { audio, duration: 1 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(groqChunkFingerprint(audio, 1, "Syka")).not.toBe(groqChunkFingerprint(audio, 1));
  });
});
