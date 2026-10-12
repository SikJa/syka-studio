import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, realpath, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { killTree } from '../../../../packages/agent-chat/src/host/env';
import { videoDownloadError } from '../../../../packages/agent-chat/src/host/video-download-error';
import { parseVideoToolJson, VideoToolOutput, YTDLP_METADATA_ARGS, YTDLP_FFMPEG_NETWORK_ARGS, youtubeSectionFormat } from '../../../../packages/agent-chat/src/host/yt-dlp';
import { addStorageJobOwner, createStorageJob, finishStorageJob, settleStorageOwners } from '../../../../packages/agent-chat/src/host/storage-ledger';
import { validateVideoRange, youtubeUrl, type VideoImportJob, type VideoImportMetadata, type VideoImportRange, type VideoImportResult } from './types';

type Command = { command: string; prefix?: string[] };
type Options = {
  onFinished?: (job: VideoImportJob, projectDir: string) => void;
  runtimeDir: string; ytDlp: () => Command | undefined; ffmpeg: () => string | undefined;
  ffprobe: () => Command | undefined; node?: () => string | undefined; env?: NodeJS.ProcessEnv | (() => NodeJS.ProcessEnv);
  validateProject(dir: string): Promise<void>;
  integrate(result: VideoImportResult, metadata: VideoImportMetadata, seedTimeline: boolean): Promise<boolean>;
};
type Internal = { job: VideoImportJob; child?: ChildProcess; cancelled: boolean; task?: Promise<void>; stage?: string; projectDir?: string };
const SAFE_BASE = ['--encoding', 'utf-8', '--ignore-config', '--no-plugin-dirs', '--no-remote-components', '--no-playlist', '--no-warnings', '--no-cache-dir', '--socket-timeout', '20', '--retries', '2', '--fragment-retries', '2'];
const terminal = new Set(['done', 'cancelled', 'error']);

async function stopChild(child: ChildProcess): Promise<void> {
  if (process.platform === 'win32') return killTree(child);
  if (!child.pid || child.exitCode !== null) return;
  // The downloader owns this detached process group, including its FFmpeg child.
  const exited = new Promise<void>(done => child.once('close', () => done()));
  try { process.kill(-child.pid, 'SIGTERM'); } catch { return; }
  await Promise.race([exited, new Promise<void>(done => { const timer = setTimeout(done, 1500); timer.unref(); })]);
  try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Group has already exited. */ }
}

export function normalizeVideoMetadata(value: unknown, sourceUrl: string): VideoImportMetadata {
  const v = value as Record<string, unknown>;
  if (!v || typeof v !== 'object' || v._type === 'playlist' || !/^[A-Za-z0-9_-]{11}$/.test(String(v.id))) throw Error('El enlace no corresponde a un video individual de YouTube.');
  if (youtubeUrl(`https://www.youtube.com/watch?v=${String(v.id)}`) !== sourceUrl) throw Error('El video devuelto no coincide con el enlace solicitado.');
  const duration = typeof v.duration === 'number' && Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null;
  const liveStatus = v.is_live === true || v.live_status === 'is_live' ? 'live' : v.live_status === 'is_upcoming' ? 'upcoming'
    : v.live_status === 'post_live' ? 'processing' : v.was_live === true || v.live_status === 'was_live' ? 'archive' : 'video';
  const chapters = Array.isArray(v.chapters) ? v.chapters.flatMap((c: any) => typeof c.start_time === 'number' && typeof c.end_time === 'number' && c.start_time >= 0 && c.end_time > c.start_time ? [{ title: String(c.title || 'Capítulo').slice(0, 180), start: c.start_time, end: c.end_time }] : []).slice(0, 200) : [];
  const thumbnail = typeof v.thumbnail === 'string' && /^https:\/\/(?:i|img)\.(?:ytimg\.com|youtube\.com)\//.test(v.thumbnail) ? v.thumbnail : undefined;
  return { id: String(v.id), sourceUrl, title: String(v.title || 'Video de YouTube').slice(0, 250), channel: String(v.channel || v.uploader || '').slice(0, 150), duration, liveStatus, thumbnail, chapters, requiresRange: duration === null || duration > 1800 || liveStatus === 'archive' };
}

