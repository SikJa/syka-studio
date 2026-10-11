import { type Attachment, mergeAttachments } from './attachments';
import { prepareChatFiles } from './local-attachments';
import { referenceManifest } from './reference-attachments';

/** Materialize metadata only when sending; the draft remains the user's text. */
export async function prepareReferences(text: string, attachments: Attachment[], dir: string) {
  const manifest = referenceManifest(attachments);
  if (!manifest) return { text, attachments };
  if (!dir) throw Error('Abrí un proyecto antes de enviar las referencias.');
  const metadata = await prepareChatFiles([new File([manifest], 'referencias-syka.json', { type: 'application/json' })], dir);
  return {
    text: [text, 'Leé referencias-syka.json: contiene las referencias elegidas, sus instrucciones y la selección exacta del video.'].filter(Boolean).join('\n\n'),
    attachments: mergeAttachments(attachments, metadata),
  };
}
