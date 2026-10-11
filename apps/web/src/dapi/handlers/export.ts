/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { canEncodeVideo } from "mediabunny";
import { computeOutputSize } from "@diffusionstudio/encoder";
import { Computed, FrameRate, Workarea } from "@diffusionstudio/runtime";
import { isAbsoluteSource } from "@diffusionstudio/assets";
import { DapiError } from "@diffusionstudio/dapi";

import { renderOverlay, renderScene } from "@/context/render";
import { ElectronWritableFileHandle } from "@/lib/electron-file-writable";
import { ProjectConfig as ProjectConfigTrait } from "@/engine/traits";
import { sceneConfigKey } from "@/engine/project-config";
import { getDefaultExportTemplate, VIDEO_FORMAT_OPTIONS } from "@/components/sidebar-right/inspector/export-templates";
import { mainBridge } from "@/lib/ipc";
import { MAIN_CHANNELS } from "@desktop/main-channels";
import { requireScene } from "../lib/scene";
import { awaitProjectReady } from '@/projects/readiness';

import type { AudioCodec, OutputFormat, VideoCodec } from "mediabunny";
import type { ExportSettings } from "@diffusionstudio/dapi";
import type { ContainerFormat, ExportConfig } from "@/engine/project-config";
import type { ToolHandler } from "../handler";

/**
 * The container the export writes: the output extension when a path was
 * given (ffmpeg's rule — the file must be what its name says), the config's
 * format otherwise, mp4 when neither says. A given path settles it entirely,
 * so a bad config format only fails an export that would actually use it.
 */
function resolveFormat(path: string | undefined, config: ExportConfig): ContainerFormat {
  const supported = VIDEO_FORMAT_OPTIONS.map((format) => `.${format}`).join(", ");
  if (path !== undefined) {
    if (!isAbsoluteSource(path)) {
      throw new DapiError("invalid-input", `La ruta de salida debe ser absoluta (se recibió "${path}").`);
    }
    const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
    if (!extension || !VIDEO_FORMAT_OPTIONS.includes(extension as ContainerFormat)) {
      throw new DapiError("invalid-input", `La ruta de salida debe terminar en una extensión compatible: ${supported}.`);
    }
    return extension as ContainerFormat;
  }
  const format = config.format ?? "mp4";
  if (!VIDEO_FORMAT_OPTIONS.includes(format)) {
    throw new DapiError(
      "invalid-input",
      `El formato "${format}" no es compatible. Usá ${supported.replaceAll(".", "")}.`,
    );
  }
  return format;
}

/** The container's format class, imported on demand: the muxers are not part of the main bundle. */
async function outputFormat(format: ContainerFormat): Promise<OutputFormat> {
  const { MovOutputFormat, Mp4OutputFormat, OggOutputFormat, WebMOutputFormat } = await import("mediabunny");
  switch (format) {
    case "webm":
      return new WebMOutputFormat();
    case "ogg":
      return new OggOutputFormat();
    case "mov":
      return new MovOutputFormat();
    default:
      return new Mp4OutputFormat();
  }
}

/** What each container is given when the entry's codec cannot go in it. */
const FALLBACK_VIDEO: Record<ContainerFormat, VideoCodec> = { mp4: "avc", mov: "avc", webm: "vp9", ogg: "vp9" };
const FALLBACK_AUDIO: Record<ContainerFormat, AudioCodec> = { mp4: "aac", mov: "aac", webm: "opus", ogg: "opus" };

/**
 * The entry's codecs, reconciled with the container the extension picked: an
 * entry written for MP4 names AAC, which WebM and Ogg cannot hold, so an
 * export to `.webm` would fail on the codec rather than produce the file the
 * name asks for. A codec the container cannot contain is swapped for the
 * container's own (Opus for WebM and Ogg audio, VP9 for WebM video); the
 * echoed config carries the swap. Codecs the container can hold stay as
 * written, including ones the entry leaves to the encoder's default.
 */
