import { createResource, createSignal, For, Show } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { PERMISSION_IDS, type StudioPermission } from '@desktop/syka-permission-types';
import { mainBridge } from '@/lib/ipc';
import { SettingsButton, SettingsGroup, SettingsRow, SettingsSwitch } from '@/components/settings/kit';
import { t } from '@/i18n';

const labels: Record<StudioPermission, [string, string]> = {
  clipboard: ['Portapapeles', 'Pegar textos, imágenes y archivos cuando lo necesites.'],
  fonts: ['Tipografías del equipo', 'Usar las fuentes instaladas en tus títulos.'],
  microphone: ['Micrófono', 'Dictado y grabación de audio. Windows también debe permitir el acceso.'],
  notifications: ['Notificaciones', 'Avisos cuando terminan las exportaciones.'],
};

export function DashboardPermissionsSection() {
  const [busy, setBusy] = createSignal<StudioPermission | null>(null);
  const [permissions, { mutate, refetch }] = createResource(async () => window.desktop
    ? mainBridge.call(MAIN_CHANNELS.SYKA_PERMISSIONS, { action: 'get' }) : null);
  const toggle = async (id: StudioPermission) => {
    setBusy(id);
    try {
      mutate(await mainBridge.call(MAIN_CHANNELS.SYKA_PERMISSIONS, { action: 'set', permission: id, allowed: !permissions()?.[id] }));
      window.dispatchEvent(new Event('syka:permissions-changed'));
    }
    catch (error) { toast.error('No se pudo cambiar el permiso', { description: (error as Error).message }); }
    finally { setBusy(null); }
  };
  const systemMicrophone = async () => {
    try { await mainBridge.call(MAIN_CHANNELS.SYKA_PERMISSIONS, { action: 'system-microphone' }); }
    catch (error) { toast.error('No se pudo abrir la configuración del sistema', { description: (error as Error).message }); }
  };
  // Syka Code's settings rows: a real switch per permission, saving while it turns.
  return <SettingsGroup title="Permisos" description="Vos elegís los accesos de Syka Studio. Los cambios se guardan en este equipo."
    footnote="Permitir un acceso no inicia grabaciones ni lee el portapapeles. Tus proyectos se guardan como archivos en la carpeta elegida.">
    <Show when={window.desktop} fallback={<div class="syka-settings-row"><p class="text-xs text-muted-foreground">En el navegador, abrí los permisos del sitio desde el icono junto a la dirección. Los bloqueos se cambian ahí. En la aplicación de escritorio podés configurarlos desde este apartado.</p></div>}>
      <Show when={permissions.error}><div class="syka-settings-row"><p role="alert" class="text-xs">No se pudieron leer los permisos. <button onClick={() => void refetch()}>Reintentar</button></p></div></Show>
      <For each={PERMISSION_IDS}>{id =>
        <SettingsRow title={t(labels[id][0])} description={t(labels[id][1])}>
          <SettingsSwitch label={t(labels[id][0])} checked={!!permissions()?.[id]} disabled={!permissions() || busy() !== null} onChange={() => void toggle(id)} />
        </SettingsRow>}
      </For>
      <SettingsRow title="Micrófono de Windows" description="Si el dictado no escucha, revisá que Windows le permita el micrófono a Syka.">
        <SettingsButton onClick={() => void systemMicrophone()}>Abrir configuración</SettingsButton>
      </SettingsRow>
    </Show>
  </SettingsGroup>;
}
