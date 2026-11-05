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
import { openWhatsNew } from '@/components/whats-new/whats-new-store';
import './update-menu.css';

const [update, setUpdate] = createRoot(() => createSignal<UpdateState>({ phase: 'disabled', currentVersion: APP_VERSION }));
const [announcement, setAnnouncement] = createRoot(() => createSignal<UpdateState | null>(null));
let connected = false;
let statusPoll: ReturnType<typeof setTimeout> | undefined;
const announced = new Set<string>();
function applyUpdate(next: UpdateState) {
  setUpdate(next);
  if (!document.hidden && next.availableVersion && ['available', 'ready'].includes(next.phase)) {
    const key = `${next.phase}:${next.availableVersion}`;
    if (!announced.has(key)) {
      announced.add(key);
      setAnnouncement(next);
    }
  }
  clearTimeout(statusPoll); statusPoll = undefined;
  // A status event can arrive while Electron is still loading the window.
  // Recover active operations with cheap local status reads, never new checks
  // or downloads. Settled states stop polling immediately.
  if (next.phase === 'checking' || next.phase === 'downloading') {
    statusPoll = setTimeout(() => void command('status'), next.phase === 'checking' ? 1000 : 3000);
  }
}
/** The updater as the app sees it, shared by the menu and the centred new-version card. */
export { update as updateState, announcement as updateAnnouncement, setAnnouncement as setUpdateAnnouncement, command as updateCommand, connect as connectUpdates };

function connect() {
  if (connected || !isDesktop()) return;
  connected = true;
  mainBridge.handle(MAIN_CHANNELS.SYKA_UPDATES_CHANGED, applyUpdate);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyUpdate(update()); });
  void command('status');
}
async function command(action: UpdateRequest['action']) {
  try { applyUpdate(await mainBridge.call(MAIN_CHANNELS.SYKA_UPDATES, { action, locale: locale() })); }
  catch (error) { clearTimeout(statusPoll); statusPoll = undefined; toast.error(t('No se pudo completar la actualización'), { description: t((error as Error).message) }); }
}

/** Lucide's circle-fading-arrow-up (ISC), the usual «update» mark, at the sidebar's icon size. */
function UpdateArrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" class="size-[18px]" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2a10 10 0 0 1 7.38 16.75" /><path d="m16 12-4-4-4 4" /><path d="M12 16V8" />
    <path d="M2.5 8.875a10 10 0 0 0-.5 3" /><path d="M2.83 16a10 10 0 0 0 2.43 3.4" /><path d="M4.636 5.235a10 10 0 0 1 .891-.857" /><path d="M8.644 21.42a10 10 0 0 0 7.631-.38" />
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
    <Show when={update().phase === 'downloading'}><div class="syka-update-progress" role="progressbar" aria-label={t('Descargando actualización')} aria-valuenow={update().progress === undefined ? undefined : Math.round(update().progress! * 100)} /></Show>
    <Show when={update().phase === 'ready'}><p class="text-xs text-muted-foreground">{t('Reiniciá cuando te venga bien. Tus proyectos y preferencias se conservan.')}</p></Show>
    <div class="flex flex-wrap items-center gap-2 pt-1">
      <Show when={update().phase === 'available' || update().phase === 'error' && !!update().availableVersion}>
        <Button onClick={() => void command('download')}>{t('Descargar actualización')}</Button>
      </Show>
      <Show when={update().phase === 'ready'}><Button onClick={() => void command('install')}>{t('Reiniciar e instalar')}</Button></Show>
      <Show when={['idle', 'error'].includes(update().phase)}><Button variant="secondary" onClick={() => void command('check')}>{t('Buscar actualizaciones')}</Button></Show>
      <Show when={update().releaseUrl && !update().simulation}><button type="button" class="text-xxs text-muted-foreground hover:text-foreground focus-ring" onClick={() => void command('notes')}>{t('Ver cambios')} ↗</button></Show>
      <button type="button" class="text-xxs text-muted-foreground hover:text-foreground focus-ring" onClick={openWhatsNew}>Novedades</button>
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
