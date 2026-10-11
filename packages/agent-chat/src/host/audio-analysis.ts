import { analysisSource, mediaProcess } from './media-analysis';
import type { ToolSearch } from './local-tools';
import { soundProfile, SFX_RATE } from './audio-spectrum';

export const AUDIO_ANALYSIS_TOOL = {
  type: 'function', name: 'syka_audio_analyze',
  description: 'Measure existing LOCAL project music, SFX or an exported mix without changing it. Returns source-time onsets, energy changes, candidate tempo/grid, LUFS/true peak. detail:sfx adds 48 kHz stereo attack, brightness, spectral bands and tail for at most 30 seconds; measuredCuePointSeconds is source-relative, profile offsets are interval-relative. Default rhythm allows 180 seconds. Heuristic candidates require listening, not semantic or musical approval. Import media first, measure the actual processed asset and anchor its attack to motion_events.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {
    source: { type: 'string' }, detail: { type: 'string', enum: ['rhythm', 'sfx'], description: 'sfx adds 48 kHz stereo spectral/attack/tail measurements for at most 30 seconds. rhythm is the default.' }, startSeconds: { type: 'number', minimum: 0 },
    endSeconds: { type: 'number', exclusiveMinimum: 0 },
  }, required: ['source'] },
};
const RATE = 8000, CHANNELS = 2, WINDOW = 80;
const round = (value: number) => Math.round(value * 10000) / 10000;
const db = (value: number) => value > 0 ? round(20 * Math.log10(value)) : null;
type Onset = { seconds: number; strength: number };

export function tempoCandidates(onsets: Onset[], duration: number) {
  if (onsets.length < 6 || duration < 4) return [];
  const tested: { bpm: number; confidence: number; firstBeatSeconds: number; gridFitErrorMs: number }[] = [];
  for (let bpm = 60; bpm <= 180; bpm++) {
    const period = 60 / bpm;
    let best = { confidence: 0, firstBeatSeconds: 0, gridFitErrorMs: Infinity };
    for (const phase of onsets.slice(0, 16)) {
      const aligned = onsets.filter(o => Math.abs((o.seconds - phase.seconds) / period - Math.round((o.seconds - phase.seconds) / period)) * period < .045);
      const slots = new Set(aligned.map(o => Math.round((o.seconds - phase.seconds) / period)));
      const span = onsets.at(-1)!.seconds - onsets[0]!.seconds;
      const coverage = Math.min(1, slots.size / Math.max(1, Math.round(span / period) + 1));
      const confidence = aligned.length / onsets.length * coverage;
      const error = aligned.length ? aligned.reduce((sum, o) => sum + Math.abs((o.seconds - phase.seconds) / period - Math.round((o.seconds - phase.seconds) / period)) * period * 1000, 0) / aligned.length : Infinity;
      if (confidence > best.confidence || confidence === best.confidence && error < best.gridFitErrorMs) best = { confidence, firstBeatSeconds: phase.seconds - Math.floor(phase.seconds / period) * period, gridFitErrorMs: error };
    }
    tested.push({ bpm, confidence: round(best.confidence), firstBeatSeconds: round(best.firstBeatSeconds), gridFitErrorMs: round(best.gridFitErrorMs) });
  }
  const selected: typeof tested = [];
  for (const candidate of tested.sort((a, b) => b.confidence - a.confidence || a.gridFitErrorMs - b.gridFitErrorMs)) {
    if (candidate.confidence < .55 || selected.some(c => Math.abs(c.bpm - candidate.bpm) < 4)) continue;
    selected.push(candidate); if (selected.length === 3) break;
  }
  return selected;
}

/** Stereo energy avoids losing opposite-phase transients in a mono downmix. */
export function analyzeAudioPcm(pcm: Buffer, startSeconds = 0) {
  if (!pcm.length || pcm.length % (4 * CHANNELS)) throw Error('FFmpeg no devolvió PCM estéreo completo.');
  const frames = pcm.length / (4 * CHANNELS), energy: number[] = [];
  let peak = 0, peakFrame = 0, total = 0;
  for (let frame = 0; frame < frames; frame += WINDOW) {
    const end = Math.min(frames, frame + WINDOW); let sum = 0;
    for (let i = frame; i < end; i++) for (let c = 0; c < CHANNELS; c++) {
      const value = pcm.readFloatLE((i * CHANNELS + c) * 4);
      if (!Number.isFinite(value)) throw Error('PCM inválido.');
      if (Math.abs(value) > peak) { peak = Math.abs(value); peakFrame = i; }
      sum += value * value;
    }
    total += sum; energy.push(Math.sqrt(sum / ((end - frame) * CHANNELS)));
  }
  const flux = energy.map((value, i) => Math.max(0, value - (energy[i - 1] ?? 0)));
  // Include quiet windows in the baseline: the median of ONLY positive flux
  // can be the drum attack itself and incorrectly reject every regular beat.
  const sortedFlux = [...flux].sort((a, b) => a - b);
  const threshold = Math.max(.003, (sortedFlux[Math.floor(sortedFlux.length * .5)] ?? 0) * 3, Math.max(...flux) * .15);
  const onsets: Onset[] = [];
  for (let i = 0; i < flux.length; i++) {
    if (flux[i]! < threshold || flux[i]! < (flux[i - 1] ?? 0) || flux[i]! < (flux[i + 1] ?? 0)) continue;
    const seconds = round(i * WINDOW / RATE);
    if (onsets.length && seconds - onsets.at(-1)!.seconds < .12) {
      if (flux[i]! > onsets.at(-1)!.strength) onsets[onsets.length - 1] = { seconds, strength: flux[i]! };
    } else onsets.push({ seconds, strength: flux[i]! });
  }
  const duration = frames / RATE, candidates = tempoCandidates(onsets, duration);
  const accepted = candidates[0]?.confidence && candidates[0].confidence >= .7 ? candidates[0] : null;
  const grid: number[] = [];
  if (accepted) for (let seconds = accepted.firstBeatSeconds; seconds < duration && grid.length < 600; seconds += 60 / accepted.bpm) grid.push(round(seconds + startSeconds));
  const strongest = energy.indexOf(Math.max(...energy));
  const blocks: { seconds: number; rmsDb: number | null; changeDb: number | null }[] = [];
  let previous: number | null = null;
  for (let i = 0; i < energy.length; i += 50) {
    const values = energy.slice(i, i + 50), rms = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length), level = db(rms);
    blocks.push({ seconds: round(startSeconds + i * WINDOW / RATE), rmsDb: level, changeDb: level === null || previous === null ? null : round(level - previous) }); previous = level;
  }
  return {
    durationSeconds: round(duration), decodedStereoPeakDb: db(peak), decodedStereoRmsDb: db(Math.sqrt(total / (frames * CHANNELS))),
    strongestSampleSeconds: peak ? round(startSeconds + peakFrame / RATE) : null,
    strongestEnergySeconds: peak ? round(startSeconds + strongest * WINDOW / RATE) : null,
    onsets: onsets.slice(0, 600).map(o => ({ seconds: round(startSeconds + o.seconds), strength: round(o.strength) })),
    onsetsTruncated: onsets.length > 600,
    tempoCandidates: candidates.map(c => ({ ...c, firstBeatSeconds: round(c.firstBeatSeconds + startSeconds) })),
    beatGridCandidate: grid, gridTruncated: !!accepted && duration / (60 / accepted.bpm) > 600,
    energyChanges: blocks.filter(b => b.changeDb !== null && Math.abs(b.changeDb) >= 6),
  };
}

