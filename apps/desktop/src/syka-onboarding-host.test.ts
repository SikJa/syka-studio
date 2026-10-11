import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { mainBridge } from "./main-manager";
import type { BrandRequest, BrandResponse } from "./syka-onboarding-contract";
import { newBrandKit } from "./syka-onboarding-contract";
const host = vi.hoisted(() => ({ root: "", picker: vi.fn() }));
vi.mock("electron", () => ({
  app: { getPath: () => host.root },
  dialog: { showOpenDialog: host.picker },
}));
const { registerSykaOnboarding } = await import("./syka-onboarding");
let call: (request: BrandRequest) => Promise<BrandResponse>;
beforeEach(async () => {
  host.root = await mkdtemp(join(tmpdir(), "syka-onboarding-host-"));
  host.picker.mockReset();
  registerSykaOnboarding({
    handle: (_channel: unknown, handler: typeof call) => {
      call = handler;
    },
  } as unknown as typeof mainBridge);
});
afterEach(async () => {
  await rm(host.root, { recursive: true, force: true });
});
describe("contrato desktop de onboarding", () => {
  it("omite y retoma después de registrar un host nuevo", async () => {
    expect((await call({ action: "get" })).state.dismissed).toBe(false);
    await call({ action: "dismiss", revision: 0, dismissed: true });
    registerSykaOnboarding({
      handle: (_channel: unknown, handler: typeof call) => {
        call = handler;
      },
    } as unknown as typeof mainBridge);
    expect((await call({ action: "get" })).state.dismissed).toBe(true);
    expect(
      (await call({ action: "dismiss", revision: 1, dismissed: false })).state
        .dismissed,
    ).toBe(false);
  });
  it("cancelar el selector no modifica el estado", async () => {
    host.picker.mockResolvedValue({ canceled: true, filePaths: [] });
    expect(
      await call({ action: "import", revision: 0, id: "anything" }),
    ).toMatchObject({ cancelled: true, state: { revision: 0 } });
  });
  it("asigna sólo a un proyecto elegido mediante el diálogo y reabre el snapshot", async () => {
    const kit = { ...newBrandKit(), name: "QA" };
    await call({ action: "save", revision: 0, kit, makeDefault: true });
    const project = join(host.root, "project");
    await mkdir(project);
    await writeFile(
      join(project, "package.json"),
      JSON.stringify({ projectId: "qa-1", displayName: "QA aislado" }),
    );
    host.picker.mockResolvedValue({ canceled: false, filePaths: [project] });
    const result = await call({ action: "project", revision: 1, id: kit.id });
    expect(result.projectName).toBe("QA aislado");
    expect(host.picker).toHaveBeenCalledWith(
      expect.objectContaining({ properties: ["openDirectory"] }),
    );
    expect(
      JSON.parse(
        await readFile(join(project, ".syka/brand-kit/context.json"), "utf8"),
      ).kit.id,
    ).toBe(kit.id);
  });
  it("no hay campos de secreto en la respuesta pública ni llamadas de red al guardar", async () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    try {
      const response = await call({
        action: "save",
        revision: 0,
        kit: { ...newBrandKit(), name: "QA" },
        makeDefault: false,
      });
      expect(Object.keys(response)).toEqual(["state"]);
      expect(network).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
