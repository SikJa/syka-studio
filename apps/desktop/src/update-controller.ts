/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { UpdateState } from './update-types';

type Release = { tag_name?: string; draft?: boolean; prerelease?: boolean; assets?: { name: string }[] };
export type UpdateDriver = {
  on(event: 'update-downloaded' | 'update-not-available' | 'error', listener: (...args: unknown[]) => void): unknown;
  removeListener(event: string, listener: (...args: unknown[]) => void): unknown;
  setFeedURL(options: { url: string }): void;
  checkForUpdates(): void;
  quitAndInstall(): void;
};

export function validUpdateRepo(repo: string): boolean {
  return /^[a-z\d](?:[a-z\d-]{0,38})\/[a-z\d][a-z\d._-]{0,99}$/i.test(repo)
    && !repo.toLowerCase().startsWith('diffusionstudio/');
}

export function newerVersion(candidate: string, current: string): boolean {
  const parse = (value: string) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value)?.slice(1).map(Number);
  const a = parse(candidate), b = parse(current);
  if (!a || !b || [...a, ...b].some(n => !Number.isSafeInteger(n))) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i]! > b[i]!;
  return false;
}

/** Metadata checks never invoke Squirrel, which downloads as soon as it checks. */
export class UpdateController {
  private state: UpdateState;
  private inFlight: Promise<UpdateState> | null = null;
  private lastCheck = 0;
  private feedUrl: string | null = null;
  private stopped = false;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners: [string, (...args: unknown[]) => void][] = [];
  private readonly options: {
    version: string; repo: string; enabled: boolean; disabledReason?: string;
    driver: UpdateDriver; loadRelease(): Promise<Release | null>;
    changed(state: UpdateState): void; now?: () => number;
  };

  constructor(options: UpdateController['options']) {
    this.options = options;
    this.state = { phase: options.enabled && validUpdateRepo(options.repo) ? 'idle' : 'disabled', currentVersion: options.version,
      ...(!options.enabled || !validUpdateRepo(options.repo) ? { message: options.disabledReason ?? 'Las actualizaciones se habilitan en la versión instalada de Syka.' } : {}) };
    const listen = (event: 'update-downloaded' | 'update-not-available' | 'error', listener: (...args: unknown[]) => void) => {
      options.driver.on(event, listener); this.listeners.push([event, listener]);
    };
    listen('update-downloaded', () => {
      if (this.state.phase !== 'downloading' || this.stopped) return;
      this.clearTimeout(); this.change({ phase: 'ready', message: undefined });
    });
    listen('update-not-available', () => {
      if (this.state.phase !== 'downloading' || this.stopped) return;
      this.clearTimeout(); this.change({ phase: 'idle', availableVersion: undefined, message: undefined });
    });
    listen('error', () => {
      if (this.state.phase !== 'downloading' || this.stopped) return;
      this.clearTimeout(); this.change({ phase: 'error', message: 'No se pudo descargar la actualización. Podés volver a intentarlo.' });
    });
  }

  snapshot(): UpdateState { return { ...this.state }; }
  private change(next: Partial<UpdateState>): void {
    if (this.stopped) return;
    this.state = { ...this.state, ...next }; this.options.changed(this.snapshot());
  }
  private clearTimeout(): void { if (this.timeout) clearTimeout(this.timeout); this.timeout = undefined; }

  check(): Promise<UpdateState> {
    if (this.stopped || ['disabled', 'downloading', 'ready'].includes(this.state.phase)) return Promise.resolve(this.snapshot());
    if (this.inFlight) return this.inFlight;
    const now = this.options.now?.() ?? Date.now();
    if (this.lastCheck && now - this.lastCheck < 30_000) return Promise.resolve(this.snapshot());
    this.lastCheck = now;
    this.change({ phase: 'checking', message: undefined });
    this.inFlight = this.inspect().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async inspect(): Promise<UpdateState> {
    try {
      const release = await this.options.loadRelease();
      if (this.stopped) return this.snapshot();
      const checkedAt = new Date(this.options.now?.() ?? Date.now()).toISOString();
      const tag = release?.tag_name;
      if (!release || release.draft || release.prerelease || !tag || !newerVersion(tag, this.options.version)) {
        this.feedUrl = null;
        this.change({ phase: 'idle', checkedAt, availableVersion: undefined, releaseUrl: undefined });
      } else {
        const names = release.assets?.map(a => a.name) ?? [];
        if (!names.includes('RELEASES') || !names.some(n => /^SykaStudio-[\d.]+-full\.nupkg$/i.test(n))) {
          throw Error('La versión todavía no tiene todos los archivos de actualización.');
        }
        const base = `https://github.com/${this.options.repo}/releases`;
        this.feedUrl = `${base}/download/${encodeURIComponent(tag)}`;
        this.change({ phase: 'available', checkedAt, availableVersion: tag.replace(/^v/, ''), releaseUrl: `${base}/tag/${encodeURIComponent(tag)}` });
      }
    } catch {
      this.change({ phase: 'error', message: 'No se pudieron buscar actualizaciones. Revisá tu conexión y probá de nuevo.' });
    }
    return this.snapshot();
  }

  download(): UpdateState {
    if (this.stopped) return this.snapshot();
    if (this.state.phase === 'downloading' || this.state.phase === 'ready') return this.snapshot();
    if (!this.feedUrl || !['available', 'error'].includes(this.state.phase)) throw Error('Primero buscá una actualización disponible.');
    this.change({ phase: 'downloading', message: undefined });
    try {
      this.options.driver.setFeedURL({ url: this.feedUrl });
      // Keep the operation locked until Squirrel settles. Timing it out and
      // starting a second download could race Update.exe on Windows.
      this.timeout = setTimeout(() => this.change({ message: 'La descarga está tardando. Podés seguir editando; avisaremos cuando termine.' }), 10 * 60_000);
      this.timeout.unref?.();
      this.options.driver.checkForUpdates();
    } catch {
      this.clearTimeout(); this.change({ phase: 'error', message: 'No se pudo iniciar la descarga. Podés volver a intentarlo.' });
    }
    return this.snapshot();
  }

  install(): void {
    if (this.stopped || this.state.phase !== 'ready') throw Error('La actualización todavía no está lista para instalar.');
    this.options.driver.quitAndInstall();
  }
  stop(): void {
    this.stopped = true; this.clearTimeout();
    for (const [event, listener] of this.listeners) this.options.driver.removeListener(event, listener);
  }
}
