import { extname } from 'node:path';
import { notificationImageInfo } from './notification-image-info';
import { NOTICE_IMAGE_MAX_BYTES, NOTICE_ATTACHMENT_MAX_BYTES, NOTICE_TEXT_MAX_BYTES } from '../../../packages/agent-chat/src/notifications';

export function notificationAttachmentInfo(name: string, data: Buffer) {
  const extension = extname(name).slice(1).toLowerCase();
  if (extension === 'txt') {
    if (data.length > NOTICE_TEXT_MAX_BYTES) throw Error('El TXT debe pesar hasta 5 MB.');
    let text: string;
    try {
      const encoding = data[0] === 0xff && data[1] === 0xfe ? 'utf-16le'
        : data[0] === 0xfe && data[1] === 0xff ? 'utf-16be' : 'utf-8';
      try { text = new TextDecoder(encoding, { fatal: true }).decode(data); }
      catch (error) { if (encoding !== 'utf-8') throw error; text = new TextDecoder('windows-1252', { fatal: true }).decode(data); }
    } catch { throw Error('No se pudo leer el texto del TXT.'); }
    if (/[\u0000-\u0008\u000b\u000e-\u001f\u007f-\u009f]/.test(text)) throw Error('El TXT contiene datos binarios, no texto.');
    return { kind: 'text' as const, extension, mimeType: 'text/plain' };
  }
  const videos: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska' };
  if (videos[extension]) {
    if (!data.length || data.length > NOTICE_ATTACHMENT_MAX_BYTES) throw Error('El video debe pesar hasta 100 MB.');
    return { kind: 'video' as const, extension, mimeType: videos[extension]! };
  }
  if (data.length > NOTICE_IMAGE_MAX_BYTES) throw Error('La foto debe pesar hasta 25 MB.');
  return { kind: 'image' as const, ...notificationImageInfo(data) };
}

/** Require a real video stream, bounded dimensions, and the expected container. */
export function validateNotificationVideo(extension: string, metadata: unknown): void {
  const info = metadata as { format?: { format_name?: string }; streams?: { codec_type?: string; width?: number; height?: number }[] } | null;
  const stream = info?.streams?.find(value => value.codec_type === 'video');
  const formats = info?.format?.format_name?.split(',') || [];
  const compatible = ['mp4', 'mov'].includes(extension) ? formats.includes('mov') : formats.includes('matroska');
  if (!compatible || !stream?.width || !stream.height || stream.width > 16384 || stream.height > 16384 || stream.width * stream.height > 40_000_000) throw Error('No se pudo leer un video válido con este formato.');
}
