/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { getAssetSpec, isAssetRef, parseSource } from "@diffusionstudio/jsx";
import { Ai, AssetId, Audio, GenAi, getEntityTree, Hidden, Muted, Paint, PaintType, Source } from "@diffusionstudio/runtime";
import { createEncoder } from "@diffusionstudio/encoder";
import { assetName, GENERATED_DIR, isPartialAsset } from "@diffusionstudio/assets";
import { createCapture } from "@/engine/capture";
import { requireGroqTranscription, transcribeWithGroq } from "@/lib/syka-transcription";
import { assert } from "@/utils";
import { toast } from "somoto";
import type { AssetRef } from "@diffusionstudio/jsx";
import type { Asset, AssetLibrary, PartialAsset } from "@diffusionstudio/assets";
import type { ExportResult } from "@diffusionstudio/encoder";
import type { Entity, World } from "koota";

const CLOUD_DISABLED = "Los servicios de generación y transformación de Diffusion están desactivados en Syka. Importá un recurso local. La generación de imágenes mediante Codex todavía no está integrada.";

class ReportedError extends Error {}

/** Caption generation uses Groq; all Diffusion cloud declarations fail locally. */
export function attachAi(world: World, library: AssetLibrary, dir?: string): EditorGenAi {
  const ai = new EditorGenAi(library, dir);
  world.set(Ai, ai);
  return ai;
}

export class EditorGenAi extends GenAi {
  private readonly library: AssetLibrary;
  private readonly dir?: string;
  private readonly inflight = new Map<string, Promise<Asset>>();
  private readonly rejected = new WeakMap<AssetRef, Promise<Asset>>();

  public constructor(library: AssetLibrary, dir?: string) {
    super();
    this.library = library;
    this.dir = dir;
  }

  public resolve(ref: AssetRef): Promise<Asset> {
    assert(isAssetRef(ref), "Not a generate.* declaration");
    const known = this.rejected.get(ref);
    if (known) return known;
    // Do not resolve/upload input assets before rejecting a cloud declaration.
    const type = getAssetSpec(ref).type;
    const error = reportFailure(new Error(CLOUD_DISABLED), type + " no disponible");
    const promise = Promise.reject<Asset>(error);
    this.rejected.set(ref, promise);
    return promise;
  }

  public transcribe(world: World, scene: Entity, seed: number): Promise<Asset> {
    const key = transcriptKey(scene, seed);
    const known = this.library.generated(key);
    if (known && !isPartialAsset(known)) return Promise.resolve(known);
    if (known?.state === "error") return Promise.reject(new ReportedError(known.error || "Falló la transcripción."));
    const running = this.inflight.get(key);
    if (running) return running;

    const promise = this.library.reserve({
      key, folder: GENERATED_DIR, type: "TRANSCRIPT", name: this.nextCaptionsName(),
    }).then(async (partial) => {
      try { return await this.runTranscription(world, scene, key, partial); }
      catch (error) {
        const failure = reportFailure(error, "Falló la transcripción de subtítulos");
        this.library.fail(partial, failure.message);
        throw failure;
      }
    }).finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  private async runTranscription(world: World, scene: Entity, key: string, partial: PartialAsset): Promise<Asset> {
    await requireGroqTranscription();
    assert(sceneHasAudio(world, scene), "Agregá un audio o video a la escena para generar subtítulos.");
    const capture = await createCapture(world, scene, { mode: "offline-audio", dir: this.dir });
    let result: ExportResult;
    try {
      const encoder = await createEncoder(capture.world, {
        format: "ogg", video: { enabled: false },
        audio: { enabled: true, codec: "opus", sampleRate: 24000 },
      });
      result = await encoder.render();
    } finally { capture.dispose(); }
    assert(result.type === "success" && result.data !== undefined, "No se pudo preparar la mezcla de audio de la escena.");
    const transcript = await transcribeWithGroq(new Blob([result.data], { type: "audio/ogg" }), undefined, this.dir ? { dir: this.dir } : undefined);
    const blob = new Blob([JSON.stringify(transcript)], { type: "application/json" });
    return this.library.store(blob, {
      name: assetName(partial), folder: GENERATED_DIR, generation: { key },
    });
  }

  private nextCaptionsName(): string {
    let max = 0;
    for (const entry of [...this.library.list(), ...this.library.partials()]) {
      const match = assetName(entry).match(/^Captions (\d+)\.json$/);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return "Captions " + (max + 1) + ".json";
  }
}

function reportFailure(error: unknown, title: string): ReportedError {
  if (error instanceof ReportedError) return error;
  const message = error instanceof Error ? error.message : String(error);
  toast.error(title, { id: "syka-ai:" + title + ":" + message, description: message });
  return new ReportedError(message);
}

export function transcriptKey(scene: Entity, seed: number): string {
  const source = scene.get(Source)?.value;
  const locator = source ? parseSource(source)?.locator : undefined;
  const sceneId = typeof locator === "string" ? locator : source ?? String(scene.id());
  return "transcript:groq:v1:" + sceneId + ":" + seed;
}

function sceneHasAudio(world: World, scene: Entity): boolean {
  for (const entity of getEntityTree(world, scene)) {
    if (entity.has(Hidden) || entity.has(Muted) || !entity.has(AssetId)) continue;
    if (entity.has(Audio) || entity.get(Paint)?.value === PaintType.VIDEO) return true;
  }
  return false;
}
