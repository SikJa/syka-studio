import { mkdir, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomInt, randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';

export const MUSIC_CREATE_TOOL = {
  type: 'function', name: 'syka_music_create',
  description: 'Last resort for music: use only when the user asked for an original composition, or after syka_mixkit search found no fitting track (say which categories you tried). Composes a genuinely new LOCAL instrumental bed (4–60 seconds) and separate WAV stems inside the project, using original procedural synthesis without network, paid services or model installation. Varies harmony, motif and rhythmic arrangement; avoids recently used harmony families. Supports soft synthesized keys/plucks/pads and electronic percussion, not realistic orchestral performances, vocals or arbitrary text-to-music. When those are needed or the user dislikes synthesis, ASK for an authorized source/provider; never silently reuse a recent stock bed. Returns files and composition metadata, not a timeline insertion or listening approval.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {
    style: { type: 'string', enum: ['editorial','ambient','pulse','lofi','cinematic','bright'] },
    duration: { type: 'number', minimum: 4, maximum: 60 }, bpm: { type: 'number', minimum: 40, maximum: 180 },
    seed: { type: 'integer', minimum: 0, maximum: 4294967295 }, loop: { type: 'boolean' },
  }, required: ['style','duration'] },
};
const within = (root: string, path: string) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep); };
export async function createMusic(cwd: string, docs: string | undefined, raw: unknown, avoidFamilies: string[], jobs = new Set<Worker>(), signal?: AbortSignal) {
  signal?.throwIfAborted();
  const args = raw as { style?: string; duration?: number; bpm?: number; seed?: number; loop?: boolean };
  if (!args || Object.keys(args).some(key => !['style','duration','bpm','seed','loop'].includes(key)) || !['editorial','ambient','pulse','lofi','cinematic','bright'].includes(args.style!) || !Number.isFinite(args.duration) || args.duration! < 4 || args.duration! > 60 || args.bpm !== undefined && (!Number.isFinite(args.bpm) || args.bpm < 40 || args.bpm > 180) || args.seed !== undefined && (!Number.isInteger(args.seed) || args.seed < 0 || args.seed > 4294967295) || args.loop !== undefined && typeof args.loop !== 'boolean') throw Error('Elegí un estilo válido, 4–60 segundos y parámetros musicales válidos.');
  if (!docs) throw Error('El generador local no está disponible. Preguntale al usuario por una fuente o proveedor; no repitas una base como fallback.');
  const script = join(await realpath(docs), 'skills/syka-local-audio/scripts/audio-studio.mjs');
  const scriptPath = await realpath(script);
  if (!within(await realpath(docs), scriptPath)) throw Error('Generador fuera de los recursos de Syka.');
  const root = await realpath(cwd), folder = join(root, '03 Assets reutilizables', 'Audio', 'Musica creada');
  let ancestor = folder;
  while (true) {
    try { if (!within(root, await realpath(ancestor))) throw Error('La carpeta de música sale del proyecto.'); break; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; ancestor = dirname(ancestor); }
  }
  await mkdir(folder, { recursive: true });
  if (!within(root, await realpath(folder))) throw Error('La carpeta de música sale del proyecto.');
  const seed = args.seed ?? randomInt(0, 4294967296), path = join(folder, `musica-${args.style}-${randomUUID()}.wav`);
  type Created = { state:'created'; path:string; duration:number; stems:string[]; peakDb:number; clippedSamples:number; composition:{compositionFamily:string;compositionId:string} };
  const workerPath = await realpath(join(dirname(scriptPath), 'music-worker.mjs'));
  if (!within(await realpath(docs), workerPath)) throw Error('Worker fuera de los recursos de Syka.');
  signal?.throwIfAborted();
  const worker = new Worker(pathToFileURL(workerPath), { workerData: { path, avoidFamilies, options: { style: args.style, duration: args.duration, bpm: args.bpm, seed, loop: Boolean(args.loop), avoidFamilies, peakDb: -9 } }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
  jobs.add(worker);
  const abort = () => { void worker.terminate(); };
  signal?.addEventListener('abort',abort,{once:true});
  const output = await new Promise<Created | {state:'needs_direction';reason:string}>((resolve, reject) => {
    let received = false;
    const timer = setTimeout(() => { void worker.terminate(); reject(Error('La composición superó dos minutos; elegí un tramo más corto.')); }, 120_000);
    worker.once('message', result => { received = true; clearTimeout(timer); result.state === 'error' ? reject(Error(result.message)) : resolve(result); });
    worker.once('error', error => { clearTimeout(timer); reject(error); });
    worker.once('exit', () => { clearTimeout(timer); if (!received) reject(Error('La composición se canceló antes de terminar.')); });
  }).finally(async () => { signal?.removeEventListener('abort',abort); jobs.delete(worker); await worker.terminate(); });
  signal?.throwIfAborted();
  if (output.state === 'needs_direction') return output;
  if (!(await stat(path)).isFile()) throw Error('No se pudo guardar la composición.');
  return { ...output, seed, relativePath: relative(root, path), evidence: 'New original procedural composition and stems; no external call. Inspect/listen in context and insert native audio nodes. Not a claim of realistic instruments or artistic approval.' };
}
