import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

type Word = { text: string; start: number; end: number };
type Segment = { text: string; words: Word[] };
type Span = { sourceIn: number; sourceOut: number; timelineStart: number; playbackRate: number };
const schema = (properties: Record<string, unknown>, required: string[]) => ({ type: 'object', properties, required, additionalProperties: false });
export const CAPTIONS_RETIME_TOOL = {
  type: 'function', name: 'syka_captions_retime',
  description: 'Re-time an existing local transcript JSON after cuts or speed changes, without transcribing or spending model quota. Supply retained SOURCE ranges and their SCENE start/rate in seconds. Writes a fresh native captions JSON in the project, preserves word timestamps through the mapping and warns about cuts inside words. Use the returned file in a native <captions src=...> at start:0 and rate:1: do not apply source trim/speed twice. Does not modify the timeline or certify lip sync. Read syka-captions before applying; review cut boundaries in the actual scene.',
  inputSchema: schema({
    source: { type: 'string', description: 'Existing project JSON from media_transcribe, either a segment array or {segments:[...]}.' },
    spans: { type: 'array', minItems: 1, maxItems: 500, items: schema({
      sourceIn: { type: 'number', minimum: 0 }, sourceOut: { type: 'number', exclusiveMinimum: 0 },
      timelineStart: { type: 'number', minimum: 0 }, playbackRate: { type: 'number', exclusiveMinimum: 0, default: 1 },
    }, ['sourceIn', 'sourceOut', 'timelineStart']) },
  }, ['source', 'spans']),
};
const inside = (root: string, path: string) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep); };
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Se esperaba un objeto de subtítulos.');
  return value as Record<string, unknown>;
};
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Pure seconds-to-seconds conversion; each original segment stays separate at cuts. */
export function retimeCaptions(input: unknown, ranges: unknown) {
  if (!Array.isArray(ranges) || !ranges.length || ranges.length > 500) throw Error('Indicá entre 1 y 500 tramos conservados.');
  const spans: Span[] = ranges.map(value => {
    const span = object(value), rate = span.playbackRate ?? 1;
    if (Object.keys(span).some(key => !['sourceIn', 'sourceOut', 'timelineStart', 'playbackRate'].includes(key)) || !validTime(span.sourceIn) || !validTime(span.sourceOut) || span.sourceOut <= span.sourceIn || !validTime(span.timelineStart) || !validTime(rate) || rate === 0) throw Error('Tramo de subtítulos inválido: usá segundos y velocidad positiva.');
    const end = span.timelineStart + (span.sourceOut - span.sourceIn) / rate;
    if (!Number.isFinite(end) || end <= span.timelineStart) throw Error('El tramo produce un intervalo fuera de rango.');
    return { sourceIn: span.sourceIn, sourceOut: span.sourceOut, timelineStart: span.timelineStart, playbackRate: rate };
  }).sort((a, b) => a.timelineStart - b.timelineStart);
  for (let i = 1; i < spans.length; i++) {
    const previous = spans[i - 1]!;
    if (spans[i]!.timelineStart < previous.timelineStart + (previous.sourceOut - previous.sourceIn) / previous.playbackRate - 1e-9) throw Error('Los tramos se superponen en la salida. Prepará una pista de captions por hablante/capa.');
  }
  const raw = Array.isArray(input) ? input : object(input).segments;
  if (!Array.isArray(raw) || raw.length > 20_000) throw Error('Usá un transcript JSON con segmentos y palabras temporizadas.');
  let wordCount = 0;
  const source: Segment[] = raw.map(value => {
    const segment = object(value);
    if (typeof segment.text !== 'string' || !Array.isArray(segment.words)) throw Error('El segmento necesita texto y palabras con tiempos reales.');
    const words = segment.words.map(value => {
      const word = object(value);
      if (++wordCount > 100_000) throw Error('El transcript supera 100.000 palabras.');
      if (typeof word.text !== 'string' || !validTime(word.start) || !validTime(word.end) || word.end < word.start) throw Error('Tiempo de palabra inválido.');
      return { text: word.text, start: word.start, end: word.end };
    });
    if (segment.text.trim() && !words.length) throw Error('Hay texto sin tiempos de palabra. Usá los intervalos de frase originales; no inventes timestamps.');
    return { text: segment.text, words };
  });
  const segments: Segment[] = [], clipped: { text: string; sourceStart: number; sourceEnd: number; timelineStart: number }[] = [];
  let outputWords = 0, clippedCount = 0;
  for (const span of spans) for (const segment of source) {
    const words = segment.words.flatMap(word => {
      const start = Math.max(word.start, span.sourceIn), end = Math.min(word.end, span.sourceOut);
      if (end <= start) return [];
      if (++outputWords > 100_000) throw Error('La salida supera 100.000 palabras. Reducí el tramo o las repeticiones.');
      const mapped = { text: word.text, start: span.timelineStart + (start - span.sourceIn) / span.playbackRate, end: span.timelineStart + (end - span.sourceIn) / span.playbackRate };
      if (start !== word.start || end !== word.end) {
        clippedCount++;
        if (clipped.length < 20) clipped.push({ text: word.text, sourceStart: word.start, sourceEnd: word.end, timelineStart: mapped.start });
      }
      return [mapped];
    });
    if (words.length) segments.push({ text: words.length === segment.words.length ? segment.text : words.map(word => word.text.trim()).join(' '), words });
  }
  segments.sort((a, b) => a.words[0]!.start - b.words[0]!.start);
  return { segments, spans, sourceWords: wordCount, outputWords, clippedCount, clipped };
}

