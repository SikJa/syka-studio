/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dom = vi.hoisted(() => ({ inputs: [] as Array<{ id: string; files: File[] }>, writes: [] as string[] }));
vi.mock("../../web/src/lib/ipc", () => ({
  mainBridge: {
    call: async (_channel: string, request: { absolutePath: string }) => {
      await Promise.resolve();
      // CDP targets the first matching id, reproducing why duplicate inputs
      // make the newly imported module see an empty files list.
      const input = dom.inputs.find((node) => node.id === "__electron-file-import-input__")!;
      input.files = [{ name: request.absolutePath } as File];
      dom.writes.push(request.absolutePath);
    },
  },
}));

class Input {
  type = "";
  id = "";
  style: Record<string, string> = {};
  tabIndex = 0;
  files: File[] = [];
  setAttribute(): void {}
  remove(): void { dom.inputs = dom.inputs.filter((input) => input !== this); }
  set value(_value: string) { this.files = []; }
}

beforeEach(() => {
  vi.resetModules();
  dom.inputs = [];
  dom.writes = [];
  delete (globalThis as unknown as Record<symbol, unknown>)[Symbol.for("syka.electron-file-transfer")];
  vi.stubGlobal("window", { desktop: {} });
  vi.stubGlobal("HTMLInputElement", Input);
  vi.stubGlobal("document", {
    querySelectorAll: () => dom.inputs,
    createElement: () => new Input(),
    body: { appendChild: (input: Input) => dom.inputs.push(input) },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as unknown as Record<symbol, unknown>)[Symbol.for("syka.electron-file-transfer")];
});

describe("Electron file import across HMR", () => {
  it("reuses the surviving DOM input after a module reload", async () => {
    const first = await import("../../web/src/lib/electron-file-handle");
    expect((await new first.ElectronFileHandle("D:/old.mp4").getFile()).name).toBe("D:/old.mp4");
    vi.resetModules();
    const reloaded = await import("../../web/src/lib/electron-file-handle");
    expect((await new reloaded.ElectronFileHandle("D:/05 🧩/new.mp4").getFile()).name).toBe("D:/05 🧩/new.mp4");
    expect(dom.inputs).toHaveLength(1);
  });

  it("serializes transfers from two module incarnations", async () => {
    const first = await import("../../web/src/lib/electron-file-handle");
    vi.resetModules();
    const second = await import("../../web/src/lib/electron-file-handle");
    const files = await Promise.all([
      new first.ElectronFileHandle("D:/first.mp4").getFile(),
      new second.ElectronFileHandle("D:/second.mp4").getFile(),
    ]);
    expect(files.map((file) => file.name)).toEqual(["D:/first.mp4", "D:/second.mp4"]);
    expect(dom.inputs).toHaveLength(1);
  });

  it("recovers from duplicate hidden inputs left by older modules", async () => {
    for (let i = 0; i < 2; i++) {
      const input = new Input();
      input.id = "__electron-file-import-input__";
      input.type = "file";
      dom.inputs.push(input);
    }
    const { ElectronFileHandle } = await import("../../web/src/lib/electron-file-handle");
    expect((await new ElectronFileHandle("D:/fixed.mp4").getFile()).name).toBe("D:/fixed.mp4");
    expect(dom.inputs).toHaveLength(1);
  });
});
