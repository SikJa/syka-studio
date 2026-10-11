/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SykaGlossary, SykaTranscriptSegment } from "../src/main-channels";

const harness = vi.hoisted(() => ({ call: vi.fn(), duration: 601, dispose: vi.fn() }));
vi.mock("electron", () => ({ app: {} }));
vi.mock("@/lib/ipc", () => ({ mainBridge: { call: harness.call } }));
vi.mock("mediabunny", () => ({
  ALL_FORMATS: [], BlobSource: class {}, OggOutputFormat: class {},
  BufferTarget: class { buffer: ArrayBuffer | null = null; },
  Input: class {
    async getPrimaryAudioTrack() { return { canDecode: async () => true }; }
    async computeDuration() { return harness.duration; }
    dispose() { harness.dispose(); }
  },
  Output: class { target: { buffer: ArrayBuffer | null }; constructor(options: { target: { buffer: ArrayBuffer | null } }) { this.target = options.target; } },
  Conversion: { init: async ({ output }: { output: { target: { buffer: ArrayBuffer | null } } }) => ({
    isValid: true, utilizedTracks: ["audio"], execute: async () => { output.target.buffer = new Uint8Array(40).buffer; },
  }) },
}));
import { transcribeWithGroq } from "../../web/src/lib/syka-transcription";
import { applyGlossaryToTranscript } from "../src/syka-glossary";
import { MAIN_CHANNELS } from "../src/main-channels";

beforeEach(() => { vi.stubGlobal("window", { desktop: {} }); harness.call.mockReset(); harness.dispose.mockReset(); harness.duration = 601; });
afterEach(() => vi.unstubAllGlobals());

describe("merged transcription glossary", () => {
  it("corrects once after chunk offsets, including phrases spanning the ten-minute boundary", async () => {
    const data: SykaGlossary = { version: 1, revision: randomUUID(), entries: [{ id: randomUUID(), term: "Syka Clips", variants: ["Zika Clip"], enabled: true }] };
    let index = 0;
    harness.call.mockImplementation(async (channel, request) => {
      if (channel === MAIN_CHANNELS.SYKA_GROQ_STATUS) return { configured: true };
      if (channel === MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE) {
        expect(request.applyGlossary).toBe(false); // Never correct each chunk and then cascade a second pass.
        return index++ === 0 ? [{ text: "Zika", words: [{ text: "Zika", start: 599.4, end: 599.8 }] }] : [{ text: "Clip", words: [{ text: "Clip", start: 0.1, end: 0.3 }] }];
      }
      if (channel === MAIN_CHANNELS.SYKA_GLOSSARY_APPLY_TRANSCRIPT) return applyGlossaryToTranscript(request.segments, data);
      throw new Error("Unexpected IPC");
    });
    expect(await transcribeWithGroq(new Blob())).toEqual([{ text: "Syka Clips", words: [{ text: "Syka", start: 599.4, end: 599.8 }, { text: "Clips", start: 600.1, end: 600.3 }] }]);
    const requests = harness.call.mock.calls.filter(([channel]) => channel === MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE);
    expect(requests.map(([, request]) => request.duration)).toEqual([600, 1]);
    expect(harness.call.mock.calls.filter(([channel]) => channel === MAIN_CHANNELS.SYKA_GLOSSARY_APPLY_TRANSCRIPT)).toHaveLength(1);
    expect(harness.dispose).toHaveBeenCalledOnce();
  });

  it("does not double-apply a correction whose output could match another phrase", async () => {
    harness.duration = 1;
    const data: SykaGlossary = { version: 1, revision: randomUUID(), entries: [
      { id: randomUUID(), term: "Syka", variants: ["Zika"], enabled: true },
      { id: randomUUID(), term: "Otro", variants: ["Syka Clips"], enabled: true },
    ] };
    harness.call.mockImplementation(async (channel, request) => {
      if (channel === MAIN_CHANNELS.SYKA_GROQ_STATUS) return { configured: true };
      if (channel === MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE) {
        expect(request.applyGlossary).toBe(false);
        return [{ text: "Zika Clips", words: [{ text: "Zika", start: 0.1, end: 0.3 }, { text: "Clips", start: 0.4, end: 0.8 }] }];
      }
      return applyGlossaryToTranscript(request.segments as SykaTranscriptSegment[], data);
    });
    expect((await transcribeWithGroq(new Blob()))[0]!.text).toBe("Syka Clips");
  });
});
