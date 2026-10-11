/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { app, autoUpdater, dialog, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MAIN_CHANNELS } from './main-channels';
import { mainBridge } from './main-manager';
import { UpdateController, validUpdateRepo } from './update-controller';
import { isAgentChatBusy } from './agent-chat';
import { createUpdateDemo } from './update-demo';
import type { UpdateState } from './update-types';
import { isPackagedBuild } from './app-mode';

export function registerUpdates(window: () => BrowserWindow | null, filesBusy: () => boolean): () => void {
  let repo = '';
  try {
    const config = JSON.parse(readFileSync(join(app.getAppPath(), 'release.config.json'), 'utf8'));
    if (typeof config.repository === 'string' && validUpdateRepo(config.repository)) repo = config.repository;
  } catch { /* An unconfigured build never queries upstream Diffusion. */ }
  const enabled = isPackagedBuild() && process.platform === 'win32' && !!repo
    && existsSync(resolve(process.execPath, '..', '..', 'Update.exe'));
  const demoOptions = { packaged: isPackagedBuild(), defaultApp: !!process.defaultApp, appPath: app.getAppPath(), version: app.getVersion(), env: process.env,
    restart: () => { app.relaunch(); app.quit(); } };
  let demo = createUpdateDemo(demoOptions);
  const decorate = (state: UpdateState): UpdateState => demo ? { ...state, simulation: demo.applied ? 'complete' : 'preview' } : state;
  const makeController = () => new UpdateController({
    version: demo?.currentVersion ?? app.getVersion(), repo, enabled: enabled || !!demo, driver: demo?.driver ?? autoUpdater,
    changed: state => mainBridge.emit(window(), MAIN_CHANNELS.SYKA_UPDATES_CHANGED, decorate(state)),
    loadRelease: async () => {
      if (demo) return demo.loadRelease();
      const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Syka-Studio-Updater' },
        signal: AbortSignal.timeout(15_000), redirect: 'error',
      });
      if (response.status === 404) return null; // No stable release yet.
      if (!response.ok) throw Error('Update metadata unavailable');
      const reader = response.body?.getReader();
      if (!reader) throw Error('Empty update metadata');
      const parts: Uint8Array[] = []; let length = 0;
      try {
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > 1024 * 1024) throw Error('Update metadata too large');
          parts.push(chunk.value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      return JSON.parse(Buffer.concat(parts).toString('utf8'));
    },
  });
  let controller = makeController();
  mainBridge.handle(MAIN_CHANNELS.SYKA_UPDATES, async request => {
    if (!request || !['status', 'check', 'download', 'install', 'notes', 'demo-reset'].includes(request.action)) throw Error('Solicitud de actualización inválida.');
    if (request.action === 'demo-reset') {
      if (!demo) throw Error('La simulación no está habilitada.');
      // Re-arm the fake release without a second restart immediately after
      // startup. Only the explicit install action restarts this test window.
      controller.stop(); demo.stop(); demo.reset();
      demo = createUpdateDemo(demoOptions); controller = makeController();
      return decorate(await controller.check());
    }
    if (request.action === 'check') return decorate(await controller.check());
    if (request.action === 'download') return decorate(controller.download());
    if (request.action === 'notes') {
      const url = controller.snapshot().releaseUrl;
      if (url && !demo) await shell.openExternal(url);
    }
    if (request.action === 'install') {
      if (controller.snapshot().phase !== 'ready') throw Error('La actualización todavía no está lista.');
      if (filesBusy() || await isAgentChatBusy()) throw Error('Hay tareas en curso. Esperá a que terminen antes de reiniciar Syka.');
      const text = request.locale === 'en'
        ? ['Update Syka Studio', 'Restart Syka to install the update?', 'Save your changes before continuing. Your projects and preferences are preserved.', 'Restart and install', 'Later']
        : request.locale === 'pt-BR'
          ? ['Atualizar Syka Studio', 'Reiniciar o Syka para instalar a atualização?', 'Salve suas alterações antes de continuar. Seus projetos e preferências são mantidos.', 'Reiniciar e instalar', 'Depois']
          : ['Actualizar Syka Studio', '¿Reiniciar Syka para instalar la actualización?', 'Guardá tus cambios antes de continuar. Tus proyectos y preferencias se conservan.', 'Reiniciar e instalar', 'Después'];
      const demoDetail = request.locale === 'en' ? 'Local simulation: only this test window restarts. No update is installed.'
        : request.locale === 'pt-BR' ? 'Simulação local: apenas esta janela de teste reinicia. Nenhuma atualização é instalada.'
          : 'Simulación local: solo se reinicia esta ventana de prueba. No se instala una actualización.';
      const options = { type: 'question' as const, title: text[0], message: text[1], detail: demo ? demoDetail : text[2],
        buttons: [text[3], text[4]], defaultId: 1, cancelId: 1 };
      const target = window();
      const answer = target ? await dialog.showMessageBox(target, options) : await dialog.showMessageBox(options);
      if (answer.response === 0) {
        if (filesBusy() || await isAgentChatBusy()) throw Error('Empezó una tarea. Esperá a que termine antes de reiniciar.');
        controller.install();
      }
    }
    return decorate(controller.snapshot());
  });
  const initial = enabled || demo ? setTimeout(() => void controller.check(), demo ? 1500 : process.argv.includes('--squirrel-firstrun') ? 60_000 : 30_000) : undefined;
  const interval = enabled ? setInterval(() => void controller.check(), 6 * 60 * 60_000) : undefined;
  initial?.unref(); interval?.unref();
  return () => { clearTimeout(initial); clearInterval(interval); controller.stop(); demo?.stop(); };
}
