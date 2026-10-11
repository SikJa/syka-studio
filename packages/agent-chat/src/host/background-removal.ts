import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, realpath, rename, writeFile, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export type BackgroundRequest = { action: 'start' | 'status' | 'cancel'; projectDir: string; id?: string; source?: string; start?: number; end?: number; separate?: boolean; quality?: 'balanced' | 'best' };
export type BackgroundJob = { id: string; projectDir: string; source: string; state: 'preparing' | 'processing' | 'done' | 'canceled' | 'error'; progress: number; message: string; start: number; end?: number; separate: boolean; subject?: string; background?: string; subjectFrames?: string; backgroundFrames?: string; frameRate?: number; provider?: string; error?: string; createdAt: string };
export const BACKGROUND_TOOL = { type: 'function', name: 'syka_remove_background', description: 'Remove the background of a HUMAN portrait/video locally, or separate foreground and inverse-alpha background into portable PNG/WebM files. The background has a person-shaped transparent hole, NOT inpainting. Original media is unchanged. Source must be copied inside the open project first (assets copy:true). For video supply source-time start/end, maximum 30 seconds per job; use only the clip span, not a whole livestream. Start returns a job; poll status with id; cancel stops processing. Successful result has project-relative subject/background paths. For native Diffusion video layers use subjectFrames/backgroundFrames PNG sequences with returned frameRate, sourceIn:0 and sourceOut:end-start; WebM alpha is not reliable in native WebCodecs. Preserve one independent original audio layer with its trim and playback rate; do not duplicate audio. Inspect edges before editing the composition using reversible source tools.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['start', 'status', 'cancel'] }, id: { type: 'string' }, source: { type: 'string' }, start: { type: 'number', minimum: 0 }, end: { type: 'number', exclusiveMinimum: 0 }, separate: { type: 'boolean' }, quality: { type: 'string', enum: ['balanced', 'best'] } }, required: ['action'], additionalProperties: false } };
const inside = (root: string, path: string) => { const rel = relative(root, path); return rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel); };
const terminal = (job: BackgroundJob) => ['done', 'canceled', 'error'].includes(job.state);

