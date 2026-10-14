/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { resolveLocalTool, type ToolSearch } from './local-tools';
import type { ToolImage } from '../protocol';
import { motionDiagnostics } from './motion-diagnostics';

export const MOTION_REVIEW_TOOL = {
  type: 'function', name: 'syka_motion_review',
  description: 'Build evidence from an existing LOCAL project export: contact sheets (up to 120 samples), 12 consecutive encoded frames around focusTime, and original-aspect 360px reading frames. Also screens consecutive 32x18 grayscale frames for one-frame flash candidates and optional loop seam/velocity changes, labelled against declaredCuts. Returns images, actual timestamps, video hash, source snapshot and automaticChecks. Uses local FFmpeg/FFprobe, preserves the file, never renders or exports a composition. Open candidate neighborhoods and review playback/audio; signals are not aesthetic approval, a comprehensive glitch detector or source seek verification. Use an existing user export; a source snapshot does not prove which revision produced it. Up to 180 seconds per review.',
  inputSchema: { type: 'object', properties: {
    source: { type: 'string', description: 'Video export path inside the open project.' },
    focusTime: { type: 'number', minimum: 0, description: 'Seconds from the first decoded frame of the export. Choose the risky transition; not automatic fastest-motion detection.' },
    readingTimes: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'number', minimum: 0 }, description: 'Held frames to inspect for readable type. Defaults to 15%, 50%, 85% of the export.' },
    events: { type: 'array', maxItems: 12, items: { type: 'object', properties: { id: { type: 'string' }, seconds: { type: 'number', minimum: 0 } }, required: ['id', 'seconds'], additionalProperties: false }, description: 'Shared event IDs with fresh resolved native seconds from motion_events. Captures the encoded frame before, nearest and after each event. Times must correspond to the exported composition, not another scene.' },
    exportStartSeconds: {type:'number',minimum:0,description:'Composition time where this export starts. For a default workarea export, pass exportStartSeconds from motion_events. This offset is subtracted ONLY from events; focusTime and readingTimes remain export-relative. Use the actual trim of this file, not a changed current workarea.'},
    loop: { type: 'boolean', description: 'Screen the last/first frame seam only if this piece is meant to loop.' },
    declaredCuts: { type: 'array', maxItems: 64, items: { type: 'number', minimum: 0 }, description: 'Intentional cuts in export-relative seconds. Flash candidates near them are labelled, not automatically dismissed.' },
  }, required: ['source', 'focusTime'], additionalProperties: false },
};
type Frame = { index: number; seconds: number };
type ReviewEvent = { id: string; seconds: number };
const inside = (root: string, file: string) => {
  const rel = relative(root, file);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep);
};
function run(binary: string, args: string[], limit = 4_000_000): Promise<string> {
  return new Promise((ok, fail) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', settled = false;
    const finish = (error?: Error) => {
      if (settled) return; settled = true; clearTimeout(timer);
      error ? fail(error) : ok(stdout);
    };
    const timer = setTimeout(() => { child.kill(); finish(Error('La revisión superó tres minutos en un paso. Revisá un tramo más corto.')); }, 180_000);
    child.stdout.on('data', d => {
      stdout += String(d);
      if (stdout.length > limit) { child.kill(); finish(Error('La evidencia excede el límite de revisión.')); }
    });
    child.stderr.on('data', d => { stderr = (stderr + String(d)).slice(-6000); });
    child.on('error', e => finish(e));
    child.on('close', code => finish(code === 0 ? undefined : Error(stderr || `Proceso de revisión falló (${code}).`)));
  });
}
async function hashFile(path: string) {
  const hash = createHash('sha256');
  for await (const part of createReadStream(path)) hash.update(part);
  return hash.digest('hex');
}
export function closestFrame(frames: Frame[], seconds: number): Frame {
  let a = 0, b = frames.length - 1;
  while (a < b) { const m = Math.floor((a + b) / 2); if (frames[m]!.seconds < seconds) a = m + 1; else b = m; }
  const next = frames[a]!, prev = frames[Math.max(0, a - 1)]!;
  return seconds - prev.seconds <= next.seconds - seconds ? prev : next;
}
export function reviewPlan(frames: Frame[], duration: number, focusTime: number, readingTimes?: number[], events: ReviewEvent[] = [], exportStartSeconds=0) {
  if(!Number.isFinite(exportStartSeconds)||exportStartSeconds<0)throw Error('Origen de export inválido.');
  if (!frames.length || frames.some((f, i) => !Number.isFinite(f.seconds) || f.seconds < 0 || (i > 0 && f.seconds <= frames[i - 1]!.seconds)))
    throw Error('El video no tiene timestamps de cuadro estrictamente crecientes.');
  const times = readingTimes ?? [duration * .15, duration * .5, duration * .85];
  if (!Number.isFinite(duration) || duration <= 0 || duration > 180 ||
      !Number.isFinite(focusTime) || focusTime < 0 || focusTime >= duration ||
      !Array.isArray(times) || times.length < 1 || times.length > 12 ||
      times.some(t => typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t >= duration))
    throw Error('Elegí tiempos dentro del video (hasta 180 segundos, 1–12 tiempos de lectura).');
  const count = Math.min(119, Math.ceil(duration * 2));
  const contact = [...new Set([...Array.from({ length: count }, (_, i) => closestFrame(frames, i * duration / count).index), frames.length - 1])]
    .sort((a, b) => a - b).map(i => frames[i]!);
  const center = closestFrame(frames, focusTime).index;
  const start = Math.max(0, Math.min(center - 6, frames.length - 12));
  const ids = new Set<string>();
  if (!Array.isArray(events) || events.length > 12) throw Error('Hasta 12 eventos por revisión.');
  const eventFrames = events.map(event => {
    const seconds=(event?.seconds??NaN)-exportStartSeconds;
    if (!event || typeof event.id !== 'string' || !event.id.trim() || ids.has(event.id) ||
        typeof event.seconds !== 'number' || !Number.isFinite(event.seconds) || seconds < 0 || seconds > duration)
      throw Error('Eventos de revisión inválidos, duplicados o fuera del video.');
    ids.add(event.id);
    const frame = closestFrame(frames, seconds);
    return { id: event.id, compositionSeconds:event.seconds, requestedSeconds: seconds, frames: frames.slice(Math.max(0, frame.index - 1), Math.min(frames.length, frame.index + 2)) };
  });
  return { contact, burst: frames.slice(start, start + 12),
    reading: times.map(t => ({ requestedSeconds: t, ...closestFrame(frames, t) })),
    eventFrames, exportStartSeconds, contactStepSeconds: duration / count, focusTime };
}
async function reviewFolder(root: string) {
  const candidate = join(root, 'reviews');
  // Check existing ancestors before mkdir: a junction must not receive writes outside the project.
  let ancestor = candidate;
  while (true) {
    try { if (!inside(root, await realpath(ancestor))) throw Error('La carpeta de revisión sale del proyecto.'); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      ancestor = dirname(ancestor);
    }
  }
  await mkdir(candidate, { recursive: true });
  const parent = await realpath(candidate);
  if (!inside(root, parent)) throw Error('La carpeta de revisión sale del proyecto.');
  const out = join(parent, 'motion-' + randomUUID());
  await mkdir(out); return out;
}
export async function motionReview(cwd: string, raw: unknown, search?: ToolSearch) {
  const args = raw as { source?: string; focusTime?: number; readingTimes?: number[]; events?: ReviewEvent[]; exportStartSeconds?:number; loop?: boolean; declaredCuts?: number[] };
  if (!args || typeof args.source !== 'string' || typeof args.focusTime !== 'number') throw Error('Se necesita export local y focusTime.');
  const root = await realpath(cwd), candidate = resolve(root, args.source);
  if (!inside(root, candidate)) throw Error('El export debe estar dentro del proyecto abierto.');
  const source = await realpath(candidate);
  if (!inside(root, source) || !(await stat(source)).isFile()) throw Error('El export debe ser un archivo del proyecto abierto.');
  const sha256 = await hashFile(source);
  const tools = search ?? { env: Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string')) };
  const ffmpeg = resolveLocalTool('ffmpeg', tools), ffprobe = resolveLocalTool('ffprobe', tools);
  if (!ffmpeg.path || !ffprobe.path) throw Error('Configurá FFmpeg y FFprobe locales para revisar el export.');
  // No ffmpeg inputs can be URLs. Only a canonical local file reaches either process.
  const probe = JSON.parse(await run(ffprobe.path, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', source]));
  const video = probe.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
  const duration = Number(video?.duration ?? probe.format?.duration);
  if (!video || !Number.isFinite(duration) || duration <= 0 || duration > 180 || video.width > 7680 || video.height > 7680)
    throw Error('Revisá un export de video de hasta 180 segundos y hasta 7680 px por lado.');
  const rawFrames = JSON.parse(await run(ffprobe.path, ['-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', source]));
  const origin = Number(rawFrames.frames?.[0]?.best_effort_timestamp_time);
  const frames: Frame[] = rawFrames.frames?.map((f: { best_effort_timestamp_time?: string }, index: number) => ({ index, seconds: Number(f.best_effort_timestamp_time) - origin })) ?? [];
  const plan = reviewPlan(frames, duration, args.focusTime, args.readingTimes, args.events,args.exportStartSeconds);
  if (args.loop !== undefined && typeof args.loop !== 'boolean') throw Error('loop debe ser booleano.');
  const cuts = args.declaredCuts ?? [];
  if (!Array.isArray(cuts) || cuts.length > 64 || cuts.some(t => typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t >= duration)) throw Error('Cortes declarados fuera del export.');
  const automaticChecks = await motionDiagnostics(ffmpeg.path, source, frames, args.loop, cuts);
  const snapshot: { file: string; sha256: string }[] = [];
  for (const file of ['index.tsx', 'package.json','motion-plan.json','production-prompt.md','design.md','frame.md','audio-plan.md','short-prompts.md','delivery-plan.md','launch-checklist.md']) {
    try {
      const path = await realpath(join(root, file));
      if (inside(root, path)) snapshot.push({ file, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  const out = await reviewFolder(root);
  const images: { kind: 'contact' | 'burst' | 'reading' | 'event'; path: string; width: number; frames: Frame[]; eventId?: string }[] = [];
  // Every label is drawn OUTSIDE the video picture; every n is the decoded video index.
  async function image(kind: 'contact' | 'burst' | 'reading' | 'event', selected: Frame[], width: number, cols: number, suffix: string, eventId?: string) {
    const height = Math.round(video.height * width / video.width);
    const label = "drawtext=text='n=%{eif\\:n\\:d}  pts=%{pts\\:hms}':x=6:y=h-23:fontsize=14:fontcolor=white";
    const pick = selected.map(f => `eq(n\\,${f.index})`).join('+');
    const path = join(out, `${kind}-${suffix}.png`);
    const filter = `scale=${width}:${height},pad=iw:ih+28:0:0:color=0x202020,${label},select='${pick}',tile=${cols}x${Math.ceil(selected.length / cols)}:nb_frames=${selected.length}:padding=4:margin=${kind === 'reading' ? 0 : 4}`;
    await run(ffmpeg.path!, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-n', '-i', source, '-map', '0:v:0', '-an', '-vf', filter, '-frames:v', '1', '-update', '1', path]);
    images.push({ kind, path, width, frames: selected, ...(eventId ? { eventId } : {}) });
  }
  const manifest = { version: 1, createdAt: new Date().toISOString(), source, sha256, duration,
    video: { width: video.width, height: video.height, frameRate: video.avg_frame_rate, decodedFrames: frames.length, firstPtsSeconds: origin },
    audioStreams: probe.streams.filter((s: { codec_type: string }) => s.codec_type === 'audio').length,
    sourceSnapshot: snapshot, exportRevisionVerified: false, plan, images,
    limitations: ['Imágenes del export existente; no certifican su correspondencia con la fuente actual.',
      '360 px es una prueba de lectura; no es una adaptación vertical.',
      'focusTime fue elegido por quien llamó; no se detectó automáticamente el movimiento más rápido.',
      'La repetición de un cuadro decodificado no prueba seek determinista del motor.',
      'Revisar movimiento a velocidad normal y escuchar el audio si lo hay. No se asignó una nota estética.'],
    automaticChecks, status: 'building' as string };
  const manifestPath = join(out, 'manifest.json');
  try {
    for (let n = 0; n < plan.contact.length; n += 12) await image('contact', plan.contact.slice(n, n + 12), 320, 6, String(n / 12 + 1));
    await image('burst', plan.burst, 320, 6, '1');
    for (const [n, frame] of plan.reading.entries()) await image('reading', [frame], 360, 1, String(n + 1));
    for (const [n, event] of plan.eventFrames.entries()) await image('event', event.frames, 360, event.frames.length, String(n + 1), event.id);
    if (await hashFile(source) !== sha256) throw Error('El export cambió durante la revisión; generá evidencia nuevamente.');
    manifest.status = 'complete';
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    const reportPath = join(out, 'review.md');
    await writeFile(reportPath, `# Revisión visual pendiente\n\nExport: ${source}\nSHA-256: ${sha256}\n\n` +
      '## Diagnóstico automático\n\n' + JSON.stringify(automaticChecks, null, 2) + '\n\n' +
      images.map(i => `- ${i.kind}: ${i.path}`).join('\n') +
      '\n\nAbrí las imágenes y mirá el video a velocidad normal. Para hasta tres defectos de mayor impacto, registrá tiempo/cuadro, región o Key, qué se observa, corrección local y evidencia después. Una pausa de lectura es intencional si permite entender el contenido; no agregues movimiento por llenar tiempo.\n\n' +
      manifest.limitations.map(s => `- ${s}`).join('\n') + '\n', { flag: 'wx' });
    return { folder: out, manifestPath, reportPath, source, sha256, video: manifest.video, duration,
      audioStreams: manifest.audioStreams, automaticChecks, images, sourceSnapshot: snapshot, exportRevisionVerified: false,
      note: 'Evidencia generada. Abrí las imágenes; revisión visual, reproducción y audio siguen pendientes.' };
  } catch (error) {
    manifest.status = 'failed';
    await writeFile(manifestPath, JSON.stringify({ ...manifest, error: (error as Error).message }, null, 2) + '\n', { flag: 'wx' }).catch(() => {});
    throw error;
  }
}

/** Bounded originals for provider vision and native chat previews; never enlarge the 360px test. */
export async function motionReviewPreviews(result: Awaited<ReturnType<typeof motionReview>>): Promise<ToolImage[]> {
  const chosen = [result.images.find(i => i.kind === 'contact'), result.images.find(i => i.kind === 'burst'),
    ...result.images.filter(i => i.kind === 'reading').slice(0, 2), ...result.images.filter(i => i.kind === 'event').slice(0, 2)].filter(i => i !== undefined);
  const images: ToolImage[] = [];
  for (const entry of chosen) {
    const size = (await stat(entry.path)).size;
    if (Math.ceil(size / 3) * 4 > 512 * 1024) continue;
    images.push({ mediaType: 'image/png', data: (await readFile(entry.path)).toString('base64') });
  }
  return images;
}
