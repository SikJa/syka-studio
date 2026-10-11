/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { createRoot, createSignal, onMount, Show } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import type { UpdateRequest, UpdateState } from '@desktop/update-types';
import { mainBridge } from '@/lib/ipc';
import { isDesktop } from '@/projects';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverPortal, PopoverTrigger } from '@/components/ui/popover';
import { locale, t } from '@/i18n';
import './update-menu.css';

const [update, setUpdate] = createRoot(() => createSignal<UpdateState>({ phase: 'disabled', currentVersion: APP_VERSION }));
let connected = false;
let statusPoll: ReturnType<typeof setTimeout> | undefined;
function applyUpdate(next: UpdateState) {
  setUpdate(next);
  clearTimeout(statusPoll); statusPoll = undefined;
  // A status event can arrive while Electron is still loading the window.
  // Recover active operations with cheap local status reads, never new checks
  // or downloads. Settled states stop polling immediately.
  if (next.phase === 'checking' || next.phase === 'downloading') {
    statusPoll = setTimeout(() => void command('status'), next.phase === 'checking' ? 1000 : 3000);
  }
}
function connect() {
  if (connected || !isDesktop()) return;
  connected = true;
  mainBridge.handle(MAIN_CHANNELS.SYKA_UPDATES_CHANGED, applyUpdate);
  void command('status');
}
async function command(action: UpdateRequest['action']) {
  try { applyUpdate(await mainBridge.call(MAIN_CHANNELS.SYKA_UPDATES, { action, locale: locale() })); }
  catch (error) { clearTimeout(statusPoll); statusPoll = undefined; toast.error(t('No se pudo completar la actualización'), { description: t((error as Error).message) }); }
}

function UpdateArrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" class="size-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19.5 8A8 8 0 1 0 20 15M19.5 3.5V8H15M12 16V8m-3 3 3-3 3 3" />
  </svg>;
}
function UpdateDetails() {
  const headline = () => ({ disabled: 'Actualizaciones', idle: 'Syka está al día', checking: 'Buscando actualizaciones…',
    available: 'Hay una nueva versión', downloading: 'Descargando actualización…', ready: 'Lista para instalar', error: 'No se pudo actualizar' })[update().phase];
  return <div class="syka-update-details">
    <Show when={update().simulation}>
      <p class="text-xxs font-450 text-primary">{t('Simulación local')}</p>
      <p class="text-xxs text-muted-foreground">{t(update().simulation === 'complete'
        ? 'La ventana se reinició y la actualización simulada terminó.'
        : 'Probá el aviso, la descarga y el reinicio. Esta prueba no instala una versión real.')}</p>
    </Show>
    <p class="text-xs font-450 text-foreground" role="status" aria-live="polite">{t(headline())}</p>
    <p class="text-xxs text-muted-foreground">{t('Versión instalada')} · {update().currentVersion}</p>
    <Show when={update().availableVersion}><p class="text-xs text-foreground">{t('Nueva versión')} · {update().availableVersion}</p></Show>
    <Show when={update().message}><p class="text-xs text-muted-foreground">{t(update().message!)}</p></Show>
    <Show when={update().phase === 'downloading'}><div class="syka-update-progress" role="progressbar" aria-label={t('Descargando actualización')} /></Show>
    <Show when={update().phase === 'ready'}><p class="text-xs text-muted-foreground">{t('Reiniciá cuando te venga bien. Tus proyectos y preferencias se conservan.')}</p></Show>
    <div class="flex flex-wrap items-center gap-2 pt-1">
      <Show when={update().phase === 'available' || update().phase === 'error' && !!update().availableVersion}>
        <Button onClick={() => void command('download')}>{t('Descargar actualización')}</Button>
      </Show>
      <Show when={update().phase === 'ready'}><Button onClick={() => void command('install')}>{t('Reiniciar e instalar')}</Button></Show>
      <Show when={['idle', 'error'].includes(update().phase)}><Button variant="secondary" onClick={() => void command('check')}>{t('Buscar actualizaciones')}</Button></Show>
      <Show when={update().releaseUrl && !update().simulation}><button type="button" class="text-xxs text-muted-foreground hover:text-foreground focus-ring" onClick={() => void command('notes')}>{t('Ver cambios')} ↗</button></Show>
      <Show when={update().simulation === 'complete'}><Button variant="secondary" onClick={() => void command('demo-reset')}>{t('Repetir simulación')}</Button></Show>
    </div>
  </div>;
}

export function UpdateMenu() {
  onMount(connect);
  const attention = () => ['available', 'ready'].includes(update().phase);
  const label = () => t(update().phase === 'ready' ? 'Actualización lista para instalar' : attention() ? 'Actualización disponible' : 'Actualizaciones de Syka');
  return <Popover placement="top-end">
    <PopoverTrigger type="button" aria-label={label()} title={label()} class="syka-update-trigger shrink-0" data-attention={attention()}>
      <UpdateArrow /><Show when={attention()}><span class="syka-update-dot" /></Show>
    </PopoverTrigger>
    <PopoverPortal><PopoverContent class="syka-update-popover"><UpdateDetails /></PopoverContent></PopoverPortal>
  </Popover>;
}

export function UpdateSettings() {
  onMount(connect);
  return <UpdateDetails />;
}
