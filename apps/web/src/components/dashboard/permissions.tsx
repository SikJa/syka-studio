import { createResource, createSignal, For, Show } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { PERMISSION_IDS, type StudioPermission } from '@desktop/syka-permission-types';
import { mainBridge } from '@/lib/ipc';
import { Button } from '@/components/ui/button';
import { DashboardSurfaceSection, DashboardDividedStack, DashboardInfoActionRow } from './shared';
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
  return <DashboardSurfaceSection title="Permisos" description="Vos elegís los accesos de Syka Studio. Los cambios se guardan en este equipo.">
    <Show when={window.desktop} fallback={<p class="text-xs text-muted-foreground">En el navegador, abrí los permisos del sitio desde el icono junto a la dirección. Los bloqueos se cambian ahí. En la aplicación de escritorio podés configurarlos desde este apartado.</p>}>
      <Show when={permissions.error}><p role="alert" class="text-xs">No se pudieron leer los permisos. <button onClick={() => void refetch()}>Reintentar</button></p></Show>
      <DashboardDividedStack><For each={PERMISSION_IDS}>{id => <DashboardInfoActionRow title={t(labels[id][0])} description={t(labels[id][1])} action={
        <Button variant={permissions()?.[id] ? 'on' : 'secondary'} role="switch" aria-label={t(labels[id][0])} aria-checked={!!permissions()?.[id]} disabled={!permissions() || busy() !== null} onClick={() => void toggle(id)}>{busy() === id ? 'Guardando…' : permissions()?.[id] ? 'Permitido' : 'Bloqueado'}</Button>
      } />}</For></DashboardDividedStack>
      <Button variant="ghost" onClick={() => void systemMicrophone()}>Revisar el micrófono en el sistema</Button>
      <p class="text-xs text-muted-foreground mt-2">Permitir un acceso no inicia grabaciones ni lee el portapapeles. Tus proyectos se guardan como archivos en la carpeta elegida.</p>
    </Show>
  </DashboardSurfaceSection>;
}
