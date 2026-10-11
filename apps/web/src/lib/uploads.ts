/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Getting bytes into the cloud bucket the API resolves a `FileRef` against.
 * A whole Blob goes in one signed PUT; anything produced as it is encoded
 * (a transcode feeding a generation) goes through a GCS resumable session so
 * the payload is never held in memory in full.
 */

import { trpc } from "@/lib/trpc";

/**
 * Upload a Blob to the cloud bucket via a signed URL under the asset id.
 * Returns the FileRef the API can resolve.
 */
export async function uploadBlob(blob: Blob, id: string) {
  const contentType = blob.type || "application/octet-stream";
  const { uploadUrl, fileRef } = await trpc.getUploadUrl.mutate({ id, contentType });

  if (uploadUrl) {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });

    if (!res.ok) {
      console.error(`Failed to upload asset ${id}: ${res.status}`);
      return null;
    }
  }

  return fileRef;
}

/** GCS requires every resumable chunk except the last to be a multiple of 256 KiB. */
const RESUMABLE_CHUNK_SIZE = 8 * 1024 * 1024;

/**
 * Open a GCS resumable upload session against a signed "resumable" URL and
 * return the session URI that the bytes are streamed to.
 */
export async function startResumableSession(uploadUrl: string, mimeType: string): Promise<string> {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "x-goog-resumable": "start", "Content-Type": mimeType },
  });
  if (!res.ok) {
    throw new Error(`Failed to start resumable upload session: ${res.status}`);
  }
  const sessionUrl = res.headers.get("Location");
  if (!sessionUrl) {
    throw new Error("Resumable upload session response is missing the Location header.");
  }
  return sessionUrl;
}

/**
 * Stream a ReadableStream into an open GCS resumable session, PUTting
 * fixed-size chunks as bytes arrive so the full payload is never buffered.
 */
export async function uploadResumableStream(
  readable: ReadableStream<Uint8Array<ArrayBuffer>>,
  sessionUrl: string,
): Promise<void> {
  const reader = readable.getReader();
  let pending: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  let uploaded = 0;
  let done = false;

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) {
      done = true;
    } else if (value) {
      pending = concatBytes(pending, value);
    }

    while (pending.length >= RESUMABLE_CHUNK_SIZE) {
      await putResumableChunk(sessionUrl, pending.subarray(0, RESUMABLE_CHUNK_SIZE), uploaded, null);
      uploaded += RESUMABLE_CHUNK_SIZE;
      pending = pending.subarray(RESUMABLE_CHUNK_SIZE);
    }
  }

  await putResumableChunk(sessionUrl, pending, uploaded, uploaded + pending.length);
}

async function putResumableChunk(
  sessionUrl: string,
  chunk: Uint8Array<ArrayBuffer>,
  offset: number,
  total: number | null,
): Promise<void> {
  const last = offset + chunk.length - 1;
  const contentRange =
    total === null
      ? `bytes ${offset}-${last}/*`
      : chunk.length === 0
        ? `bytes */${total}`
        : `bytes ${offset}-${last}/${total}`;

  const res = await fetch(sessionUrl, {
    method: "PUT",
    headers: { "Content-Range": contentRange },
    body: chunk,
  });

  // 308 "Resume Incomplete" is expected while more chunks remain; the final
  // chunk finalizes the object and returns 200/201.
  if (total === null) {
    if (res.status !== 308) {
      throw new Error(`Unexpected status during resumable upload: ${res.status}`);
    }
  } else if (!res.ok) {
    throw new Error(`Failed to finalize resumable upload: ${res.status}`);
  }
}

function concatBytes(a: Uint8Array<ArrayBuffer>, b: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}