/** Long jobs return promptly; artifacts and final status survive closing the app. */
export class BackgroundRemovalService {
  private jobs = new Map<string, { job: BackgroundJob; child?: ChildProcess }>();
  private runtime: { node: string; runner: string; modules: string; env?: NodeJS.ProcessEnv };
  constructor(runtime: { node: string; runner: string; modules: string; env?: NodeJS.ProcessEnv }) { this.runtime = runtime; }
  dispose() {
    for (const { child, job } of this.jobs.values()) if (child?.pid && !terminal(job)) {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => child.kill());
      else { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); } }
    }
  }
  private file(root: string, id: string) { if (!/^[a-f0-9-]{36}$/.test(id)) throw Error('Trabajo inválido.'); return join(root, '.syka', 'background-removal', id + '.json'); }
  private async save(job: BackgroundJob) { const path = this.file(job.projectDir, job.id); await mkdir(dirname(path), { recursive: true }); if (!inside(job.projectDir, await realpath(dirname(path)))) throw Error('El registro de recortes está fuera del proyecto.'); const tmp = path + '.' + randomUUID() + '.tmp'; await writeFile(tmp, JSON.stringify(job, null, 2)); await rename(tmp, path); }
  async call(request: BackgroundRequest): Promise<BackgroundJob> {
    if (!['start', 'status', 'cancel'].includes(request.action)) throw Error('Acción de recorte inválida.');
    if (request.separate !== undefined && typeof request.separate !== 'boolean') throw Error('Separar capas debe ser verdadero o falso.');
    const root = await realpath(request.projectDir);
    if (request.action !== 'start') {
      const id = request.id ?? ''; const file = this.file(root, id);
      const item = this.jobs.get(id);
      if (item && item.job.projectDir !== root) throw Error('Este trabajo pertenece a otro proyecto.');
      if (!item && !inside(root, await realpath(file))) throw Error('El registro de recortes está fuera del proyecto.');
      const job: BackgroundJob = item?.job ?? JSON.parse(await readFile(file, 'utf8'));
      if (job.id !== id || job.projectDir !== root) throw Error('El registro no pertenece a este proyecto.');
      if (!item && !terminal(job)) { job.state = 'error'; job.error = 'El procesamiento se interrumpió al cerrar Syka. Volvé a iniciarlo.'; await this.save(job); }
      if (request.action === 'cancel' && item && !terminal(job)) {
        job.state = 'canceled'; job.message = 'Cancelado; el original sigue intacto.';
        const pid = item.child?.pid;
        if (pid) { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }).on('error', () => item.child?.kill()); else { try { process.kill(-pid, 'SIGTERM'); } catch { item.child?.kill(); } } }
        await this.save(job);
      }
      return { ...job };
    }
    if ([...this.jobs.values()].some(item => !terminal(item.job))) throw Error('Ya hay un recorte en proceso. Esperá o cancelalo antes de iniciar otro.');
    if (!existsSync(this.runtime.runner) || !existsSync(join(this.runtime.modules, 'hyperframes', 'bin', 'hyperframes.mjs')) || !existsSync(join(this.runtime.modules, 'onnxruntime-node'))) throw Error('Falta el motor local de recorte. Ejecutá npm run setup:background en la instalación de Syka.');
    if (typeof request.source !== 'string' || !request.source || /\0|^https?:/i.test(request.source)) throw Error('Elegí una imagen o un video local del proyecto.');
    const input = await realpath(resolve(root, request.source));
    if (!inside(root, input)) throw Error('Copiá el recurso al proyecto antes de quitar el fondo.');
    const kind = ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(input).toLowerCase()) ? 'image' : ['.mp4', '.mov', '.webm', '.mkv'].includes(extname(input).toLowerCase()) ? 'video' : null;
    if (!kind || !(await stat(input)).isFile()) throw Error('Formato no compatible. Usá PNG, JPG, WebP, MP4, MOV, WebM o MKV.');
    const start = request.start ?? 0, end = request.end;
    if (!Number.isFinite(start) || start < 0 || (kind === 'video' && (!Number.isFinite(end) || end! <= start || end! - start > 30))) throw Error('Elegí un tramo de video entre 0 y 30 segundos.');
    if (request.quality !== undefined && !['balanced', 'best'].includes(request.quality)) throw Error('Calidad inválida.');
    const id = randomUUID(); const folder = join(root, 'assets', 'Recortes', id);
    await mkdir(folder, { recursive: true });
    // Reject project assets junctions before spawning a process that writes there.
    if (!inside(root, await realpath(folder))) throw Error('La carpeta de salida está fuera del proyecto.');
    const job: BackgroundJob = { id, projectDir: root, source: relative(root, input).split(sep).join('/'), state: 'preparing', progress: 0, message: 'Preparando el motor local…', start, end, separate: request.separate ?? false, createdAt: new Date().toISOString() };
    const item: { job: BackgroundJob; child?: ChildProcess } = { job }; this.jobs.set(id, item); await this.save(job);
    const config = { inputPath: input, folder, kind, start, end, separate: job.separate, quality: request.quality ?? 'best' };
    let buffer = '', stderr = '', saving = Promise.resolve();
    const persist = () => { const snapshot = { ...job }; saving = saving.catch(() => {}).then(() => this.save(snapshot)); };
    try {
      const child = spawn(this.runtime.node, [this.runtime.runner, this.runtime.modules, JSON.stringify(config)], { env: { ...(this.runtime.env ?? process.env), ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' }); item.child = child;
      child.stdout!.on('data', bytes => {
        buffer += bytes.toString(); if (buffer.length > 100_000) buffer = buffer.slice(-100_000);
        let split; while ((split = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, split); buffer = buffer.slice(split + 1);
          if (terminal(job)) continue;
          try { const event = JSON.parse(line); if (event.kind === 'frame') { job.state = 'processing'; job.progress = Math.min(99, Math.round(100 * event.index / Math.max(1, event.total))); job.message = `Recortando · ${job.progress}%`; }
            if (event.kind === 'info') job.message = /download/i.test(event.message) ? 'Descargando el modelo local (168 MB, sólo la primera vez)…' : /layers/i.test(event.message) ? 'Preparando capas transparentes para el editor…' : 'Preparando el modelo de personas…';
            if (event.kind === 'result') { job.subject = relative(root, event.subject).split(sep).join('/'); job.background = event.background ? relative(root, event.background).split(sep).join('/') : undefined; job.subjectFrames = event.subjectFrames ? relative(root, event.subjectFrames).split(sep).join('/') : undefined; job.backgroundFrames = event.backgroundFrames ? relative(root, event.backgroundFrames).split(sep).join('/') : undefined; job.frameRate = event.frameRate; job.provider = event.provider; }
          } catch { /* Only NDJSON events affect the job. */ }
        }
      });
      child.stderr!.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-3000); });
      const timeout = setTimeout(() => { if (!terminal(job)) { job.error = 'El recorte superó 30 minutos. Probá un tramo más corto.'; void this.call({ action: 'cancel', projectDir: root, id }); } }, 30 * 60_000); timeout.unref();
      const finish = async (error?: string) => { clearTimeout(timeout); if (!terminal(job)) { job.state = error || !job.subject ? 'error' : 'done'; job.error = error || (!job.subject ? 'El motor no generó un resultado.' : undefined); job.progress = job.state === 'done' ? 100 : job.progress; job.message = job.state === 'done' ? 'Listo. Revisá los bordes antes de aplicar.' : 'No se pudo quitar el fondo.'; } persist(); await saving; };
      child.on('error', error => void finish(error.message)); child.on('close', code => void finish(code === 0 ? undefined : stderr || `El motor terminó con código ${code}.`));
    } catch (error) { job.state = 'error'; job.error = (error as Error).message; await this.save(job); }
    return { ...job };
  }
}

let shared: BackgroundRemovalService | undefined;
export function backgroundRemovalService() {
  if (!shared) { shared = new BackgroundRemovalService({ node: process.env.SYKA_BACKGROUND_NODE || process.execPath, runner: process.env.SYKA_BACKGROUND_RUNNER || '', modules: process.env.SYKA_BACKGROUND_MODULES || '', env: process.env }); process.once('exit', () => shared?.dispose()); }
  return shared;
}
