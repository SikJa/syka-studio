import { isPackagedBuild } from './app-mode';
import { app, protocol } from 'electron';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { Worker } from 'node:worker_threads';
import { resourceLibrary, resourcePreviewMedia } from '../../../packages/agent-chat/src/host/resource-library';
import { captureByteRange } from './screen-capture';
import { MAIN_CHANNELS } from './main-channels';
import type { mainBridge } from './main-manager';
import type { ResourceWorkerCall } from './resource-worker';

const MEDIA_PREVIEW = /^\.(wav|mp3|ogg|flac|m4a|mp4|webm|mov|gif|png|jpe?g|webp)$/i;

type Call = ResourceWorkerCall extends infer C ? C extends { id: number } ? Omit<C, 'id'> : never : never;
/**
 * One lazily started worker thread owns the library indexes. Builds that do
 * not ship dist/resource-worker.js (QA scripts compile main.js alone) keep
 * the previous in-process behaviour.
 */
function resourceRunner() {
  const script = join(app.getAppPath(), 'dist', 'resource-worker.js');
  let worker: Worker | undefined, next = 0;
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  const inProcess = (call: Call): Promise<unknown> => call.method === 'library' ? resourceLibrary(...call.args) : resourcePreviewMedia(...call.args);
  const start = () => {
    const created = new Worker(script);
    created.unref();
    created.on('message', (message: { id: number; result?: unknown; error?: string }) => {
      const entry = pending.get(message.id); if (!entry) return;
      pending.delete(message.id);
      message.error === undefined ? entry.resolve(message.result) : entry.reject(Error(message.error));
    });
    const fail = (error: Error) => { if (worker === created) worker = undefined; for (const entry of pending.values()) entry.reject(error); pending.clear(); };
    created.on('error', fail);
    created.on('exit', code => { if (code !== 0) fail(Error('La biblioteca se reinició; volvé a intentar.')); else if (worker === created) worker = undefined; });
    return created;
  };
  return (call: Call): Promise<unknown> => {
    if (!existsSync(script)) return inProcess(call);
    worker ??= start();
    const id = ++next;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker!.postMessage({ ...call, id }); });
  };
}

// Audio/video previews used to travel as base64 data URLs over IPC (up to
// 24 MiB each, re-read on every hover). They now stream from disk with
// ranges; every request is validated exactly like a preview. The scheme is
// declared privileged together with syka-recording in screen-capture.ts.
export function registerSykaResources(bridge: typeof mainBridge) {
  const logos = isPackagedBuild() ? join(process.resourcesPath,'docs','resources','logos') : join(app.getAppPath(),'..','..','docs','resources','logos');
  const sounds = isPackagedBuild() ? join(process.resourcesPath,'docs','resources','sounds') : join(app.getAppPath(),'..','..','docs','resources','sounds');
  const motions = isPackagedBuild() ? join(process.resourcesPath,'docs','resources','motions') : join(app.getAppPath(),'..','..','docs','resources','motions');
  const config = () => join(process.env.SYKA_RUNTIME_ROOT || app.getPath('userData'), 'resource-libraries.json');
  const run = resourceRunner();
  const previewMedia = (path: string) => run({ method: 'previewMedia', args: [config(), path, logos, sounds, motions] }) as ReturnType<typeof resourcePreviewMedia>;
  bridge.handle(MAIN_CHANNELS.SYKA_RESOURCES, async req => {
    if (req?.action === 'preview' && typeof req.path === 'string' && MEDIA_PREVIEW.test(extname(req.path))) {
      const target = await previewMedia(req.path);
      return { folders: [], entries: [], total: 0, nextOffset: null, warnings: [], preview: `syka-resource://media/${encodeURIComponent(target.path)}` };
    }
    return run({ method: 'library', args: [config(), req, logos, sounds, motions] }) as ReturnType<typeof resourceLibrary>;
  });
  void app.whenReady().then(() => protocol.handle('syka-resource', async request => {
    const url = new URL(request.url);
    if (url.hostname !== 'media' || !['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 404 });
    try {
      const target = await previewMedia(decodeURIComponent(url.pathname.slice(1)));
      const range = captureByteRange(request.headers.get('range'), target.size);
      if (!range) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${target.size}` } });
      const partial = request.headers.has('range');
      const headers = { 'Content-Type': target.mediaType, 'Accept-Ranges': 'bytes', 'Content-Length': String(range.end - range.start + 1), 'Cache-Control': 'private, max-age=300', ...(partial ? { 'Content-Range': `bytes ${range.start}-${range.end}/${target.size}` } : {}) };
      const body = request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(target.path, range)) as ReadableStream<Uint8Array>;
      return new Response(body, { status: partial ? 206 : 200, headers });
    } catch { return new Response(null, { status: 404 }); }
  }));
}
