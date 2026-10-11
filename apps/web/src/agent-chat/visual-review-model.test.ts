import { describe, it, expect } from 'vitest';
import { appendVisualNote, drawingBounds, normalizedPoint, visualReviewReference, visualReviewManifest, type VisualReviewItem } from './visual-review-model';
const note = (id: string): VisualReviewItem => ({ id, title: 'Tarjeta', instruction: 'Más contraste', context: { timeSeconds: 7, elements: [{ source: 'main.tsx', key: id }], annotation: { kind: 'drawing' } }, attachments: [] });
describe('visual review handoff', () => {
  it('keeps different component identities and times when collecting notes without mutating the draft batch', () => {
    const first = [note('a')], second = { ...note('b'), context: { timeSeconds: 12, elements: [{ source: 'main.tsx', key: 'b' }] } };
    const batch = appendVisualNote(first, second);
    expect(first).toHaveLength(1);
    const payload = visualReviewManifest(batch);
    expect(payload).toContain('"timeSeconds": 7');expect(payload).toContain('"timeSeconds": 12');
    expect(payload).toContain('"key": "a"');expect(payload).toContain('"key": "b"');
    const summary = visualReviewReference(batch);
    expect(summary).toContain('7.00 s'); expect(summary).toContain('12.00 s'); expect(summary).toContain('revision-visual.json');
    expect(summary).not.toContain('"elements"');
    expect(() => appendVisualNote(Array.from({ length: 10 }, (_, i) => note(String(i))), second)).toThrow('10 notas');
  });
  it('anchors drawings to the render and keeps cropped marks inside it', () => {
    expect(normalizedPoint({ x: 960, y: 540 }, 1920, 1080)).toEqual({ x: .5, y: .5 });
    expect(normalizedPoint({ x: -20, y: 1100 }, 1920, 1080)).toEqual({ x: 0, y: 1 });
    expect(drawingBounds([], 1920, 1080)).toBeNull();
    const bounds = drawingBounds([[{ x: 0, y: 0 }, { x: 1920, y: 1080 }]], 1920, 1080)!;
    expect(bounds).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });
  it('keeps capture-only references without inventing a change request', () => {
    const capture = { ...note('capture'), instruction: '', context: { timeSeconds: 2, kind: 'editable-elements', elements: [{ subtarget: { source: 'main.tsx:title' } }, { subtarget: { source: 'main.tsx:subtitle' } }], capture: 'capture.png' } };
    const manifest = JSON.parse(visualReviewManifest([capture]));
    expect(manifest.notes[0].instruction).toBe(''); expect(manifest.notes[0].elements.map((item: {subtarget: {source: string}}) => item.subtarget.source)).toEqual(['main.tsx:title', 'main.tsx:subtitle']);
    const summary = visualReviewReference([capture]); expect(summary).toContain('(referencia visual)'); expect(summary).toContain('preguntá qué se quiere cambiar'); expect(summary).not.toContain('Más contraste');
  });
});
