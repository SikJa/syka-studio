import { app, dialog } from "electron";
import { join, basename } from "node:path";
import { lstat, readFile } from "node:fs/promises";
import { BrandKitStore, validateAnswers } from "./syka-brand-kit-store";
import { MAIN_CHANNELS } from "./main-channels";
import type { mainBridge } from "./main-manager";

export function registerSykaOnboarding(bridge: typeof mainBridge) {
  let store: BrandKitStore;
  bridge.handle(MAIN_CHANNELS.SYKA_ONBOARDING, async (request) => {
    store ??= new BrandKitStore(join(app.getPath("userData"), "brand-kits"));
    if (request.action === "get") return { state: await store.view() };
    if (request.action === "save")
      return {
        state: await store.save(
          request.revision,
          request.kit,
          request.makeDefault,
        ),
      };
    if (request.action === "delete" || request.action === "remove-asset")
      return {
        state: await store.remove(
          request.revision,
          request.id,
          request.action === "remove-asset" ? request.assetId : undefined,
        ),
      };
    if (request.action === "import") {
      const chosen = await dialog.showOpenDialog({
        title: "Agregar logo o variante propia",
        properties: ["openFile"],
        filters: [
          {
            name: "Imágenes de marca (hasta 5 MB)",
            extensions: ["png", "jpg", "jpeg", "webp", "svg"],
          },
        ],
      });
      if (chosen.canceled)
        return { state: await store.view(), cancelled: true };
      return {
        state: await store.import(
          request.revision,
          request.id,
          chosen.filePaths[0],
        ),
      };
    }
    if (request.action === "project") {
      if ((await store.read()).revision !== request.revision)
        throw new Error(
          "Recargá la configuración antes de elegir un proyecto.",
        );
      const chosen = await dialog.showOpenDialog({
        title: "Elegir proyecto para este kit",
        properties: ["openDirectory"],
      });
      if (chosen.canceled)
        return { state: await store.view(), cancelled: true };
      const dir = chosen.filePaths[0];
      const manifest = JSON.parse(
        await readFile(join(dir, "package.json"), "utf8"),
      );
      if (!manifest.projectId)
        throw new Error("Elegí una carpeta de proyecto Syka existente.");
      for (const path of [
        dir,
        join(dir, ".syka"),
        join(dir, ".syka", "brand-kit"),
      ]) {
        try {
          if ((await lstat(path)).isSymbolicLink())
            throw new Error("No se admiten enlaces de carpetas para el kit.");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      await store.assign(dir, request.id);
      return {
        state: await store.view(),
        projectName: String(manifest.displayName || basename(dir)),
      };
    }
    return {
      state: await store.mutate(request.revision, (state) => {
        if (request.action === "dismiss") state.dismissed = !!request.dismissed;
        else if (request.action === "answers")
          state.answers = validateAnswers(request.answers);
        else throw new Error("Acción no compatible.");
      }),
    };
  });
}
