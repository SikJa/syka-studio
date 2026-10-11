/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { mainBridge } from "@/lib/ipc";
import { MAIN_CHANNELS } from "@desktop/main-channels";
import { ElectronWritableFileHandle } from "@/lib/electron-file-writable";
import { createContext, useContext, onCleanup, onMount, createMemo, createEffect } from "solid-js";
import { toast } from "somoto";
import { t } from '@/i18n';
import { canEncodeVideo } from "mediabunny";
import { useWorld } from "@diffusionstudio/koota-solid";
import { sceneFormatOutput } from "@/engine/formats/output";
import { getActiveEntity } from "@diffusionstudio/runtime";
import { assert, downloadObject, isInputTarget } from "@/utils";
import { useEngineContext } from "@/engine";
import { ProjectConfig as ProjectConfigTrait } from "@/engine/traits";
import { useProject } from "@/context/project";
import { ExportProgress, type ExportConfig } from "@/components/sidebar-right/inspector/export-progress";
import { renderScene, renderOverlay, cancelRender } from "@/context/render";
import { PostExportOffer } from '@/components/post-export-offer';
import {
  MIME_TYPES,
  getDefaultExportTemplate,
} from "@/components/sidebar-right/inspector/export-templates";

import type { Entity } from "koota";
import type { JSX, Accessor } from "solid-js";

type ExportContextValue = {
  exportScene: (scene: Entity, config?: ExportConfig) => Promise<void>;
  exportCurrentFrame: () => Promise<void>;
  exporting: Accessor<boolean>;
};

const ExportContext = createContext<ExportContextValue>();

export function ExportProvider(props: { children: JSX.Element }) {
  const engine = useEngineContext();
  const world = useWorld();
  const project = useProject();

  const exporting = () => !!renderOverlay();
  const exportActive = createMemo(exporting);
  createEffect(() => {
    const active = exportActive();
    if (window.desktop) void mainBridge.call(MAIN_CHANNELS.SYKA_ACTIVITY, { exporting: active }).catch(() => {});
  });
  onCleanup(() => { if (window.desktop) void mainBridge.call(MAIN_CHANNELS.SYKA_ACTIVITY, { exporting: false }).catch(() => {}); });

  const exportScene: ExportContextValue["exportScene"] = async (scene, requestedConfig) => {
    if (!scene?.isAlive()) return;

    const config = requestedConfig ?? world.get(ProjectConfigTrait)?.exportOf(scene) ?? getDefaultExportTemplate();
    const format = config.format ?? "mp4";
    const mimeType = MIME_TYPES[format];

    // Fail before the save picker: an unencodable configuration is known
    // right away, and the encoder would only find out after a file was
    // picked and the render machinery spun up.
    const videoEnabled = format !== "ogg" && config.video?.enabled !== false;
    if (videoEnabled) {
      const formatContext = sceneFormatOutput(scene, config);
      const codec = config.video?.codec ?? "avc";
      const { width, height } = formatContext.output;
      const encodable = await canEncodeVideo(codec, {
        width,
        height,
        bitrate: config.video?.bitrate ?? 10e6,
      });
      if (!encodable) {
        toast.error("Esta exportación no está disponible", {
          description:
            `No se puede codificar ${codec.toUpperCase()} a ${width}×${height}. ` +
            "Elegí una resolución menor, menos bitrate u otro códec.",
        });
        return;
      }
    }

    const name = project.name().replace(/\s+/g, "-").toLowerCase();

    let target: FileSystemFileHandle | ElectronWritableFileHandle;
    try {
      if (window.desktop) {
        const picked = await mainBridge.call(MAIN_CHANNELS.FILE_PICK_EXPORT, { dir: project.dir()!, name: `${name}.${format}`, extension: format });
        if (!picked.path) return;
        target = new ElectronWritableFileHandle(picked.path);
      } else target = await window.showSaveFilePicker({
        suggestedName: `${name}.${format}`,
        types: [
          {
            description: format,
            accept: {
              [mimeType]: [`.${format}`],
            } as Record<`${string}/${string}`, `.${string}`[]>,
          },
        ],
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      toast.error("No se pudo iniciar la exportación", {
        description: (e as Error).message,
      });
      return;
    }

    try {
      const result = await renderScene(engine, { scene, target, config, dir: project.dir(), source: "ui" });

      if (result.type === "error") {
        console.error("Export failed:", result.error);
        toast.error("No se pudo exportar", {
          description: result.error.message,
        });
      } else if (result.type === "success") {
        toast(t("Exportación terminada"), {
          description: t(videoEnabled ? "El video se guardó. Revisá el resultado antes de publicarlo." : "El audio se guardó."),
        });
      }
    } catch (e) {
      console.error("Export failed:", e);
      toast.error("No se pudo exportar", {
        description: (e as Error).message,
      });
    }
  };

  const exportCurrentFrame: ExportContextValue["exportCurrentFrame"] = async () => {
    const blob = await engine.snapshot();

    if (!blob) {
      toast.error("No se pudo capturar el fotograma");
      return;
    }

    const projectName = project.name().replace(/\s+/g, "-").toLowerCase();
    await downloadObject(blob, `${projectName}-frame.png`);
  };

  const exportActiveScene = () => {
    const scene = getActiveEntity(world);
    if (scene === null) {
      return toast(t("Elegí una escena para exportar"));
    }
    void exportScene(scene);
  };

  /**
   * Export is the provider's command, so its keys are bound here rather than
   * in the engine's shortcut table: ⌘E writes the active scene, ⇧⌘E the frame
   * on screen — the same two the File menu lists.
   */
  const handleShortcut = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "e") return;
    if (isInputTarget(event)) return;

    event.preventDefault();
    if (event.shiftKey) void exportCurrentFrame();
    else exportActiveScene();
  };

  onMount(() => window.addEventListener("keydown", handleShortcut));
  onCleanup(() => window.removeEventListener("keydown", handleShortcut));

  return (
    <ExportContext.Provider value={{ exportScene, exportCurrentFrame, exporting }}>
      {props.children}
      <ExportProgress
        open={!!renderOverlay()}
        progress={renderOverlay()?.progress ?? 0}
        remaining={renderOverlay()?.remaining}
        config={renderOverlay()?.config as ExportConfig | undefined}
        width={renderOverlay()?.width ?? 0}
        height={renderOverlay()?.height ?? 0}
        duration={renderOverlay()?.duration ?? 0}
        onCancel={cancelRender}
      />
      <PostExportOffer projectId={project.id()} exporting={exporting()} />
    </ExportContext.Provider>
  );
}

export function useExport() {
  const ctx = useContext(ExportContext);
  assert(ctx, "useExport must be used within ExportProvider");
  return ctx;
}
