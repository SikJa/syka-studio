import { isPackagedBuild } from './app-mode';
import { app, protocol } from 'electron';
import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, realpath, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import { MAIN_CHANNELS } from './main-channels';
import type { mainBridge } from './main-manager';
import { localToolPath } from './syka-dependencies';
import { selectScreenRegion } from './screen-region-selector';
import { moveToStorageTrash } from '../../../packages/agent-chat/src/host/storage-ledger';

export type ScreenAudioMode = 'none' | 'system' | 'microphone' | 'both';
export type ScreenRegion = { x: number; y: number; width: number; height: number };
export type ScreenSource = { id: string; name: string; thumbnail: string; kind: 'screen'; bounds: ScreenRegion };
export type ScreenRecording = { id: string; path: string; microphonePath: string | null; previewUrl: string; duration: number; width: number; height: number; size: number };
export type ScreenCaptureStatus = { phase: string; seconds: number; path: string; microphone: string; error: string };
export type ScreenCaptureRequest =
  | { action: 'list' }
  | { action: 'select-region'; sourceId: string }
  | { action: 'cancel-selection' }
  | { action: 'start'; sourceId: string; audio: ScreenAudioMode; projectDir: string; region?: ScreenRegion }
  | { action: 'pause' | 'resume' | 'stop' | 'status' | 'cancel' | 'microphone'; id?: string };
export type ScreenCaptureSources = { sources: ScreenSource[]; systemAudio: boolean; selectedRegion?: ScreenRegion | null; status?: ScreenCaptureStatus; recording?: ScreenRecording; audio?: Uint8Array };
type NativeSession = { id: string; owner: number; child: ChildProcessWithoutNullStreams; dir: string; root: string; region: ScreenRegion; state: ScreenCaptureStatus; recording?: ScreenRecording };
const terminal = (phase: string) => ['complete', 'cancelled', 'error'].includes(phase);
const run = promisify(execFile);
let captureBusy = () => false;
export function hasActiveScreenCaptures(): boolean { return captureBusy(); }

/** Translate a thumbnail crop into physical pixels, including negative monitor origins. */
export function physicalCaptureRegion(bounds: ScreenRegion, crop?: ScreenRegion): ScreenRegion {
  if (!crop) return { ...bounds };
  if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 1.00001 || crop.y + crop.height > 1.00001) throw new Error('El área debe quedar dentro de la pantalla.');
  const x = Math.floor(crop.x * bounds.width), y = Math.floor(crop.y * bounds.height);
  const width = Math.min(bounds.width - x, Math.floor(crop.width * bounds.width)), height = Math.min(bounds.height - y, Math.floor(crop.height * bounds.height));
  if (width < 16 || height < 16) throw new Error('Elegí una zona de al menos 16 × 16 píxeles.');
  return { x: bounds.x + x, y: bounds.y + y, width, height };
}
export function captureByteRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return { start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < size ? { start, end } : null;
}
function helperPath() { return isPackagedBuild() ? join(process.resourcesPath, 'runtime', 'bin', 'syka-screen-recorder.exe') : join(app.getAppPath(), 'dist', 'syka-screen-recorder.exe'); }
async function awaitPhase(capture: NativeSession, phases: string[], timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (!phases.includes(capture.state.phase)) {
    if (capture.state.phase === 'error') throw new Error(capture.state.error || 'Falló la captura nativa.');
    if (terminal(capture.state.phase)) throw new Error('La grabación ya terminó.');
    if (Date.now() > deadline) throw new Error(`La grabación no respondió. Archivos de recuperación: ${capture.dir}`);
    await new Promise(done => setTimeout(done, 40));
  }
}

