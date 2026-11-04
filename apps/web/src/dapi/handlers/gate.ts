/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The film gate: the scene drawn the way an export draws it, a few frames a
// second, and every frame read twice — its pixels for empty or frozen
// stretches, its layout for text cut by the canvas edge, covered by an element
// drawn over it, or laid over another text. What fails here is what a viewer
// sees as broken; the agent fixes it before replying.

import {
  AdjustmentLayer, Audio, Cache, Chars, Computed, FrameRate, Geometry, Group, Hidden, IsClipPath, Paint, PaintType,
  Scene, Source, Workarea, WorldBounds, framesToSeconds, isText, store,
} from "@diffusionstudio/runtime";
import { createImageEncoder } from "@diffusionstudio/encoder";
import { TIME_FPS } from "@diffusionstudio/jsx";
import { DapiError } from "@diffusionstudio/dapi";
import { createCapture } from "@/engine/capture";
import { awaitProjectReady } from "@/projects/readiness";
import { requireScene } from "../lib/scene";

import { area, judgeFrames, judgeLines, type Drawn, type FrameReading } from "./gate-judge";
import type { Entity, World } from "koota";
import type { ToolHandler } from "../handler";

/** Height frames are drawn at: enough to read a caption's box, cheap to draw. */
const GATE_HEIGHT = 270;
/** Pixels compared per frame. */
const SAMPLE_W = 160, SAMPLE_H = 90;

function drawsPixels(entity: Entity): boolean {
  return entity.has(Geometry) && !entity.has(Scene) && !entity.has(Group) && !entity.has(AdjustmentLayer) && !entity.has(IsClipPath) && !entity.has(Audio);
}

const PICTURE_PAINTS = new Set([PaintType.IMAGE, PaintType.VIDEO, PaintType.HTML]);
function isPicture(entity: Entity): boolean {
  return [entity, ...(entity.get(Cache)?.fills ?? [])].some(fill => PICTURE_PAINTS.has(fill.get(Paint)?.value as PaintType));
}

/** What draws in this frame, in draw order, with opacity carried down the tree. */
function drawnNow(world: World, scene: Entity): Drawn[] {
  const computed = store(world, Computed);
  const bounds = store(world, WorldBounds);
  const drawn: Drawn[] = [];
  const walk = (entity: Entity, opacity: number) => {
    const eid = entity.id();
    if (entity.has(Hidden) || computed.visibility[eid] === 0) return;
    const alpha = opacity * (computed.opacity[eid] ?? 1);
    if (alpha < 0.05) return;
    if (entity !== scene && drawsPixels(entity) && alpha >= 0.5) {
      const box = { minX: bounds.minX[eid]!, minY: bounds.minY[eid]!, maxX: bounds.maxX[eid]!, maxY: bounds.maxY[eid]! };
      const text = isText(entity);
      if (area(box) > 1) drawn.push({ stamp: entity.get(Source)?.value, box, order: drawn.length, text, picture: isPicture(entity), ...(text ? { chars: entity.get(Chars)?.value ?? '' } : {}) });
    }
    for (const child of entity.get(Cache)?.children ?? []) walk(child, alpha);
  };
  walk(scene, 1);
  return drawn;
}

/** Reads the drawn canvas small: how much is on it and how much it moved. */
function samplePixels(canvas: HTMLCanvasElement, sampler: CanvasRenderingContext2D, previous: Float32Array | null): { content: number; change: number; grey: Float32Array } {
  sampler.clearRect(0, 0, SAMPLE_W, SAMPLE_H);
  sampler.drawImage(canvas, 0, 0, SAMPLE_W, SAMPLE_H);
  const data = sampler.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
  const pixels = SAMPLE_W * SAMPLE_H;
  // The ground is the most common colour, coarsely quantised.
  const counts = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i]! >> 4) << 8 | (data[i + 1]! >> 4) << 4 | (data[i + 2]! >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let ground = 0, best = -1;
  for (const [key, count] of counts) if (count > best) { best = count; ground = key; }
  const gr = ((ground >> 8) & 15) * 16 + 8, gg = ((ground >> 4) & 15) * 16 + 8, gb = (ground & 15) * 16 + 8;
  const grey = new Float32Array(pixels);
  let differing = 0, change = 0;
  for (let p = 0, i = 0; p < pixels; p++, i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    if (Math.max(Math.abs(r - gr), Math.abs(g - gg), Math.abs(b - gb)) > 28) differing++;
    grey[p] = 0.299 * r + 0.587 * g + 0.114 * b;
    if (previous) change += Math.abs(grey[p]! - previous[p]!);
  }
  return { content: differing / pixels, change: previous ? change / pixels : Infinity, grey };
}

export const gate: ToolHandler<"gate"> = async ({ id, fps, finalHold, lines, stillMax }, ctx) => {
  const { world, project } = ctx.requireSession();
  await awaitProjectReady(world, ctx.signal);
  if (ctx.requireSession().world !== world) throw new DapiError("canceled", "El proyecto cambió durante la revisión.");
  const scene = requireScene(world, id, "gate");
  const rate = world.get(FrameRate)?.value ?? 30;
  const computed = scene.get(Computed)!;
  const workarea = scene.get(Workarea);
  const startFrame = workarea ? Math.min(computed.end, computed.start + Math.max(0, workarea.start)) : computed.start;
  const endFrame = workarea?.end ? Math.min(computed.end, computed.start + workarea.end) : computed.end;
  const duration = framesToSeconds(Math.max(0, endFrame - startFrame), rate);
  if (duration <= 0) throw new DapiError("invalid-input", "La escena no tiene duración que revisar.");

  const step = 1 / (fps ?? 5);
  const frames: number[] = [];
  for (let t = 0; t < duration - 1e-6; t += step) frames.push(Math.round(t * TIME_FPS));

  const sampler = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!sampler) throw new DapiError("unsupported", "No se pudo leer la imagen de la escena.");
  sampler.canvas.width = SAMPLE_W;
  sampler.canvas.height = SAMPLE_H;

  const target = await createCapture(world, scene, { dir: project.dir() });
  const readings: FrameReading[] = [];
  let previous: Float32Array | null = null;
  try {
    const encoder = await createImageEncoder(target.world, {
      frames,
      resolution: GATE_HEIGHT,
      encode: false,
      onFrame: (_frame, canvas, frameWorld) => {
        if (ctx.signal?.aborted) throw new DapiError("canceled", "Revisión cancelada");
        const pixels = samplePixels(canvas, sampler, previous);
        previous = pixels.grey;
        readings.push({ content: pixels.content, change: pixels.change, drawn: drawnNow(frameWorld, target.node), width: canvas.width, height: canvas.height });
      },
    });
    const result = await encoder.render();
    if (result.type === "canceled") throw new DapiError("canceled", "Revisión cancelada");
    if (result.type === "error") throw result.error;
  } finally {
    target.dispose();
  }

  const issues = [...judgeFrames(readings, step, finalHold ?? 3, stillMax), ...judgeLines(readings, step, lines ?? [])];
  return { passed: !issues.some(issue => issue.severity === "error"), duration: Math.round(duration * 1000) / 1000, framesChecked: readings.length, issues };
};
