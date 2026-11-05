/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * What local transcription downloads, pinned by version and SHA-256 (after
 * Syka Code's `core/features/voice/local/assets.ts`): a file that does not
 * match byte for byte is never installed.
 *
 * - Server: `whisper-bin-x64.zip` of whisper.cpp release b5130 (CPU builds
 *   for Windows). Only `whisper-server.exe` and its DLLs are extracted.
 * - Models: the ggml files of ggerganov/whisper.cpp on Hugging Face, pinned
 *   to one repository revision. Sizes and hashes come from that revision's
 *   LFS metadata.
 */

export type DownloadAsset = { url: string; sha256: string; sizeBytes: number };
export type RuntimeAsset = DownloadAsset & { folder: string; keep: RegExp };
export type ModelAsset = DownloadAsset & { file: string };

export const LOCAL_VOICE_MODELS = ["base", "small", "turbo"] as const;
export type LocalVoiceModel = (typeof LOCAL_VOICE_MODELS)[number];

const HF_REVISION = "5359861c739e955e79d9a303bcbc70fb988958b1";
const HF_BASE = `https://huggingface.co/ggerganov/whisper.cpp/resolve/${HF_REVISION}`;

export const WINDOWS_RUNTIME: RuntimeAsset = {
  url: "https://github.com/ggml-org/whisper.cpp/releases/download/b5130/whisper-bin-x64.zip",
  sha256: "f9ec6c52a2e949b62ab51fa21d0d497958f9e41c3010c157c4e42932d5316f3c",
  sizeBytes: 8_573_270,
  folder: "whisper-b5130",
  // The server, whisper.dll and ggml with every CPU variant (ggml picks the best one at start).
  keep: /^(?:whisper-server\.exe|whisper\.dll|ggml(?:-base|-cpu-[a-z0-9]+)?\.dll)$/i,
};

export const LOCAL_MODELS: Readonly<Record<LocalVoiceModel, ModelAsset>> = {
  base: {
    file: "ggml-base.bin",
    url: `${HF_BASE}/ggml-base.bin`,
    sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
    sizeBytes: 147_951_465,
  },
  small: {
    file: "ggml-small.bin",
    url: `${HF_BASE}/ggml-small.bin`,
    sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
    sizeBytes: 487_601_967,
  },
  turbo: {
    file: "ggml-large-v3-turbo-q5_0.bin",
    url: `${HF_BASE}/ggml-large-v3-turbo-q5_0.bin`,
    sha256: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2",
    sizeBytes: 574_041_195,
  },
};
