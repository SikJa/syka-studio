import { mergeAttachments, type Attachment } from './attachments';
import { prepareChatFiles } from './local-attachments';
import { visualReviewManifest, visualReviewReference, type VisualReviewItem } from './visual-review-model';

/** Replace only the generated reference, preserving the user's message. */
export function reviewMessage(text: string, notes: VisualReviewItem[]) {
  const clean = text.replace(/Correcciones visuales \(\d+\):\n[\s\S]*?Los trazos son referencias, no capas del video\./g, '').trim();
  return [clean, visualReviewReference(notes)].filter(Boolean).join('\n\n');
}

export async function prepareVisualReview(text: string, attachments: Attachment[], notes: VisualReviewItem[], dir: string) {
  if (!notes.length) return { text, attachments };
  if (!dir) throw Error('Abrí un proyecto antes de preparar las notas.');
  const metadata = await prepareChatFiles([new File([visualReviewManifest(notes)], 'revision-visual.json', {type:'application/json'})], dir);
  return {
    text: reviewMessage(text, notes),
    attachments: mergeAttachments(attachments.filter(entry => entry.purpose !== 'visual-review-context'), [
      ...notes.flatMap(note => note.attachments),
      ...metadata.map(entry => ({...entry, purpose:'visual-review-context' as const})),
    ]),
  };
}