async function reconcileCodecs(settings: ExportConfig, format: ContainerFormat): Promise<ExportConfig> {
  const container = await outputFormat(format);
  const video = settings.video?.codec;
  const audio = settings.audio?.codec;
  const videoCodec = video && !container.getSupportedVideoCodecs().includes(video) ? FALLBACK_VIDEO[format] : video;
  const audioCodec = audio && !container.getSupportedAudioCodecs().includes(audio) ? FALLBACK_AUDIO[format] : audio;
  return {
    ...settings,
    ...(videoCodec !== video ? { video: { ...settings.video, codec: videoCodec } } : {}),
    ...(audioCodec !== audio ? { audio: { ...settings.audio, codec: audioCodec } } : {}),
  };
}

export const exportScene: ToolHandler<"export"> = async ({ id, path }, ctx) => {
  const { world, project, engine } = ctx.requireSession();
  if (renderOverlay()) throw new DapiError('busy', 'Ya hay una exportación en curso. Esperá a que termine o cancelala en la aplicación.');
  await awaitProjectReady(world, ctx.signal);
  if (ctx.requireSession().world !== world) throw new DapiError('canceled', 'El proyecto cambió antes de exportar.');
  const scene = requireScene(world, id, "export");

  // The scene's entry in the project's package.json (`diffusion.export.<id>`)
  // — the same one the app's export panel writes — so a tool export
  // reproduces the in-app one; a scene without an entry uses the default
  // template, the way ⌘E does. `template` is only the preset's label.
  const base = world.get(ProjectConfigTrait)?.exportOf(scene) ?? getDefaultExportTemplate();
  const format = resolveFormat(path, { format: base.format, video: base.video, audio: base.audio });
  const settings = await reconcileCodecs({ format, video: base.video, audio: base.audio }, format);
  const key = sceneConfigKey(scene) ?? id;
  const target = path ?? `${project.dir()}/02 Finales/${key.replace(/[^\w.-]+/g, "-")}.${format}`;

  // Fail before the render machinery spins up: an unencodable configuration
  // is known right away (same precheck the UI export runs).
  const videoEnabled = format !== "ogg" && settings.video?.enabled !== false;
  const computed = scene.get(Computed);
  const { width, height } = computeOutputSize(
    computed?.width || 1920,
    computed?.height || 1080,
    settings.video?.resolution ?? 1080,
  );
  if (videoEnabled) {
    const codec = settings.video?.codec ?? "avc";
    const encodable = await canEncodeVideo(codec, { width, height, bitrate: settings.video?.bitrate ?? 10e6 });
    if (!encodable) {
      throw new DapiError(
        "unsupported",
        `No se puede codificar ${codec.toUpperCase()} a ${width}×${height}. ` +
        "Elegí una resolución menor, menos bitrate u otro códec en la configuración de exportación.",
      );
    }
  }

  const workarea = scene.get(Workarea);
  const frames = workarea ? workarea.end - workarea.start : computed?.duration ?? 0;
  const duration = frames / (world.get(FrameRate)?.value || 30);

  // renderScene owns the one render slot (it stops the live engine and
  // raises the progress overlay), so refuse a second export rather than
  // interleave. No await sits between this check and renderScene claiming
  // the overlay, so two racing requests cannot both pass.
  if (renderOverlay()) {
    throw new DapiError("busy", "Ya hay una exportación en curso. Esperá a que termine o cancelala en la aplicación.");
  }

  const handle = new ElectronWritableFileHandle(target);
  try {
    const result = await renderScene(engine, {
      scene,
      target: handle,
      config: { ...settings, format },
      dir: project.dir(),
      source: "agent"
    }
    );
    if (result.type === "canceled") {
      throw new DapiError("canceled", "Se canceló la exportación en la aplicación");
    }
    if (result.type === "error") {
      throw result.error;
    }
  } catch (error) {
    // Close the fd and drop the partial file; a failed export leaves nothing.
    await handle.dispose().catch(() => { });
    throw error;
  }

  const stat = await mainBridge.call(MAIN_CHANNELS.PROJECTS_FS_STAT, { dir: project.dir(), source: target });

  const config: ExportSettings = { format, video: settings.video, audio: settings.audio };
  return {
    path: target,
    width: videoEnabled ? width : 0,
    height: videoEnabled ? height : 0,
    duration,
    size: stat?.size ?? 0,
    config,
  };
};
