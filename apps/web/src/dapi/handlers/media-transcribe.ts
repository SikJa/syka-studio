/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { getAssetFile } from "@diffusionstudio/runtime";
import { requireGroqTranscription, transcribeWithGroq } from "@/lib/syka-transcription";
import { requireAssetType, resolveAsset } from "../lib/assets";
import type { ToolHandler } from "../handler";

export const mediaTranscribe: ToolHandler<"media_transcribe"> = async ({ path }, ctx) => {
  const project = { dir: ctx.requireSession().project.dir() };
  await requireGroqTranscription();
  const asset = await resolveAsset(ctx, path);
  requireAssetType(asset, ["AUDIO", "VIDEO"], "a video or audio asset");
  // Persistent content-addressed chunk caching belongs to the main process.
  const segments = await transcribeWithGroq(await getAssetFile(asset), ctx.signal, project);
  return { segments };
};