export class VideoImportService {
  private jobs = new Map<string, Internal>();
  private options: Options;
  constructor(options: Options) { this.options = options; }
  active(): boolean { return [...this.jobs.values()].some(item => !terminal.has(item.job.state) && item.job.state !== 'ready'); }
  inspect(url: string): VideoImportJob {
    const canonical = youtubeUrl(url);
    if (!canonical) throw Error('Pegá el enlace de un video de YouTube (watch, Shorts o un directo terminado).');
    for (const item of this.jobs.values()) if (item.job.url === canonical && !terminal.has(item.job.state)) return this.snapshot(item);
    if ([...this.jobs.values()].filter(i => !terminal.has(i.job.state) && i.job.state !== 'ready').length >= 2) throw Error('Hay dos importaciones en curso. Esperá o cancelá una.');
    // Old completed inspections are disposable; downloaded files live in their projects.
    if (this.jobs.size > 100) for (const [id, item] of this.jobs) if (terminal.has(item.job.state) || item.job.state === 'ready') { this.jobs.delete(id); if (this.jobs.size <= 80) break; }
    const item: Internal = { job: { id: randomUUID(), url: canonical, state: 'inspecting', message: 'Leyendo el video…' }, cancelled: false };
    this.jobs.set(item.job.id, item);
    item.task = this.inspectRun(item);
    return this.snapshot(item);
  }
  status(id: string): VideoImportJob { return this.snapshot(this.get(id)); }
  async cancel(id: string): Promise<VideoImportJob> {
    const item = this.get(id);
    if (terminal.has(item.job.state)) return this.snapshot(item);
    // Finalization is a small local transaction; don't report cancelled after publishing its bytes.
    if (item.job.state === 'finalizing') return this.snapshot(item);
    item.cancelled = true;
    if (item.child) await stopChild(item.child);
    await item.task;
    item.job.state = 'cancelled'; item.job.message = 'Importación cancelada';
    return this.snapshot(item);
  }
  async start(id: string, projectDir: string, range?: VideoImportRange, seedTimeline = false): Promise<VideoImportJob> {
    const item = this.get(id);
    if (item.job.state !== 'ready' || !item.job.metadata) throw Error('Primero esperá a que se lea el video.');
    if ([...this.jobs.values()].filter(other => ['downloading', 'finalizing'].includes(other.job.state)).length >= 2) throw Error('Hay dos descargas en curso. Esperá o cancelá una.');
    const selected = validateVideoRange(item.job.metadata, range);
    if (!isAbsolute(projectDir)) throw Error('El proyecto necesita una carpeta local.');
    // Change state synchronously to reject double-clicks before asynchronous project checks.
    item.job.state = 'downloading'; item.job.message = 'Preparando la descarga…';
    item.projectDir = projectDir;
    item.task = this.downloadRun(item, projectDir, selected, seedTimeline);
    return this.snapshot(item);
  }
  private get(id: string): Internal { const item = this.jobs.get(id); if (!item) throw Error('Esta importación ya no está activa. Volvé a pegar el enlace.'); return item; }
  private snapshot(item: Internal): VideoImportJob { return structuredClone(item.job); }
  private check(item: Internal): void { if (item.cancelled) throw Error('Importación cancelada'); }
  private downloaderBase(): string[] { const node = this.options.node?.(); return [...SAFE_BASE, ...(node ? ['--js-runtimes', `node:${node}`] : [])]; }
  private fail(item: Internal, error: unknown): void {
    item.job.state = item.cancelled ? 'cancelled' : 'error';
    const raw = error instanceof Error ? error.message : String(error);
    const message = videoDownloadError(raw, 700);
    item.job.message = item.cancelled ? 'Importación cancelada' : 'No se pudo importar el video';
    if (!item.cancelled) item.job.error = message;
    if (!item.cancelled && item.projectDir) this.finished(item);
  }
  private finished(item: Internal): void {
    if (!item.projectDir) return;
    try { this.options.onFinished?.(this.snapshot(item), item.projectDir); }
    catch { /* A notice cannot change the import transaction. */ }
  }
  private async inspectRun(item: Internal): Promise<void> {
    try {
      const tool = this.options.ytDlp();
      if (!tool) throw Error('Falta yt-dlp. Instalalo y reiniciá Syka: Windows: winget install yt-dlp.yt-dlp · Mac: brew install yt-dlp ffmpeg.');
      const output = await this.run(item, tool, [...this.downloaderBase(), ...YTDLP_METADATA_ARGS, '--', item.job.url], 90_000);
      this.check(item);
      item.job.metadata = normalizeVideoMetadata(parseVideoToolJson(output, 'metadata'), item.job.url);
      item.job.state = 'ready'; item.job.message = 'Video listo para importar';
    } catch (error) { this.fail(item, error); }
  }
  private async safeDir(root: string, ...parts: string[]): Promise<string> {
    const base = await realpath(root), target = resolve(base, ...parts);
    const rel = relative(base, target);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('Destino de importación inválido.');
    await mkdir(target, { recursive: true });
    const actual = await realpath(target), actualRel = relative(base, actual);
    if (!actualRel || actualRel === '..' || actualRel.startsWith('..' + sep) || isAbsolute(actualRel)) throw Error('La carpeta de importación sale del proyecto.');
    return actual;
  }
  private async downloadRun(item: Internal, projectDir: string, range: VideoImportRange, seed: boolean): Promise<void> {
    try {
      await this.options.validateProject(projectDir); this.check(item);
      const tool = this.options.ytDlp(), ffmpeg = this.options.ffmpeg(), probe = this.options.ffprobe();
      if (!tool || !ffmpeg || !probe) throw Error('Necesitás yt-dlp, FFmpeg y FFprobe instalados para importar videos.');
      const metadata = item.job.metadata!;
      await mkdir(this.options.runtimeDir, { recursive: true });
      const stage = await this.safeDir(this.options.runtimeDir, 'video-imports', item.job.id); item.stage = stage;
      await createStorageJob(this.options.runtimeDir, { id: item.job.id, kind: 'video-import', base: await realpath(this.options.runtimeDir), path: stage });
      const isRange = range.start > 0 || metadata.duration === null || range.end < metadata.duration - 0.05;
      const normalFormat = 'bv*[height<=1080][vcodec^=avc1]+ba[ext=m4a]/b[height<=1080][vcodec^=avc1][ext=mp4]';
      const args = [...this.downloaderBase(), ...YTDLP_FFMPEG_NETWORK_ARGS, '--newline', '--no-simulate', '--no-overwrites', '--max-filesize', '2G', '--concurrent-fragments', '1', '--ffmpeg-location', ffmpeg,
        '-f', isRange ? youtubeSectionFormat(normalFormat) : normalFormat, '--merge-output-format', 'mp4', '--remux-video', 'mp4',
        '--progress-template', 'download:SYKA_PROGRESS:%(progress._percent_str)s', '-o', join(stage, 'video.%(ext)s'),
        ...(isRange ? ['--download-sections', `*${range.start}-${range.end}`, '--force-keyframes-at-cuts'] : []), '--', item.job.url];
      item.job.message = isRange ? 'Descargando el intervalo elegido…' : 'Descargando el video…';
      await this.run(item, tool, args, 45 * 60_000, line => {
        const match = /SYKA_PROGRESS:\s*([\d.]+)%/.exec(line);
        if (match) item.job.percent = Math.max(0, Math.min(99, Number(match[1])));
        if (/\[(?:Merger|VideoRemuxer|VideoConvertor|Fixup)/.test(line)) item.job.message = 'Preparando el archivo para editar…';
      });
      this.check(item);
      const downloaded = join(stage, 'video.mp4');
      const info = await stat(downloaded);
      if (!info.isFile() || info.size < 100 || info.size > 2 * 1024 ** 3) throw Error('El archivo descargado está vacío o supera 2 GB. Elegí un tramo más corto.');
      const data = parseVideoToolJson(await this.run(item, probe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', downloaded], 30_000), 'probe');
      const video = data.streams?.find((s: any) => s.codec_type === 'video');
      const audio = data.streams?.find((s: any) => s.codec_type === 'audio');
      const duration = Number(data.format?.duration);
      if (!video || !Number.isFinite(duration) || duration <= 0 || Math.abs(duration - (range.end - range.start)) > 1.5) throw Error('La duración descargada no coincide con el tramo elegido. No se importó el archivo.');
      if (!Number.isInteger(video.width) || !Number.isInteger(video.height) || video.width <= 0 || video.height <= 0) throw Error('No se pudo leer el tamaño del video descargado.');
      const [fpsNum, fpsDen = 1] = String(video.avg_frame_rate || video.r_frame_rate || '30/1').split('/').map(Number);
      const fps = fpsNum / fpsDen;
      this.check(item);
      item.job.state = 'finalizing'; item.job.message = 'Guardando el video en tu proyecto…';
      const folder = await this.safeDir(projectDir, 'assets', 'imported');
      const records = await this.safeDir(projectDir, '.syka', 'imports');
      const path = join(folder, `${metadata.id}-${item.job.id}.mp4`);
      const provenancePath = join(records, `${item.job.id}.json`);
      const result: VideoImportResult = { path, relativePath: relative(projectDir, path).split(sep).join('/'), provenancePath, projectDir, duration, width: video.width, height: video.height, frameRate: Number.isFinite(fps) && fps > 0 ? fps : 30, bitRate: Number(video.bit_rate) || 0, ...(audio ? { sampleRate: Number(audio.sample_rate) || 48000, channels: Number(audio.channels) || 2 } : {}), sourceUrl: metadata.sourceUrl, sourceRange: range, timelineCreated: false };
      const pendingMedia = join(folder, `.syka-import-${item.job.id}.tmp`);
      try {
        await copyFile(downloaded, pendingMedia, constants.COPYFILE_EXCL);
        await rename(pendingMedia, path);
      } finally { await unlink(pendingMedia).catch(() => {}); }
      // No stream URLs, cookies, tokens, or raw yt-dlp metadata are persisted.
      const provenance = { version: 1, importedAt: new Date().toISOString(), ...result, metadata, transcription: { state: 'not-requested' }, timeMap: { localStartSeconds: 0, sourceStartSeconds: range.start, requestedSourceEndSeconds: range.end, localDurationSeconds: duration } };
      await writeFile(provenancePath, JSON.stringify(provenance, null, 2), { flag: 'wx' });
      result.timelineCreated = await this.options.integrate(result, metadata, seed);
      const pendingOrigin = `${provenancePath}.tmp-${randomUUID()}`;
      try {
        await writeFile(pendingOrigin, JSON.stringify({ ...provenance, timelineCreated: result.timelineCreated }, null, 2), {flag:'wx'});
        await rename(pendingOrigin, provenancePath);
      } finally { await unlink(pendingOrigin).catch(() => {}); }
      item.job.result = result; item.job.percent = 100; item.job.state = 'done'; item.job.message = 'Video importado';
      this.finished(item);
    } catch (error) { this.fail(item, error); }
    finally {
      if (item.stage) {
        try {
          const expected = resolve(await realpath(this.options.runtimeDir), 'video-imports', item.job.id);
          if (resolve(item.stage) === expected && /^[0-9a-f-]{36}$/.test(item.job.id)) await rm(expected, { recursive: true, force: true });
        } catch { /* Cleanup failure must not turn a saved video into an unhandled rejection. */ }
      }
      await settleStorageOwners(this.options.runtimeDir, item.job.id);
      await finishStorageJob(this.options.runtimeDir, item.job.id);
    }
  }
  private run(item: Internal, tool: Command, args: string[], timeout: number, onLine?: (line: string) => void): Promise<string> {
    this.check(item);
    return new Promise((done, reject) => {
      const child = spawn(tool.command, [...(tool.prefix ?? []), ...args], { env: typeof this.options.env === 'function' ? this.options.env() : this.options.env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], shell: false });
      item.child = child; const out = new VideoToolOutput(!onLine); let err = '', settled = false, timedOut = false;
      if (item.stage) void addStorageJobOwner(this.options.runtimeDir, item.job.id, child.pid).catch(() => {});
      let diskError = '', measuring = false;
      const quota = item.stage ? setInterval(async () => {
        if (measuring || settled) return; measuring = true;
        try {
          const sizes = await Promise.all((await readdir(item.stage!)).map(name => stat(join(item.stage!, name)).then(s => s.size).catch(() => 0)));
          if (sizes.reduce((a, b) => a + b, 0) > 2 * 1024 ** 3) { diskError = 'El tramo supera 2 GB. Elegí un intervalo más corto.'; await stopChild(child); }
        } catch { /* A removed staging directory is handled by the command result. */ }
        finally { measuring = false; }
      }, 1000) : undefined;
      const timer = setTimeout(() => { timedOut = true; void stopChild(child); }, timeout);
      const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); clearInterval(quota); if (item.child === child) item.child = undefined; if (error) { reject(error); return; } try { done(out.read()); } catch (error) { reject(error); } };
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => { const text = String(chunk); out.append(text); onLine?.(text); });
      child.stderr.on('data', chunk => { const text = chunk.toString(); err = (err + text).slice(-16_000); onLine?.(text); });
      child.on('error', e => finish(e));
      child.on('close', code => finish(item.cancelled ? Error('Importación cancelada') : diskError ? Error(diskError) : timedOut ? Error('La descarga tardó demasiado. Probá con un intervalo más corto.') : code !== 0 ? Error(err.trim() || `El descargador terminó con código ${code}.`) : undefined));
    });
  }
}