export function measuredLoudness(stderr: string) {
  const blocks = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g);
  if (!blocks?.length) throw Error('FFmpeg no devolvió LUFS/true peak.');
  const data = JSON.parse(blocks.at(-1)!);
  const value = (key: string) => { const n = Number(data[key]); return data[key] !== null && data[key] !== undefined && data[key] !== '' && Number.isFinite(n) ? n : null; };
  return { integratedLufs: value('input_i'), truePeakDb: value('input_tp'), loudnessRangeLu: value('input_lra') };
}

export async function analyzeAudio(cwd: string, raw: unknown, search?: ToolSearch) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Se necesitan argumentos de audio.');
  const args = raw as Record<string, unknown>;
  if (Object.keys(args).some(k => !['source', 'startSeconds', 'endSeconds', 'detail'].includes(k))) throw Error('Campo de análisis desconocido.');
  if (args.detail !== undefined && !['rhythm', 'sfx'].includes(String(args.detail))) throw Error('Detalle de audio desconocido.');
  const source = await analysisSource(cwd, args.source, search);
  const probe = JSON.parse((await mediaProcess(source.ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', source.path], 100_000)).stdout.toString());
  const audio = probe.streams?.find((s: { codec_type: string }) => s.codec_type === 'audio');
  if (!audio) throw Error('El archivo no tiene audio.');
  const duration = Number(audio.duration ?? probe.format?.duration), start = args.startSeconds ?? 0, end = args.endSeconds ?? duration;
  if (!Number.isFinite(duration) || typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration + .02 || end - start > 180) throw Error('Elegí un intervalo válido de hasta 180 segundos del archivo.');
  if (args.detail === 'sfx' && end - start > 30) throw Error('El detalle SFX admite hasta 30 segundos.');
  const input = ['-nostdin', '-hide_banner', '-ss', String(start), '-i', source.path, '-t', String(end - start), '-map', '0:a:0', '-vn'];
  const decoded = await mediaProcess(source.ffmpeg, [...input, '-v', 'error', '-ar', String(RATE), '-ac', String(CHANNELS), '-c:a', 'pcm_f32le', '-f', 'f32le', '-'], 12_000_000);
  const metrics = analyzeAudioPcm(decoded.stdout, start);
  const loudness = measuredLoudness((await mediaProcess(source.ffmpeg, [...input, '-af', 'loudnorm=I=-18:TP=-2:LRA=9:print_format=json', '-f', 'null', '-'], 100_000)).stderr);
  const profile = args.detail === 'sfx' ? soundProfile((await mediaProcess(source.ffmpeg, [...input, '-v', 'error', '-ar', String(SFX_RATE), '-ac', '2', '-c:a', 'pcm_f32le', '-f', 'f32le', '-'], 12_000_000)).stdout) : null;
  return { source: source.projectPath, timebase: 'source-seconds', analyzedRange: { startSeconds: start, endSeconds: round(start + metrics.durationSeconds) }, analysisRate: RATE, ...metrics, ...loudness,
    ...(profile ? { soundProfile: profile, measuredCuePointSeconds: profile.peakOffsetSeconds === null ? null : round(start + profile.peakOffsetSeconds), profileRate: SFX_RATE } : {}),
    originalPreserved: true, limitations: ['Onsets y cambios de energía son candidatos, no palabras, compases ni drops semánticos.', 'Puede haber ambigüedad de tempo mitad/doble; escuchar antes de retimar.', 'Pico/RMS estéreo a 8 kHz son auxiliares; LUFS/true peak se miden aparte sobre el audio decodificado a su calidad original.', 'No se normalizó, mezcló ni modificó el archivo.'] };
}
