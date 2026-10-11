import { analysisSource, mediaProcess } from './media-analysis';
import { analyzeAudio } from './audio-analysis';
import { soundProfile } from './audio-spectrum';
import type { ToolSearch } from './local-tools';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

const schema = (properties: Record<string, unknown>, required: string[]) => ({ type: 'object', additionalProperties: false, properties, required });
export const SOUND_DESIGN_TOOLS = [
  { type: 'function', name: 'syka_audio_balance',
    description: 'Suggest an editable native SFX volume against a REAL local music/voice bed at bedCueSeconds. Measures stereo frequency-band energy and caps the individual SFX peak. Requires an isolated bed without this SFX, same mix gain, rate 1; no neural stems, EQ sidechain, writes or mastering. Import assets first. Gain is a candidate: apply native volume, listen and measure the actual final mix.',
    inputSchema: schema({ source: { type: 'string' }, bed: { type: 'string' }, bedCueSeconds: { type: 'number', minimum: 0 }, assetCuePointSeconds: { type: 'number', minimum: 0 }, weight: { type: 'string', enum: ['support', 'hero'] }, liftDb: { type: 'number', minimum: 1, maximum: 6 } }, ['source', 'bed', 'bedCueSeconds']) },
  { type: 'function', name: 'syka_audio_review',
    description: 'Review an existing LOCAL exported mix/video: real LUFS/true peak and optional per-cue asset fingerprints near export-relative seconds. Expected assetCuePointSeconds must be measured; supply the actual processed asset and playbackRate. Reports matched/inconclusive/not-detected, never certifies aesthetics or isolated cue audibility from a combined stem. Does not export or change the project. At most 180s and 12 cues; humans listen to the returned timecodes.',
    inputSchema: schema({ source: { type: 'string' }, targetLufs: { type: 'number', minimum: -30, maximum: -8 }, truePeakLimitDb: { type: 'number', minimum: -6, maximum: 0 }, cues: { type: 'array', maxItems: 12, items: schema({ id: { type: 'string' }, seconds: { type: 'number', minimum: 0 }, asset: { type: 'string' }, assetCuePointSeconds: { type: 'number', minimum: 0 }, playbackRate: { type: 'number', minimum: .25, maximum: 4 }, toleranceMs: { type: 'number', minimum: 1, maximum: 80 } }, ['id', 'seconds', 'asset', 'assetCuePointSeconds']) } }, ['source']) },
];

