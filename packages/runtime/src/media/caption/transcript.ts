/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import type { Transcript } from '@diffusionstudio/assets';

/** Native transcript arrays and the media_transcribe result share word timing. */
export function parseTranscriptJson(text: string): Transcript {
  const parsed: unknown = JSON.parse(text);
  const segments = Array.isArray(parsed) ? parsed
    : parsed && typeof parsed === 'object' ? (parsed as { segments?: unknown }).segments : undefined;
  if (!Array.isArray(segments)) throw new Error('Transcript JSON must contain a segment array or { segments: [...] }');
  return segments.map((segment: unknown) => {
    if (!segment || typeof segment !== 'object') throw new Error('Invalid transcript segment');
    const entry = segment as { text?: unknown; words?: unknown };
    if (typeof entry.text !== 'string' || !Array.isArray(entry.words)) throw new Error('Transcript segment requires text and timed words');
    const words = entry.words.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error('Invalid transcript word');
      const word = item as { text?: unknown; start?: unknown; end?: unknown };
      if (typeof word.text !== 'string' || typeof word.start !== 'number' || typeof word.end !== 'number'
        || !Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < 0 || word.end < word.start) {
        throw new Error('Invalid transcript word timing');
      }
      return { text: word.text, start: word.start, end: word.end };
    });
    return { text: entry.text, words };
  });
}
