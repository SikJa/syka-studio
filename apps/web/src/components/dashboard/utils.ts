/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatEditedAt(modifiedAt: string): string {
  const timestamp = parseTimestamp(modifiedAt);
  if (!timestamp) return "Editado recién";

  const elapsedMs = Date.now() - timestamp;
  if (elapsedMs < 60_000) return "Editado recién";

  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `Editado hace ${minutes} minuto${minutes === 1 ? "" : "s"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Editado hace ${hours} hora${hours === 1 ? "" : "s"}`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `Editado hace ${days} día${days === 1 ? "" : "s"}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `Editado hace ${months} mes${months === 1 ? "" : "es"}`;

  const years = Math.floor(days / 365);
  return `Editado hace ${years} año${years === 1 ? "" : "s"}`;
}

const AVATAR_MAX_SIZE = 256;
export const AVATAR_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const AVATAR_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export async function cropAndResizeAvatar(file: File): Promise<Blob> {
  if (!AVATAR_FILE_TYPES.some((type) => type === file.type)) {
    throw new Error('Choose a PNG, JPEG or WebP image.');
  }
  if (file.size === 0 || file.size > AVATAR_MAX_FILE_BYTES) {
    throw new Error('Choose an image smaller than 5 MB.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image could not be opened. Choose another file.');
  }

  try {
    if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width * bitmap.height > 40_000_000) {
      throw new Error('Choose an image with fewer than 40 megapixels.');
    }
    const size = Math.min(bitmap.width, bitmap.height, AVATAR_MAX_SIZE);
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable on this computer.');

    // Decode and re-encode a centered square: no source path, EXIF or SVG is kept.
    const sSize = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - sSize) / 2;
    const sy = (bitmap.height - sSize) / 2;
    ctx.drawImage(bitmap, sx, sy, sSize, sSize, 0, 0, size, size);

    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
    if (blob.type !== 'image/webp' || blob.size === 0 || blob.size > 200_000) {
      throw new Error('This image could not be reduced for a local profile.');
    }
    return blob;
  } finally {
    bitmap.close();
  }
}

export function avatarDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not read the profile photo.'));
    reader.onerror = () => reject(new Error('Could not read the profile photo.'));
    reader.readAsDataURL(blob);
  });
}