function object(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Se necesitan argumentos de audio.');
  return value as Record<string, unknown>;
}
function number(value: unknown, label: string, low: number, high: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) throw Error(`${label} fuera de rango.`);
  return value;
}
function fields(args: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(args).some(key => !allowed.includes(key))) throw Error('Campo de sonido desconocido.');
}
const round = (n: number) => Math.round(n * 10000) / 10000;
async function fileHash(path: string) {
  const hash = createHash('sha256');
  for await (const part of createReadStream(path)) hash.update(part);
  return hash.digest('hex');
}
async function duration(source: Awaited<ReturnType<typeof analysisSource>>) {
  const data = JSON.parse((await mediaProcess(source.ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', source.path], 100_000)).stdout.toString());
  const audio = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'audio');
  const seconds = Number(audio?.duration ?? data.format?.duration);
  if (!audio || !Number.isFinite(seconds) || seconds <= 0) throw Error('El archivo no tiene audio medible.');
  return seconds;
}
async function pcm(source: Awaited<ReturnType<typeof analysisSource>>, start: number, end: number, rate = 48000) {
  if (end <= start) throw Error('Intervalo de audio vacío.');
  const { stdout } = await mediaProcess(source.ffmpeg, ['-nostdin', '-v', 'error', '-ss', String(start), '-i', source.path, '-t', String(end - start), '-vn', '-map', '0:a:0', '-ar', String(rate), '-ac', '2', '-c:a', 'pcm_f32le', '-f', 'f32le', '-'], 12_000_000);
  if (!stdout.length || stdout.length % 8) throw Error('No se pudo decodificar PCM estéreo.');
  return stdout;
}

export async function audioBalance(cwd: string, raw: unknown, search?: ToolSearch) {
  const args = object(raw); fields(args, ['source', 'bed', 'bedCueSeconds', 'assetCuePointSeconds', 'weight', 'liftDb']);
  if (args.weight !== undefined && !['support', 'hero'].includes(String(args.weight))) throw Error('Peso sonoro desconocido.');
  const source = await analysisSource(cwd, args.source, search), bed = await analysisSource(cwd, args.bed, search);
  const length = await duration(source), bedLength = await duration(bed);
  if (length > 30) throw Error('Elegí un SFX de hasta 30 segundos.');
  const cue = number(args.bedCueSeconds, 'bedCueSeconds', 0, bedLength - .001);
  const sourcePcm = await pcm(source, 0, length), full = soundProfile(sourcePcm);
  const attack = number(args.assetCuePointSeconds ?? full.peakOffsetSeconds, 'assetCuePointSeconds', 0, length - .001);
  const before = Math.min(.02, attack, cue), after = Math.min(.12, length - attack, bedLength - cue);
  if (before + after < .02) throw Error('El cue necesita al menos 20 ms de señal disponible.');
  const event = soundProfile(sourcePcm.subarray(Math.round((attack - before) * 48000) * 8, Math.round((attack + after) * 48000) * 8));
  const base = soundProfile(await pcm(bed, cue - before, cue + after));
  const liftDb = number(args.liftDb ?? (args.weight === 'hero' ? 5 : 3), 'liftDb', 1, 6);
  const candidates = event.bands.map((band, i) => {
    const bedRms = Math.max(base.bands[i]!.rms, .001);
    const gainDb = 20 * Math.log10(bedRms * Math.sqrt(10 ** (liftDb / 10) - 1) / Math.max(band.rms, 1e-12));
    return { ...band, gainDb, bedRms };
  }).filter(band => band.energyRatio >= .1);
  if (!candidates.length || full.peakDb === null) throw Error('El SFX no tiene energía suficiente para proponer volumen.');
  const chosen = args.weight === 'hero' ? candidates.sort((a, b) => b.energyRatio - a.energyRatio)[0]! : candidates.sort((a, b) => a.gainDb - b.gainDb)[0]!;
  const peakCapDb = -2 - full.peakDb;
  if (peakCapDb < -96) throw Error('El SFX excede el rango de volumen nativo; revisar su archivo antes de mezclar.');
  const gainDb = Math.min(peakCapDb, Math.max(-36, Math.min(12, chosen.gainDb)));
  return { source: source.projectPath, bed: bed.projectPath, bedCueSeconds: cue, assetCuePointSeconds: attack,
    suggestedNativeVolumeDb: round(gainDb), requestedLiftDb: liftDb, bandHz: [chosen.lowHz, chosen.highHz],
    limitedBy: chosen.gainDb > Math.min(12, peakCapDb) ? 'individual peak / gain cap' : chosen.gainDb < -36 ? 'gain floor' : 'frequency-band candidate',
    originalPreserved: true, requiresListening: true,
    limitations: ['Estimación por energía FFT, no modelo perceptual de masking ni inteligibilidad.', 'La base debe excluir este SFX y conservar el volumen real de música/voz.', 'El techo individual no garantiza el pico del mix sumado; revisar el export real.', 'No se aplicaron volumen, EQ, ducking ni cambios de audio.'] };
}

/** Fingerprint of the actual expected asset, not the sum of unrelated SFX. */
export function matchCue(actual: Buffer, expected: Buffer, expectedFrame: number, rate = 8000) {
  const n = expected.length / 8, frames = actual.length / 8;
  let templateEnergy = 0; for (let i = 0; i < expected.length; i += 4) templateEnergy += expected.readFloatLE(i) ** 2;
  if (templateEnergy < 1e-12 || n < 32) return { status: 'inconclusive' as const, correlation: null, offsetMs: null, reason: 'template has no measurable energy' };
  const radius = Math.round(rate * .08); let best = -1, bestFrame = expectedFrame, observedEnergy = 0;
  const score = (frame: number) => {
    if (frame < 0 || frame + n > frames) return;
    let dot = 0, energy = 0;
    for (let i = 0; i < n * 2; i++) { const a = actual.readFloatLE(frame * 8 + i * 4), b = expected.readFloatLE(i * 4); dot += a * b; energy += a * a; }
    observedEnergy = Math.max(observedEnergy, energy);
    const value = energy > 1e-12 ? dot / Math.sqrt(energy * templateEnergy) : 0;
    if (value > best) { best = value; bestFrame = frame; }
  };
  for (let frame = expectedFrame - radius; frame <= expectedFrame + radius; frame += 8) score(frame);
  const coarse = bestFrame; for (let frame = coarse - 8; frame <= coarse + 8; frame++) score(frame);
  if (best < 0) return { status: 'inconclusive' as const, correlation: null, offsetMs: null, reason: 'no complete comparison window' };
  return { status: observedEnergy < 1e-12 ? 'not-detected' as const : best >= .45 ? 'matched' as const : 'inconclusive' as const,
    correlation: round(best), offsetMs: best >= .45 ? round((bestFrame - expectedFrame) / rate * 1000) : null,
    reason: best >= .45 ? 'candidate asset fingerprint in the actual decoded mix' : 'silence, masking, processing or unmatched asset; listen' };
}

export async function audioReview(cwd: string, raw: unknown, search?: ToolSearch) {
  const args = object(raw); fields(args, ['source', 'targetLufs', 'truePeakLimitDb', 'cues']);
  const target = args.targetLufs === undefined ? null : number(args.targetLufs, 'targetLufs', -30, -8);
  const ceiling = number(args.truePeakLimitDb ?? -1, 'truePeakLimitDb', -6, 0);
  const requested = args.cues ?? [];
  if (!Array.isArray(requested) || requested.length > 12) throw Error('La revisión admite hasta 12 cues.');
  const source = await analysisSource(cwd, args.source, search), length = await duration(source);
  if (length > 180) throw Error('La revisión admite un export de hasta 180 segundos.');
  const sourceSha256 = await fileHash(source.path);
  const measurements = await analyzeAudio(cwd, { source: args.source }, search);
  const cues = []; const ids = new Set<string>();
  for (const rawCue of requested) {
    const cue = object(rawCue); fields(cue, ['id', 'seconds', 'asset', 'assetCuePointSeconds', 'playbackRate', 'toleranceMs']);
    if (typeof cue.id !== 'string' || !cue.id || ids.has(cue.id)) throw Error('Cada cue necesita un ID único.'); ids.add(cue.id);
    const seconds = number(cue.seconds, 'seconds', 0, length - .001), playbackRate = number(cue.playbackRate ?? 1, 'playbackRate', .25, 4);
    const asset = await analysisSource(cwd, cue.asset, search), assetLength = await duration(asset);
    const assetSha256 = await fileHash(asset.path);
    const attack = number(cue.assetCuePointSeconds, 'assetCuePointSeconds', 0, assetLength - .001);
    // The window is centered on the measured asset cue, including trim at 0.
    const before = Math.min(.016, attack / playbackRate, seconds), after = Math.min(.048, (assetLength - attack) / playbackRate, length - seconds);
    const assetStart = attack - before * playbackRate, assetEnd = attack + after * playbackRate;
    const original = await pcm(asset, assetStart, assetEnd, 8000);
    if (await fileHash(asset.path) !== assetSha256) throw Error('El asset cambió durante la revisión; volvé a medirlo.');
    const frames = Math.floor(original.length / 8 / playbackRate), expected = Buffer.alloc(frames * 8);
    for (let i = 0; i < frames; i++) for (let c = 0; c < 2; c++) {
      const p = i * playbackRate, a = Math.floor(p), b = Math.min(original.length / 8 - 1, a + 1);
      const value = original.readFloatLE(a * 8 + c * 4) * (1 - (p - a)) + original.readFloatLE(b * 8 + c * 4) * (p - a);
      expected.writeFloatLE(value, i * 8 + c * 4);
    }
    const windowStart = Math.max(0, seconds - before - .081), windowEnd = Math.min(length, seconds + after + .081);
    const actual = await pcm(source, windowStart, windowEnd, 8000);
    const match = matchCue(actual, expected, Math.round((seconds - before - windowStart) * 8000));
    const toleranceMs = number(cue.toleranceMs ?? 33.3333, 'toleranceMs', 1, 80);
    cues.push({ id: cue.id, seconds, asset: asset.projectPath, assetSha256, ...match, toleranceMs,
      withinTolerance: match.offsetMs === null ? null : Math.abs(match.offsetMs) <= toleranceMs });
  }
  if (await fileHash(source.path) !== sourceSha256) throw Error('El export cambió durante la revisión; volvé a generar evidencia.');
  return { source: source.projectPath, sourceSha256, timebase: 'export-relative-seconds', integratedLufs: measurements.integratedLufs, truePeakDb: measurements.truePeakDb,
    loudness: target === null ? { status: 'measured', targetLufs: null } : { status: measurements.integratedLufs === null ? 'unmeasured' : Math.abs(measurements.integratedLufs - target) <= 1 ? 'within-target' : 'outside-target', targetLufs: target },
    peak: { status: measurements.truePeakDb === null ? 'unmeasured' : measurements.truePeakDb <= ceiling ? 'within-limit' : 'over-limit', limitDb: ceiling },
    cues, listenAtSeconds: cues.map(c => c.seconds), originalPreserved: true, requiresListening: true,
    limitations: ['Fingerprints are heuristic at 8 kHz, not proof of isolated audibility or aesthetic quality.', 'Use the actual processed asset; EQ, pitch, reverb, codec, repeated cues and masking can make a match inconclusive.', 'Stereo energy and template identity are preserved; no absent measurement is reported as a pass.', 'Cue seconds must account for the actual export start and trim. No export or audio changes were made.'] };
}
