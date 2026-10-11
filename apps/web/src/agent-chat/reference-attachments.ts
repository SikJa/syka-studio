import type { Attachment } from './attachments';
import { attachmentCover } from './attachment-cover';

/** A snapshot: changing the playhead later must not retarget a reference. */
export function referenceAttachment(instruction: string, context: unknown, previewUrl?: string): Attachment {
  const snapshot = JSON.parse(JSON.stringify(context ?? {}));
  const elements = Array.isArray(snapshot.elements) ? snapshot.elements : [];
  const name = snapshot.name || snapshot.preset?.label || elements[0]?.name || 'Selección del video';
  const source = JSON.stringify({ instruction, context: snapshot });
  let hash = 2166136261;
  for (const char of source) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return {
    key: `reference:${(hash >>> 0).toString(36)}`,
    name, kind: 'file', path: typeof snapshot.path === 'string' ? snapshot.path : null,
    mimeType: 'application/x-syka-reference', purpose: 'agent-reference',
    previewUrl: previewUrl || attachmentCover(name, 'REF'),
    reference: { instruction, context: snapshot },
  };
}

export function referenceManifest(attachments: readonly Attachment[]): string | null {
  const references = attachments.filter(entry => entry.reference).map(entry => ({
    id: entry.key, name: entry.name, path: entry.path,
    instruction: entry.reference!.instruction, context: entry.reference!.context,
  }));
  return references.length ? JSON.stringify({ version: 1, type: 'syka-agent-references', references }, null, 2) : null;
}

/** Capture the library's real resting preview, not a different mock thumbnail. */
export function referenceThumbnail(element: Element | null | undefined): string | undefined {
  if (!element) return;
  try {
    const canvas = element.querySelector('canvas');
    if (canvas?.width && canvas.height) return canvas.toDataURL('image/png');
    const image = element.querySelector('img');
    if (image?.complete && image.naturalWidth) {
      const frame = document.createElement('canvas');
      const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
      frame.width = Math.max(1, Math.round(image.naturalWidth * scale));
      frame.height = Math.max(1, Math.round(image.naturalHeight * scale));
      frame.getContext('2d')!.drawImage(image, 0, 0, frame.width, frame.height);
      return frame.toDataURL('image/png');
    }
    const video = element.querySelector('video');
    if (video && video.readyState >= 2) {
      const frame = document.createElement('canvas');
      frame.width = 240; frame.height = Math.max(1, Math.round(240 * video.videoHeight / video.videoWidth));
      frame.getContext('2d')!.drawImage(video, 0, 0, frame.width, frame.height);
      return frame.toDataURL('image/png');
    }
  } catch { /* A blocked preview should not block attaching its reference. */ }
}
