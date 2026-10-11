/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { DapiError } from "@diffusionstudio/dapi";
import type { ToolHandler } from "../handler";

export const mediaListen: ToolHandler<"media_listen"> = async () => {
  throw new DapiError("unsupported", "El análisis multimodal de audio de Diffusion está desactivado. Codex puede trabajar con transcripciones de Groq y formas de onda; escuchar el audio directamente requiere un proveedor aparte que todavía no está integrado.");
};
