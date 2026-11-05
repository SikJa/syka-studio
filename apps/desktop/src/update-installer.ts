/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

export const INSTALLER_NAME = 'Syka-Studio-x64-Setup.exe';
const MAX_INSTALLER_BYTES = 1024 * 1024 * 1024;

/**
 * Updates an installation that has no Squirrel `Update.exe` next to it: the
 * release's official Setup is downloaded beside the app's temp files and only
 * kept when its SHA-256 matches the release's `SHA256SUMS`.
 */
export type InstallerDownload = (feedUrl: string, onProgress: (fraction: number) => void) => Promise<string>;

/** `feedUrl` is the release's download folder, `https://github.com/<repo>/releases/download/<tag>`. */
export function installerDownloader(tempDir: string, fetcher: typeof fetch = fetch): InstallerDownload {
  return async (feedUrl, onProgress) => {
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/releases\/download\/[\w.%-]+$/.test(feedUrl)) throw Error('Origen de actualización inválido.');
    const sums = await fetcher(`${feedUrl}/SHA256SUMS`, { signal: AbortSignal.timeout(30_000) });
    if (!sums.ok) throw Error('La versión no publica sus huellas (SHA256SUMS).');
    const expected = (await sums.text()).split(/\r?\n/).map(line => line.trim().split(/\s+/))
      .find(([, name]) => name === INSTALLER_NAME)?.[0]?.toLowerCase();
    if (!expected || !/^[a-f\d]{64}$/.test(expected)) throw Error('La versión no tiene la huella del instalador.');

    const response = await fetcher(`${feedUrl}/${INSTALLER_NAME}`, { signal: AbortSignal.timeout(30 * 60_000) });
    const total = Number(response.headers.get('content-length')) || 0;
    if (!response.ok || !response.body) throw Error('No se pudo descargar el instalador.');
    if (total > MAX_INSTALLER_BYTES) throw Error('El instalador es demasiado grande.');

    const folder = join(tempDir, 'syka-studio-update');
    await mkdir(folder, { recursive: true });
    const target = join(folder, INSTALLER_NAME), partial = `${target}.part`;
    const hash = createHash('sha256');
    const file = createWriteStream(partial);
    let received = 0;
    try {
      const reader = response.body.getReader();
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        received += chunk.value.byteLength;
        if (received > MAX_INSTALLER_BYTES) throw Error('El instalador es demasiado grande.');
        hash.update(chunk.value);
        if (!file.write(chunk.value)) await new Promise<void>(resolve => file.once('drain', () => resolve()));
        if (total) onProgress(Math.min(received / total, 1));
      }
      await new Promise<void>((resolve, reject) => file.end((error?: Error | null) => error ? reject(error) : resolve()));
      if (hash.digest('hex') !== expected) throw Error('El instalador descargado no coincide con la huella publicada.');
      await rm(target, { force: true });
      await rename(partial, target);
      return target;
    } catch (error) {
      file.destroy();
      await rm(partial, { force: true }).catch(() => {});
      throw error;
    }
  };
}

/** Starts the Setup on its own so it can replace this app after it quits. */
export function launchInstaller(path: string): void {
  spawn(path, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
}
