import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrandKitStore, validateAsset } from "./syka-brand-kit-store";
import {
  newBrandKit,
  nextQuestion,
  editingContext,
  publicationStatus,
  referenceIntent,
  type Answers,
} from "./syka-onboarding-contract";
import { ProjectPreferences } from "./syka-onboarding-context";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "syka-onboarding-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
const svg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="#3488ff" d="M0 0h20v20H0z"/></svg>',
);
const answer = (value: string): Answers["purpose"] => ({
  state: "accepted",
  value,
  updatedAt: "2026-10-05",
});
describe("Brand Kit durable y portable", () => {
  it("reabre metadatos y copia bytes sin depender de la fuente; proyecto conserva snapshot", async () => {
    const store = new BrandKitStore(join(root, "store"));
    const kit = { ...newBrandKit(), name: "Norte", colors: ["#3488FF"] };
    await store.save(0, kit, true);
    const source = join(root, "logo.svg");
    await writeFile(source, svg);
    await store.import(1, kit.id, source);
    await unlink(source);
    const state = await new BrandKitStore(store.root).view();
    expect(state.kits[0].assets[0].preview).toContain(
      "data:image/svg+xml;base64,",
    );
    await store.assign(join(root, "project-a"), kit.id);
    await store.save(2, { ...kit, name: "Cambiado" }, false);
    const snapshot = JSON.parse(
      await readFile(
        join(root, "project-a/.syka/brand-kit/context.json"),
        "utf8",
      ),
    );
    expect(snapshot.kit.name).toBe("Norte");
    expect(
      await readFile(
        join(root, "project-a/.syka/brand-kit", snapshot.kit.assets[0].file),
      ),
    ).toEqual(svg);
    expect(JSON.stringify(snapshot)).not.toContain(root);
    expect(snapshot.kit.assets[0].preview).toBeUndefined();
  });
  it("conflictos concurrentes no pisan cambios y archivos faltantes son visibles", async () => {
    const store = new BrandKitStore(root);
    const kit = { ...newBrandKit(), name: "A" };
    const outcomes = await Promise.allSettled([
      store.save(0, kit, false),
      store.save(0, { ...kit, name: "B" }, false),
    ]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const source = join(root, "logo.svg");
    await writeFile(source, svg);
    const state = await store.import(1, kit.id, source);
    await unlink(join(root, "assets", state.kits[0].assets[0].file));
    expect((await store.view()).kits[0].assets[0].missing).toBe(true);
    await expect(store.assign(join(root, "project"), kit.id)).rejects.toThrow();
  });
  it("conserva JSON corrupto y rechaza paleta/rutas inválidas", async () => {
    const store = new BrandKitStore(root);
    await writeFile(join(root, "onboarding.json"), "{invalid");
    await expect(
      store.save(0, { ...newBrandKit(), name: "A" }, false),
    ).rejects.toThrow();
    expect(await readFile(join(root, "onboarding.json"), "utf8")).toBe(
      "{invalid",
    );
    expect(() =>
      store.save(0, { ...newBrandKit(), id: "../bad", name: "A" }, false),
    ).toThrow();
    expect(() =>
      store.save(0, { ...newBrandKit(), name: "A", colors: ["red"] }, false),
    ).toThrow();
  });
  it("quitar un recurso elimina su copia administrada, pero conserva la del proyecto", async () => {
    const store = new BrandKitStore(join(root, "store"));
    const kit = { ...newBrandKit(), name: "A" };
    await store.save(0, kit, true);
    const source = join(root, "logo.svg");
    await writeFile(source, svg);
    const saved = await store.import(1, kit.id, source);
    const asset = saved.kits[0].assets[0];
    const project = join(root, "project");
    await store.assign(project, kit.id);
    await store.remove(2, kit.id, asset.id);
    await expect(
      readFile(join(store.root, "assets", asset.file)),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(
      await readFile(join(project, ".syka/brand-kit", asset.file)),
    ).toEqual(svg);
    await store.remove(3, kit.id);
    expect((await store.read()).defaultKitId).toBeNull();
  });
  it("rechaza formatos disfrazados, SVG activo y recursos demasiado grandes", () => {
    expect(validateAsset("logo.svg", svg)).toBe("image/svg+xml");
    for (const input of [
      "<svg><script>alert(1)</script></svg>",
      '<svg onload="alert(1)"/>',
      '<svg><image href="https://test"/></svg>',
      "<svg><foreignObject/></svg>",
      "<!DOCTYPE svg><svg/>",
      '<svg><path style="fill:red"/></svg>',
    ])
      expect(() => validateAsset("x.svg", Buffer.from(input))).toThrow();
    expect(() => validateAsset("x.png", svg)).toThrow();
    expect(() =>
      validateAsset("x.png", Buffer.alloc(6 * 1024 * 1024)),
    ).toThrow();
  });
});
describe("preguntas contextuales", () => {
  it("no repite lo aprobado, omitido, desconocido ni lo que ya entrega formato/kit/receta", () => {
    const input = {
      projectId: "a",
      answers: {
        reference: { state: "skipped" as const, updatedAt: "" },
        referenceAspect: { state: "unknown" as const, updatedAt: "" },
      },
      kit: { ...newBrandKit(), name: "Norte" },
      format: {
        destination: "YouTube",
        revision: 1,
        source: "manual" as const,
      },
      recipe: { purpose: "Explicar" },
    };
    expect(
      nextQuestion({}, input, [
        "purpose",
        "destination",
        "brandKit",
        "reference",
        "referenceAspect",
      ]),
    ).toBeNull();
  });
  it("las propuestas no se confunden con aprobación y cada proyecto puede cambiar criterio", async () => {
    const store = new ProjectPreferences();
    const a = join(root, "a");
    const b = join(root, "b");
    const defaults: Answers = { purpose: answer("Vender") };
    await store.save(a, 0, {
      purpose: answer("Enseñar"),
      reference: {
        state: "proposed",
        value: "https://example.com",
        updatedAt: "",
      },
    });
    const context = await new ProjectPreferences().context(
      a,
      defaults,
      { projectId: "a" },
      ["purpose", "reference"],
    );
    expect(context.accepted.purpose).toBe("Enseñar");
    expect(context.accepted.reference).toBeUndefined();
    expect(context.question).toBe("reference");
    expect(
      (await store.context(b, defaults, { projectId: "b" }, ["purpose"]))
        .accepted.purpose,
    ).toBe("Vender");
    await store.save(a, 1, { purpose: answer("Entretener") });
    expect(
      (await store.context(a, defaults, { projectId: "a" }, ["purpose"]))
        .accepted.purpose,
    ).toBe("Entretener");
    await expect(store.save(a, 1, {})).rejects.toThrow();
    expect(
      editingContext(defaults, {
        projectId: "a",
        answers: { purpose: { state: "skipped", updatedAt: "" } },
      }).accepted.purpose,
    ).toBeUndefined();
  });
  it("proveedor desconocido no equivale a conectado y Watch no se dispara solo", () => {
    expect(publicationStatus().state).toBe("unknown");
    expect(publicationStatus({ configured: true }).state).toBe("configured");
    expect(referenceIntent("https://example.com/video", "ritmo")).toMatchObject(
      { autoRun: false, upload: false, transcript: "optional" },
    );
    expect(() => referenceIntent("file:///secret", "")).toThrow();
  });
  it("resuelve el snapshot del proyecto por encima del default y respeta proyecto sin marca", async () => {
    const store = new BrandKitStore(join(root, "store"));
    const kit = { ...newBrandKit(), name: "Default" };
    await store.save(0, kit, true);
    const defaults = await store.read();
    const preferences = new ProjectPreferences();
    const project = join(root, "project");
    expect(
      (
        await preferences.resolve(project, defaults, { projectId: "a" }, [
          "brandKit",
        ])
      ).kit?.id,
    ).toBe(kit.id);
    await store.assign(project, null);
    const context = await preferences.resolve(
      project,
      defaults,
      { projectId: "a" },
      ["brandKit"],
    );
    expect(context.kit).toBeNull();
    expect(context.question).toBeNull();
    expect(context.resourceBase).toBe(".syka/brand-kit");
    expect(
      (
        await preferences.resolve(
          join(root, "another"),
          defaults,
          { projectId: "b" },
          ["brandKit"],
        )
      ).kit?.id,
    ).toBe(kit.id);
  });
});
