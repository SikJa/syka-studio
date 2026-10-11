import type { Attachment } from './attachments';

export type ReviewPoint = { x: number; y: number };
export type VisualReviewItem = {
  id: string;
  title: string;
  instruction: string;
  context: Record<string, unknown>;
  attachments: Attachment[];
  preview?: string;
};
export const MAX_VISUAL_NOTES = 10;

/** All annotation coordinates are relative to the actual render, never the window. */
export function normalizedPoint(point: ReviewPoint, width: number, height: number): ReviewPoint {
  return { x: Math.max(0, Math.min(1, point.x / Math.max(1, width))), y: Math.max(0, Math.min(1, point.y / Math.max(1, height))) };
}

export function drawingBounds(strokes: ReviewPoint[][], width: number, height: number) {
  const points = strokes.flat();
  if (!points.length) return null;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const padding = Math.max(16, Math.min(width, height) * .035);
  const x = Math.max(0, Math.min(...xs) - padding), y = Math.max(0, Math.min(...ys) - padding);
  const right = Math.min(width, Math.max(...xs) + padding), bottom = Math.min(height, Math.max(...ys) + padding);
  return { x, y, width: right - x, height: bottom - y };
}

export function appendVisualNote(items: VisualReviewItem[], item: VisualReviewItem) {
  if (items.length >= MAX_VISUAL_NOTES) throw Error('Ya tenés 10 notas. Pasalas al chat antes de agregar más.');
  return [...items, item];
}

export function visualReviewReference(items: VisualReviewItem[]) {
  if (!items.length) return '';
  return `Correcciones visuales (${items.length}):\n${items.map(note => `• ${Number(note.context.timeSeconds ?? 0).toFixed(2)} s · ${note.title}${note.instruction.trim() ? ': ' + note.instruction : ' (referencia visual)'}`).join('\n')}\n\nEl adjunto revision-visual.json conserva los componentes, instantes y capturas de estas notas. Releé el source actual antes de editar y conservá las partes que no se señalaron. Si hay subtarget, usá su source o selector dentro del HTML del componente: la indicación apunta a ese texto o hijo, no a todo el bloque. Una captura sin indicación es contexto: seguí el pedido del chat; si tampoco hay un pedido, preguntá qué se quiere cambiar. Verificá el texto y la ubicación en la fuente actual; si cambió, volvé a resolverlo. Los trazos son referencias, no capas del video.`;
}

export function visualReviewManifest(items: VisualReviewItem[]) {
  return JSON.stringify({ version: 1, kind: 'syka-visual-review', notes: items.map(({ title, instruction, context }) => ({ ...context, title, instruction })) }, null, 2);
}
