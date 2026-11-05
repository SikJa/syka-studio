/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Download with progress, cancel and verification (Syka Code's
 * `local/download.ts`): written to `.part` while hashing, and renamed only when
 * size and SHA-256 match. A failure leaves nothing half-installed.
 */
import { createHash } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import type { DownloadAsset } from "./assets";

export type DownloadOptions = {
  fetch: typeof fetch;
  signal: AbortSignal;
  /** Bytes just received (not the total). */
  onBytes: (bytes: number) => void;
  onVerifying?: () => void;
};

export class DownloadCancelled extends Error {
  constructor() { super("Se canceló la descarga."); this.name = "DownloadCancelled"; }
}

export async function downloadVerified(asset: DownloadAsset, destination: string, options: DownloadOptions): Promise<void> {
  const part = `${destination}.part`;
  await mkdir(dirname(destination), { recursive: true });
  let response: Response;
  try {
    response = await options.fetch(asset.url, { signal: options.signal, redirect: "follow" });
  } catch {
    if (options.signal.aborted) throw new DownloadCancelled();
    throw new Error("No se pudo conectar para descargar. Revisá la conexión a internet.");
  }
  if (!response.ok || !response.body) throw new Error(`El servidor de descarga respondió ${response.status}. Probá de nuevo más tarde.`);

  const hash = createHash("sha256");
  let received = 0;
  const file = await open(part, "w");
  try {
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      hash.update(chunk);
      await file.write(chunk);
      received += chunk.byteLength;
      options.onBytes(chunk.byteLength);
    }
  } catch {
    await file.close();
    await rm(part, { force: true });
    if (options.signal.aborted) throw new DownloadCancelled();
    throw new Error("La descarga se cortó. Revisá la conexión y probá de nuevo.");
  }
  await file.close();
  options.onVerifying?.();
  if (received !== asset.sizeBytes || hash.digest("hex") !== asset.sha256) {
    await rm(part, { force: true });
    throw new Error("Lo descargado no coincide con el archivo esperado (SHA-256), así que no se instaló. Probá de nuevo.");
  }
  await rename(part, destination);
}
