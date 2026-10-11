/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import type { UpdateDriver } from './update-controller';

type DemoOptions = {
  packaged: boolean; defaultApp: boolean; appPath: string; version: string;
  env: NodeJS.ProcessEnv; restart(): void;
};

/** The demo never receives Electron's native updater or performs network I/O. */
class DemoDriver extends EventEmitter implements UpdateDriver {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly installed: () => void;
  constructor(installed: () => void) { super(); this.installed = installed; }
  setFeedURL(_options: { url: string }): void { /* No download feed is used. */ }
  checkForUpdates(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; this.emit('update-downloaded'); }, 5000);
    this.timer.unref?.();
  }
  quitAndInstall(): void { this.installed(); }
  stop(): void { clearTimeout(this.timer); this.timer = undefined; this.removeAllListeners(); }
}

export function createUpdateDemo(options: DemoOptions) {
  const { env, appPath, version } = options;
  // Development only, explicitly requested, and in one dedicated test profile.
  // Even a packaged app with these variables set keeps the real update policy.
  if (options.packaged || !options.defaultApp || env.SYKA_DEV_RUN !== '1' || env.SYKA_UPDATE_DEMO !== '1'
    || !env.SYKA_RUNTIME_ROOT
    || resolve(env.SYKA_RUNTIME_ROOT) !== resolve(appPath, '../../.runtime/update-demo')) return null;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match || match.slice(1).some(value => !Number.isSafeInteger(Number(value)))) throw Error('Versión de prueba inválida.');
  const minor = Number(match[2]) + 1;
  if (!Number.isSafeInteger(minor)) throw Error('Versión de prueba inválida.');
  const availableVersion = `${match[1]}.${minor}.0`;
  const marker = `${version}:${availableVersion}`;
  const applied = env.SYKA_UPDATE_DEMO_APPLIED === marker;
  const driver = new DemoDriver(() => { env.SYKA_UPDATE_DEMO_APPLIED = marker; options.restart(); });
  return {
    driver, applied, currentVersion: applied ? availableVersion : version,
    async loadRelease() {
      await new Promise<void>(done => setTimeout(done, 900));
      return { tag_name: `v${availableVersion}`, assets: [{ name: 'RELEASES' }, { name: `SykaStudio-${availableVersion}-full.nupkg` }] };
    },
    reset() { delete env.SYKA_UPDATE_DEMO_APPLIED; },
    stop() { driver.stop(); },
  };
}
