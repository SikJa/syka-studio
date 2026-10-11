import { DapiError } from '@diffusionstudio/dapi';
import { projectKey } from './project-target';
import type { DapiProjectTarget } from '@diffusionstudio/dapi';

export type PreviewJob = { project: DapiProjectTarget; tool: string; args: unknown };
/** Keep existing long media budgets; ordinary reviews fail quickly if their renderer hangs. */
export function previewExecutionTimeout(tool: string): number {
  if (tool === 'media_segment') return 3_600_000;
  if (['capture', 'media_transcribe', 'media_listen'].includes(tool)) return 600_000;
  return 120_000;
}
type Entry = {
  job: PreviewJob;
  caller: AbortSignal;
  resolve(value: unknown): void;
  reject(error: unknown): void;
  detach(): void;
  timer: ReturnType<typeof setTimeout>;
};
export type PreviewQueueOptions = {
  /** Metadata only; worlds/decoders are created exclusively for the active job. */
  maxPending?: number;
  maxPerProject?: number;
  waitTimeoutMs?: number;
  executionTimeoutMs?: number;
};

/** One executor, round-robin project lanes. Cancel/timeout resets it before releasing the slot. */
export class ProjectPreviewQueue {
  private readonly lanes = new Map<string, Entry[]>();
  private waiting = 0;
  private active: { entry: Entry; controller: AbortController } | null = null;
  private pumping = false;
  private closed = false;
  private readonly limits: Required<Omit<PreviewQueueOptions, 'executionTimeoutMs'>>;
  private readonly executionTimeout?: number;

  private readonly execute: (job: PreviewJob, signal: AbortSignal) => Promise<unknown>;
  private readonly reset: () => void | Promise<void>;
  constructor(
    execute: (job: PreviewJob, signal: AbortSignal) => Promise<unknown>,
    reset: () => void | Promise<void>,
    options: PreviewQueueOptions = {},
  ) {
    this.execute = execute; this.reset = reset;
    this.limits = { maxPending: 512, maxPerProject: 32, waitTimeoutMs: 15 * 60_000, ...options };
    this.executionTimeout = options.executionTimeoutMs;
  }

  status() {
    return { active: this.active ? { projectId: this.active.entry.job.project.id, tool: this.active.entry.job.tool } : null,
      waiting: this.waiting, projectsWaiting: this.lanes.size, closed: this.closed };
  }

  call(job: PreviewJob, caller: AbortSignal): Promise<unknown> {
    if (this.closed) return Promise.reject(new DapiError('canceled', 'La cola de revisión se cerró.'));
    if (caller.aborted) return Promise.reject(new DapiError('canceled', 'Se canceló la revisión.'));
    const key = projectKey(job.project);
    const lane = this.lanes.get(key) ?? [];
    if (this.waiting >= this.limits.maxPending || lane.length >= this.limits.maxPerProject) {
      return Promise.reject(new DapiError('busy', 'La cola de revisión está llena. Esperá las revisiones pendientes y reintentá.'));
    }
    return new Promise((resolve, reject) => {
      const cancel = () => {
        if (this.active?.entry === entry) {
          this.active.controller.abort(new DapiError('canceled', 'Se canceló la revisión.'));
        } else this.remove(key, entry, new DapiError('canceled', 'Se canceló la revisión en espera.'));
      };
      const entry: Entry = { job: { ...job, project: Object.freeze({ ...job.project }) }, caller, resolve, reject,
        detach: () => caller.removeEventListener('abort', cancel),
        timer: setTimeout(() => this.remove(key, entry, new DapiError('busy',
          'La revisión agotó su espera en la cola. Reintentá; no se revisó el proyecto.')), this.limits.waitTimeoutMs) };
      entry.timer.unref?.();
      caller.addEventListener('abort', cancel, { once: true });
      lane.push(entry);
      this.lanes.set(key, lane);
      this.waiting++;
      void this.pump();
    });
  }

  stop(): void {
    this.closed = true;
    const error = new DapiError('canceled', 'La aplicación cerró la cola de revisión.');
    for (const lane of this.lanes.values()) for (const entry of lane) this.finish(entry, error);
    this.lanes.clear();
    this.waiting = 0;
    this.active?.controller.abort(error);
  }

  private remove(key: string, entry: Entry, error: Error): void {
    const lane = this.lanes.get(key);
    const index = lane?.indexOf(entry) ?? -1;
    if (!lane || index < 0) return;
    lane.splice(index, 1);
    if (!lane.length) this.lanes.delete(key);
    this.waiting--;
    this.finish(entry, error);
  }

  private finish(entry: Entry, error: unknown): void {
    clearTimeout(entry.timer);
    entry.detach();
    entry.reject(error);
  }

  private take(): Entry | undefined {
    const first = this.lanes.entries().next().value;
    if (!first) return;
    const [key, lane] = first;
    this.lanes.delete(key);
    const entry = lane.shift()!;
    if (lane.length) this.lanes.set(key, lane); // Move the project behind the other lanes.
    this.waiting--;
    clearTimeout(entry.timer);
    return entry;
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      for (let entry; !this.closed && (entry = this.take());) {
        const controller = new AbortController();
        this.active = { entry, controller };
        const timer = setTimeout(() => controller.abort(new DapiError('busy',
          'La revisión agotó su tiempo. Se liberó la preview interna para los demás proyectos.')), this.executionTimeout ?? previewExecutionTimeout(entry.job.tool));
        timer.unref?.();
        let cancel!: () => void;
        const aborted = new Promise<never>((_, reject) => {
          cancel = () => reject(controller.signal.reason);
          controller.signal.addEventListener('abort', cancel, { once: true });
        });
        try {
          if (entry.caller.aborted) controller.abort(new DapiError('canceled', 'Se canceló la revisión.'));
          const result = await Promise.race([aborted, this.execute(entry.job, controller.signal)]);
          entry.resolve(result);
        } catch (error) {
          // A stuck decoder or renderer must be gone before the next job starts.
          try { await this.reset(); } catch { this.stop(); } // Never overlap an executor whose reset failed.
          entry.reject(error);
        } finally {
          clearTimeout(timer);
          controller.signal.removeEventListener('abort', cancel);
          entry.detach();
          this.active = null;
        }
      }
    } finally {
      this.pumping = false;
    }
  }
}
