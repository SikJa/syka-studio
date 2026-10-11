/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ answers: [{ address: "127.0.0.1", family: 4 }] }));
vi.mock("node:dns/promises", () => ({ lookup: async () => state.answers }));
import { publicResource } from "../src/host/browser-tools";
beforeEach(() => { state.answers = [{ address: "127.0.0.1", family: 4 }]; });
describe("Browser network policy before transport", () => {
  it("rejects a public hostname resolving to private or mixed DNS addresses", async () => {
    await expect(publicResource("https://example.com", "GET")).rejects.toThrow(/Private/);
    state.answers = [{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }];
    await expect(publicResource("https://example.com", "GET")).rejects.toThrow(/Private/);
  });
  it("rejects writes before DNS and transport", async () => {
    await expect(publicResource("https://example.com", "POST")).rejects.toThrow(/cannot submit/);
    await expect(publicResource("https://example.com", "PUT")).rejects.toThrow(/cannot submit/);
  });
});
