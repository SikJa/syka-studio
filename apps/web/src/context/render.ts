/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal } from "solid-js";
import { createEncoder, computeOutputSize } from "@diffusionstudio/encoder";
import { Computed, FrameRate, Workarea } from "@diffusionstudio/runtime";

import { createCapture } from "@/engine/capture";
import { track } from "@/lib/analytics";
import { version } from "../../package.json";
import { ElectronWritableFileHandle } from '@/lib/electron-file-writable';
import { hidePostExportOffer, recordSuccessfulVideo } from '@/projects/post-export';
import { toast } from 'somoto';
import { notifyOperation } from '@/lib/studio-notifications';

import type { Entity } from "koota";
import type { EncoderConfig, ExportResult } from "@diffusionstudio/encoder";
import type { Capture } from "@/engine/capture";
import type { Engine } from "@/engine";
import type { ExportConfig } from "@/components/sidebar-right/inspector/export-progress";

/**
 * Unified scene render path, used by the UI export (`ExportProvider.exportScene`)
 * and the agent's export tool (`dapi/handlers/export`): the "Exporting
 * Composition" overlay, the engine stop/start lifecycle, the capture world the
 * encode runs against, progress reporting, cancel wiring, and the export
 * analytics events all live in {@link renderScene}.
 */

export type RenderOverlayState = {
  config?: Partial<ExportConfig>;
  /** The encode's actual pixel size, from the scene's own aspect ratio. */
  width: number;
  height: number;
  duration: number;
  progress: number;
  remaining?: { minutes: number; seconds: number };
};

const PROGRESS_LOG_STEP = 2;

const [overlay, setOverlay] = createSignal<RenderOverlayState | null>(null);
let cancelActive: (() => void) | undefined;

/** Reactive overlay state; `null` when no render is in flight. Read by `<ExportProgress>`. */
export const renderOverlay = overlay;

/** Cancel the render currently in flight, if any. Wired to the overlay's Cancel button. */
export function cancelRender() {
  cancelActive?.();
}

export type RenderSceneOptions = {
  /** Scene entity to encode. */
  scene: Entity;
  /** Where to write the output (a save-picker handle in the UI, a file path handle from the CLI). */
  target: NonNullable<EncoderConfig["target"]>;
  /** Encoder settings (resolution, codecs, format, ...). */
  config?: Partial<EncoderConfig>;
  /** The project's folder, so the encode compiles the sources as they are now. */
  dir?: string;
  /** Who asked for the render: the in-app export, or an agent through the export tool. */
  source: "ui" | "agent";
};

export async function renderScene(
  engine: Engine,
  { scene, target, config, dir, source }: RenderSceneOptions,
): Promise<ExportResult> {
  const world = engine.world;

  const workarea = scene.get(Workarea);
  const computed = scene.get(Computed);
  const frames = workarea
    ? workarea.end - workarea.start
    : computed?.duration ?? 0;
  const duration = frames / (world.get(FrameRate)?.value || 30);

  // The same size the encoder works out for itself, so the overlay reports
  // the dimensions actually encoded — the scene's aspect ratio, not 16:9.
  const { width, height } = computeOutputSize(
    computed?.width || 1920,
    computed?.height || 1080,
    config?.video?.resolution ?? 1080,
  );

  cancelActive = undefined;
  hidePostExportOffer();
  setOverlay({ config, width, height, duration, progress: 0, remaining: undefined });

  let logged = -1;
  const logProgress = (percent: number) => {
    if (percent - logged < PROGRESS_LOG_STEP && percent < 100) return;
    logged = percent;
    console.info(`[export] ${percent}%`);
  };

  engine.stop();

  const event = {
    source,
    format: config?.format,
    resolution: config?.video?.resolution,
    fps: config?.video?.fps,
    scene_duration_s: Math.round(duration),
  };
  const startedAt = performance.now();
  const operationId = crypto.randomUUID();
  const elapsed = () => Math.round(performance.now() - startedAt);
  const failed = (error: unknown) =>
    track("export_failed", {
      ...event,
      duration_ms: elapsed(),
      error: (error as Error)?.message?.slice(0, 200) ?? "unknown",
    });
  track("export_started", {
    ...event,
    video_codec: config?.video?.codec,
    audio_codec: config?.audio?.codec,
  });

  let capture: Capture | undefined;
  let completedVideo = false;
  try {
    capture = await createCapture(world, scene, {
      dir,
      frameRate: config?.video?.fps,
      mode: config?.video?.enabled === false || config?.format === "ogg" ? "offline-audio" : "offline-video",
    });

    const encoder = await createEncoder(capture.world, {
      ...config,
      target,
      comment: `Made with Diffusion Studio v${version}`,
      onProgress(p) {
        const percent = Math.round((p.progress / p.total) * 100);
        logProgress(percent);
        setOverlay((prev) =>
          prev
            ? {
                ...prev,
                progress: percent,
                remaining: {
                  minutes: p.remaining.getUTCMinutes(),
                  seconds: p.remaining.getUTCSeconds(),
                },
              }
            : prev,
        );
      },
    });

    cancelActive = encoder.cancel;
    const result = await encoder.render();

    if (result.type === "success") {
      completedVideo = config?.format !== 'ogg' && config?.video?.enabled !== false;
      track("export_completed", { ...event, duration_ms: elapsed() });
      if (dir && target instanceof ElectronWritableFileHandle) void notifyOperation({ dir }, { kind: 'export', operationId, artifact: target.path, message: 'El archivo se guardó y está listo para descargar o compartir.' });
    } else if (result.type === "error") {
      failed(result.error);
      if (dir) void notifyOperation({ dir }, { kind: 'blocked', operationId, message: 'La exportación se detuvo: ' + result.error.message });
    }

    return result;
  } catch (error) {
    // Setup failures (capture, encoder) as well as a throwing encode.
    failed(error);
    if (dir) void notifyOperation({ dir }, { kind: 'blocked', operationId, message: 'La exportación se detuvo: ' + (error as Error).message });
    throw error;
  } finally {
    cancelActive = undefined;
    setOverlay(null);
    capture?.dispose();
    engine.start();
    // Hash and memory checks happen after releasing the renderer. The offer
    // never starts a turn, and a metadata failure does not undo a good export.
    if (completedVideo && dir && target instanceof ElectronWritableFileHandle) {
      void recordSuccessfulVideo({ dir, path: target.path, width, height, duration, source }).catch(error => {
        console.warn('[post-export] Could not retain export context:', error);
        toast('El video se guardó', { description: 'No se pudo preparar el acceso a portada y textos. Podés pedirlo directamente en el chat.' });
      });
    }
  }
}