export function registerScreenCapture(bridge: typeof mainBridge) {
  const sessions = new Map<number, NativeSession>(), captures = new Map<string, NativeSession>();
  const starting = new Set<number>();
  captureBusy = () => starting.size > 0 || [...sessions.values()].some(capture => !terminal(capture.state.phase));
  const selectors = new Map<number, AbortController>();
  const response = (capture?: NativeSession): ScreenCaptureSources => ({ sources: [], systemAudio: process.platform === 'win32', ...(capture ? { status: { ...capture.state }, recording: capture.recording } : {}) });
  // Stream only completed session videos; arbitrary local paths are never accepted.
  protocol.registerSchemesAsPrivileged([{ scheme: 'syka-recording', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
  void app.whenReady().then(() => protocol.handle('syka-recording', async request => {
    const url = new URL(request.url), capture = captures.get(url.pathname.split('/')[1] ?? '');
    if (url.hostname !== 'capture' || url.pathname !== `/${capture?.id}/video` || !capture?.recording || !['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 404 });
    try {
      const size = (await stat(capture.recording.path)).size, range = captureByteRange(request.headers.get('range'), size);
      if (!range) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      const partial = request.headers.has('range');
      const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': String(range.end - range.start + 1), ...(partial ? { 'Content-Range': `bytes ${range.start}-${range.end}/${size}` } : {}) };
      const body = request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(capture.recording.path, range)) as ReadableStream<Uint8Array>;
      return new Response(body, { status: partial ? 206 : 200, headers });
    } catch { return new Response(null, { status: 404 }); }
  }));
  const list = async () => {
    const { stdout } = await run(helperPath(), ['list'], { windowsHide: true, timeout: 10_000, maxBuffer: 8 * 1024 * 1024 });
    const sources = JSON.parse(stdout) as ScreenSource[];
    if (!Array.isArray(sources) || !sources.length) throw new Error('No se encontraron pantallas disponibles.');
    return sources;
  };
  bridge.handle(MAIN_CHANNELS.SYKA_SCREEN_CAPTURE, async (request, event) => {
    if (process.platform !== 'win32') throw new Error('La grabación nativa está disponible en Windows.');
    const owner = event.sender.id;
    if (request.action === 'list') return { sources: await list(), systemAudio: true };
    if (request.action === 'cancel-selection') { selectors.get(owner)?.abort(); return response(); }
    if (request.action === 'select-region') {
      if (starting.has(owner) || (sessions.has(owner) && !terminal(sessions.get(owner)!.state.phase))) throw new Error('Ya hay una grabación en preparación o en curso.');
      starting.add(owner);
      const controller = new AbortController(); selectors.set(owner, controller);
      try {
        const source = (await list()).find(item => item.id === request.sourceId);
        if (!source) throw new Error('La pantalla cambió. Actualizá la selección.');
        return { sources: [], systemAudio: true, selectedRegion: await selectScreenRegion(event.sender, source.bounds, controller.signal) };
      } finally { selectors.delete(owner); starting.delete(owner); }
    }
    if (request.action === 'start') {
      if (starting.has(owner)) throw new Error('La grabación ya se está preparando.');
      starting.add(owner);
      try {
      if (sessions.has(owner) && !terminal(sessions.get(owner)!.state.phase)) throw new Error('Ya hay una grabación en curso.');
      if (!['none', 'system', 'microphone', 'both'].includes(request.audio)) throw new Error('Modo de audio inválido.');
      const ffmpeg = localToolPath('ffmpeg');
      if (!ffmpeg) throw new Error('No se encontró FFmpeg. Revisá Dependencias en los ajustes.');
      const source = (await list()).find(item => item.id === request.sourceId);
      if (!source) throw new Error('La pantalla cambió. Actualizá la selección.');
      const region = physicalCaptureRegion(source.bounds, request.region), project = await realpath(request.projectDir);
      if (!(await stat(project)).isDirectory()) throw new Error('El proyecto no está disponible.');
      const root = join(project, '03 Assets reutilizables', 'Adjuntos', 'screen-recordings'), id = randomUUID(), dir = join(root, id);
      await mkdir(dir, { recursive: true });
      const child = spawn(helperPath(), ['record'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      const capture: NativeSession = { id, owner, dir, root, region, child, state: { phase: 'starting', seconds: 0, path: '', microphone: '', error: '' } };
      const previous = sessions.get(owner); if (previous) captures.delete(previous.id);
      sessions.set(owner, capture); captures.set(id, capture);
      const lines = createInterface({ input: child.stdout });
      lines.on('line', line => {
        try { const next = JSON.parse(line) as ScreenCaptureStatus; if (typeof next.phase === 'string' && Number.isFinite(next.seconds)) capture.state = next; }
        catch { /* Incomplete status lines never update state. */ }
      });
      child.stderr.on('data', () => {}); // FFmpeg diagnostics stay in session logs.
      child.on('error', error => { capture.state = { ...capture.state, phase: 'error', error: error.message }; });
      child.on('close', () => { if (!terminal(capture.state.phase)) capture.state = { ...capture.state, phase: 'error', error: `El motor se cerró. Recuperación: ${dir}` }; });
      event.sender.once('destroyed', () => { if (!terminal(capture.state.phase)) child.stdin.end('stop\n'); });
      child.stdin.on('error', () => {});
      child.stdin.write(JSON.stringify({ region, audio: request.audio, ffmpeg, dir }) + '\n');
      try { await awaitPhase(capture, ['recording']); } catch (error) { child.stdin.end('stop\n'); throw error; }
      return { ...response(capture), recording: { id, path: '', microphonePath: null, previewUrl: '', duration: 0, width: region.width, height: region.height, size: 0 } };
      } finally { starting.delete(owner); }
    }
    const capture = sessions.get(owner);
    if (!capture || (request.id && capture.id !== request.id)) {
      if (request.action === 'cancel') return response();
      throw new Error('La grabación pertenece a otro chat o ya no está disponible.');
    }
    if (request.action === 'status') return response(capture);
    if (request.action === 'microphone') {
      if (!capture.recording?.microphonePath) throw new Error('La grabación no tiene una pista de voz.');
      if ((await stat(capture.recording.microphonePath)).size > 32 * 1024 * 1024) throw new Error('La voz supera el límite de transcripción.');
      return { ...response(capture), audio: new Uint8Array(await readFile(capture.recording.microphonePath)) };
    }
    if (request.action === 'cancel') {
      // Closing a completed preview never erases an attached project asset.
      const discardedWhileRecording = !terminal(capture.state.phase);
      // Finalize an explicitly discarded take so the recycle bin can recover a
      // playable MP4, rather than disconnected recording segments.
      if (discardedWhileRecording) { capture.child.stdin.write('stop\n'); await awaitPhase(capture, ['cancelled', 'complete', 'error'], 120_000); }
      if (capture.state.phase === 'cancelled' || discardedWhileRecording && capture.state.phase === 'complete' && !capture.recording) {
        const resolved = await realpath(capture.dir), root = await realpath(capture.root);
        if (dirname(resolved) !== root || !/^[0-9a-f-]{36}$/.test(capture.id) || resolve(root, capture.id) !== resolved) throw new Error('No se pudo comprobar el directorio temporal.');
        await moveToStorageTrash(process.env.SYKA_RUNTIME_ROOT || app.getPath('userData'), await realpath(join(capture.root, '../../..')), resolved, 'recording', 'Grabación de pantalla descartada');
        capture.state = { ...capture.state, phase: 'cancelled', path: '', microphone: '' };
        captures.delete(capture.id); sessions.delete(owner);
      }
      return response(capture);
    }
    if (request.action === 'pause' || request.action === 'resume') {
      const expected = request.action === 'pause' ? 'recording' : 'paused';
      if (capture.state.phase !== expected) throw new Error('Esperá a que termine la operación anterior.');
      capture.child.stdin.write(request.action + '\n'); await awaitPhase(capture, [request.action === 'pause' ? 'paused' : 'recording'], 120_000);
      return response(capture);
    }
    if (request.action !== 'stop') throw new Error('Operación de captura inválida.');
    if (!terminal(capture.state.phase)) { capture.child.stdin.write('stop\n'); await awaitPhase(capture, ['complete'], 120_000); }
    if (capture.state.phase !== 'complete') throw new Error(capture.state.error || 'La grabación no terminó.');
    const path = await realpath(capture.state.path);
    if (dirname(path) !== await realpath(capture.dir)) throw new Error('El video no pertenece a esta grabación.');
    const size = (await stat(path)).size; if (!size) throw new Error('La grabación quedó vacía.');
    capture.recording = { id: capture.id, path, microphonePath: capture.state.microphone || null, previewUrl: `syka-recording://capture/${capture.id}/video`, duration: capture.state.seconds, width: capture.region.width, height: capture.region.height, size };
    return response(capture);
  });
}