export async function captionsRetime(cwd: string, raw: unknown) {
  const args = object(raw);
  if (Object.keys(args).some(key => !['source', 'spans'].includes(key)) || typeof args.source !== 'string' || !args.source.toLowerCase().endsWith('.json')) throw Error('Indicá source JSON y spans.');
  const root = await realpath(cwd), source = resolve(root, args.source);
  if (!inside(root, source)) throw Error('El transcript debe estar dentro del proyecto. Importalo primero.');
  const actual = await realpath(source), info = await lstat(actual);
  if (!inside(root, actual) || !info.isFile() || info.size > 12 * 1024 ** 2) throw Error('Transcript fuera del proyecto o mayor a 12 MiB.');
  const bytes = await readFile(actual), converted = retimeCaptions(JSON.parse(bytes.toString('utf8')), args.spans);
  if (!converted.outputWords) throw Error('No hay palabras dentro de los tramos elegidos. No se creó un archivo vacío.');
  let folder = root;
  // Check every existing ancestor before mkdir: a junction must not redirect writes.
  for (const segment of ['03 Assets reutilizables', 'Transcripciones']) {
    folder = join(folder, segment);
    await mkdir(folder).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const entry = await lstat(folder);
    if (!entry.isDirectory() || entry.isSymbolicLink() || !inside(root, await realpath(folder))) throw Error('La carpeta de subtítulos sale del proyecto.');
  }
  const path = join(folder, 'captions-retimed-' + randomUUID() + '.json');
  const provenance = { source: relative(root, actual), sourceSha256: createHash('sha256').update(bytes).digest('hex'), timebase: 'scene-seconds', spans: converted.spans };
  await writeFile(path, JSON.stringify({ segments: converted.segments, provenance }, null, 2), { flag: 'wx' });
  return { path, relativePath: relative(root, path).split(sep).join('/'), sourcePreserved: true, timebase: 'scene-seconds', segments: converted.segments.length, words: converted.outputWords,
    clippedWords: converted.clippedCount, reviewCuts: converted.clipped, provenance,
    nextAction: 'Usá este JSON como src de captions nativos, sin repetir trim ni velocidad; verificá las palabras y cortes con check, capturas y reproducción.',
    evidence: 'Conversión determinista de timestamps existentes. No transcribió, no cambió la timeline y no verificó sincronía por escucha.' };
}
