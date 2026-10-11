import { BrowserWindow, ipcMain } from 'electron';
import type { IpcMainEvent } from 'electron';
import { DapiError, DAPI_WIRE } from '@diffusionstudio/dapi';
import { getProject } from '../projects';
import { projectKey } from './project-target';
import type { RendererCalls } from './renderer-calls';
import type { PreviewJob } from './preview-queue';

export type PreviewWorkerOptions = {
  preload: string;
  /** Development origin, or the built standalone page. Never the normal app shell. */
  devUrl?: string;
  pagePath: string;
  trustWindow(window: BrowserWindow | null): void;
  observeWindow?(window: BrowserWindow): void;
  idleMs?: number;
};

/** One lazily created hidden renderer, with no router, chat, timeline, watchers or playback loop. */
export class InternalPreviewWorker {
  private window: BrowserWindow | null = null;
  private loading: Promise<BrowserWindow> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private jobs = 0;

  private readonly renderer: RendererCalls;
  private readonly options: PreviewWorkerOptions;
  constructor(renderer: RendererCalls, options: PreviewWorkerOptions) { this.renderer = renderer; this.options = options; }

  async run(job: PreviewJob, signal: AbortSignal): Promise<unknown> {
    if (signal.aborted) throw new DapiError('canceled', 'Se canceló la revisión.');
    this.clearIdle();
    const project = await getProject(job.project.dir);
    if (!project || project.id !== job.project.id) throw new DapiError('not-found',
      'La carpeta ya no pertenece a este proyecto. No se revisó otro proyecto ni se cambió la ventana.');
    if (job.tool === 'open' && projectKey({ id: project.id, dir: (job.args as { dir: string }).dir }) !== projectKey(job.project)) {
      throw new DapiError('invalid-input', 'Esta sesión solo puede abrir su propio proyecto.');
    }
    if (job.tool === 'screenshot') throw new DapiError('unsupported',
      'La revisión interna no captura tu interfaz. Usá capture para ver la composición de este proyecto.');
    const cancel = () => this.reset(); // Kill a stuck renderer before the queue releases its slot.
    signal.addEventListener('abort', cancel, { once: true });
    try {
      if (signal.aborted) throw new DapiError('canceled', 'Se canceló la revisión.');
      const window = await this.ready();
      const result = await this.renderer.callIn(window, job.tool, job.args, signal, { id: project.id, dir: project.dir }, true);
      this.jobs++;
      return result;
    } finally {
      signal.removeEventListener('abort', cancel);
      if (this.jobs >= 48) this.reset(); // Also bound document/font/module caches over long unattended runs.
      else if (this.window) {
        this.idleTimer = setTimeout(() => this.reset(), this.options.idleMs ?? 60_000);
        this.idleTimer.unref?.();
      }
    }
  }

  reset(): void {
    this.clearIdle();
    const window = this.window;
    this.window = null;
    this.loading = null;
    this.jobs = 0;
    this.options.trustWindow(null);
    if (window && !window.isDestroyed()) window.destroy();
  }

  status() { return { loaded: !!this.window && !this.window.isDestroyed(), jobsSinceRecycle: this.jobs }; }

  private clearIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private ready(): Promise<BrowserWindow> {
    if (this.loading) return this.loading;
    const window = new BrowserWindow({ show: false, width: 960, height: 720, focusable: false,
      skipTaskbar: true, title: 'Syka · Internal preview',
      webPreferences: { preload: this.options.preload, contextIsolation: true, nodeIntegration: false,
        sandbox: true, backgroundThrottling: false, partition: 'syka-internal-preview' } });
    this.window = window;
    this.options.trustWindow(window);
    this.options.observeWindow?.(window);
    window.webContents.setAudioMuted(true);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.once('closed', () => {
      if (this.window === window) { this.window = null; this.loading = null; this.options.trustWindow(null); }
    });
    const pending = new Promise<BrowserWindow>((resolve, reject) => {
      const timer = setTimeout(() => fail(new Error('La preview interna no instaló sus herramientas a tiempo.')), 45_000);
      const cleanup = () => {
        clearTimeout(timer); ipcMain.off(DAPI_WIRE.PREVIEW_READY, ready); window.off('closed', closed);
      };
      const fail = (error: Error) => { cleanup(); reject(error); };
      const closed = () => fail(new DapiError('canceled', 'La preview interna se cerró.'));
      const ready = (event: IpcMainEvent) => {
        if (event.sender !== window.webContents || event.senderFrame !== event.sender.mainFrame) return;
        cleanup(); resolve(window);
      };
      ipcMain.on(DAPI_WIRE.PREVIEW_READY, ready);
      window.once('closed', closed);
      const load = this.options.devUrl
        ? window.loadURL(new URL('/preview-worker.html', this.options.devUrl).href)
        : window.loadFile(this.options.pagePath);
      void load.catch(fail);
    });
    this.loading = pending;
    return pending;
  }
}
