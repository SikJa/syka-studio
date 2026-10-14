import { createHash } from 'node:crypto';

/** Supplied word timings, not guessed from script length or certified as heard. */
export type Narration = {
  asset: string; timelineStartSeconds: number; sourceInSeconds: number; playbackRate: number;
  words: { text: string; start: number; end: number }[]; timingRevision: string;
  evidence: 'provided-word-timings';
};
const record = (value: unknown, keys: string[], name: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw Error(`${name}: campos inválidos.`);
  return value as Record<string, unknown>;
};
const finite = (value: unknown, min: number, max: number, name: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw Error(`${name}: número fuera de rango.`);
  return value;
};
export function narrationCues(raw: unknown): Narration | undefined {
  if (raw === undefined) return undefined;
  const v = record(raw, ['asset', 'timelineStartSeconds', 'sourceInSeconds', 'playbackRate', 'words'], 'narration');
  const asset = typeof v.asset === 'string' ? v.asset.trim().replaceAll('\\', '/') : '';
  if (!asset || asset.length > 12000 || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(asset) || asset.split('/').includes('..')) throw Error('narration.asset: ruta relativa portable requerida.');
  if (!Array.isArray(v.words) || !v.words.length || v.words.length > 8192) throw Error('narration.words: se necesitan palabras con timestamps reales.');
  let previous = -1;
  const words = v.words.map(rawWord => {
    const word = record(rawWord, ['text', 'word', 'start', 'end'], 'narration.word');
    const text = word.text ?? word.word;
    if (typeof text !== 'string' || !text.trim() || text.length > 512 || (word.text !== undefined && word.word !== undefined && word.text !== word.word)) throw Error('narration.word: texto inválido.');
    const start = finite(word.start, 0, 3600, 'word.start'), end = finite(word.end, start, 3600, 'word.end');
    if (start < previous || end === start) throw Error('narration.words: ordenar palabras por inicio y conservar duración positiva.');
    previous = start; // ASR word intervals may overlap; do not fabricate a repair.
    return { text: text.trim(), start, end };
  });
  const content = { asset,
    timelineStartSeconds: finite(v.timelineStartSeconds ?? 0, 0, 3600, 'timelineStartSeconds'),
    sourceInSeconds: finite(v.sourceInSeconds ?? 0, 0, 3600, 'sourceInSeconds'),
    playbackRate: finite(v.playbackRate ?? 1, .25, 4, 'playbackRate'), words };
  return { ...content, timingRevision: createHash('sha256').update(JSON.stringify(content)).digest('hex'), evidence: 'provided-word-timings' };
}
export function resolveWordCue(narration: Narration | undefined, raw: unknown, duration: number) {
  if (!narration) throw Error('wordCue necesita una toma de narración y sus palabras medidas.');
  const cue = record(raw, ['index', 'edge', 'offsetSeconds'], 'wordCue');
  const index = finite(cue.index, 0, narration.words.length - 1, 'wordCue.index');
  if (!Number.isInteger(index) || !['start', 'end'].includes(String(cue.edge))) throw Error('wordCue: índice entero y borde start/end requeridos.');
  const word = narration.words[index]!;
  const sourceSeconds = word[cue.edge as 'start' | 'end'];
  if (sourceSeconds < narration.sourceInSeconds) throw Error('wordCue apunta a una palabra recortada de la toma.');
  const offsetSeconds = finite(cue.offsetSeconds ?? 0, -duration, duration, 'wordCue.offsetSeconds');
  const seconds = Number((narration.timelineStartSeconds + (sourceSeconds - narration.sourceInSeconds) / narration.playbackRate + offsetSeconds).toFixed(9));
  if (seconds < 0 || seconds > duration) throw Error('wordCue fuera de la pieza: actualizar toma, beat o recorte.');
  return { index, edge: cue.edge as 'start' | 'end', offsetSeconds, text: word.text, sourceSeconds, seconds,
    timingRevision: narration.timingRevision, asset: narration.asset };
}
