import { createResource, For, Show } from 'solid-js';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { DashboardProjectsFolderSection } from '@/components/dashboard/settings-view';
import { DashboardScrollView, DashboardSurfaceSection } from '@/components/dashboard/shared';
import { listProjects, projectsRoot } from '@/projects';
import { StoragePolicySettings } from './storage-policy';

function size(bytes: number) { const unit = bytes >= 1024 ** 3 ? 3 : bytes >= 1024 ** 2 ? 2 : bytes >= 1024 ? 1 : 0; return `${(bytes / 1024 ** unit).toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${['B', 'KB', 'MB', 'GB'][unit]}`; }
export function StorageSettings() {
  const [state, { refetch }] = createResource(() => projectsRoot() ?? '', async () => {
    const projects = await listProjects();
    const [native, browser] = await Promise.all([window.desktop ? mainBridge.call(MAIN_CHANNELS.SYKA_STUDIO_SETTINGS, { action: 'storage', projects: projects.map(project => ({ name: project.displayName, path: project.dir })) }) : null, navigator.storage?.estimate?.().catch(() => null)]);
    return { native: native?.storage, browser };
  });
  return <DashboardScrollView>
    <StoragePolicySettings />
    <DashboardProjectsFolderSection />
    <DashboardSurfaceSection title="Espacio de los proyectos" description="Archivos guardados dentro de las carpetas de tus proyectos.">
      <Show when={!state.loading} fallback={<p role="status" class="text-xs text-muted-foreground">Midiendo proyectos…</p>}>
        <Show when={state()?.native?.projects} fallback={<p class="text-xs text-muted-foreground">La medición de proyectos requiere la versión actual de Syka para escritorio.</p>}>{projects => <>
          <div class="syka-storage-summary"><div><span>{projects().length} proyectos · {projects().some(project => project.partial || project.unavailable) ? 'medición parcial' : 'total en sus carpetas'}</span><strong>{projects().some(project => project.partial || project.unavailable) ? '≥ ' : ''}{size(projects().reduce((total, project) => total + project.bytes, 0))}</strong></div></div>
          <For each={projects()}>{project => <div class="syka-settings-row"><div><p>{project.name}</p><small>{project.unavailable ? 'Carpeta no disponible' : `${project.files} archivos${project.partial ? ' · medición parcial' : ''}${project.availableBytes === undefined ? '' : ` · ${size(project.availableBytes)} libres en su disco`}`}</small><p class="syka-storage-path">{project.path}</p></div><div class="flex items-center gap-2"><span class="syka-storage-size">{project.unavailable ? '—' : `${project.partial ? '≥ ' : ''}${size(project.bytes)}`}</span><Button size="icon-square" variant="ghost" title="Mostrar carpeta del proyecto" aria-label={`Mostrar carpeta de ${project.name}`} onClick={() => void mainBridge.call(MAIN_CHANNELS.APP_SHOW_IN_FOLDER, { path: project.path })}><Icon name="navigation.folder" class="size-4"/></Button></div></div>}</For>
          <p class="text-xxs text-muted-foreground">Los medios enlazados desde otras carpetas no se suman. Las carpetas no disponibles y los recorridos incompletos se indican arriba.</p>
        </>}</Show>
      </Show>
    </DashboardSurfaceSection>
    <DashboardSurfaceSection title="Datos de Syka" description="Borradores, preferencias y recursos que se conservan en este equipo.">
      <Show when={state.error}><p role="alert" class="syka-settings-error">No se pudo medir el almacenamiento. {String(state.error)}</p></Show>
      <Show when={!state.loading} fallback={<p role="status" class="text-xs text-muted-foreground">Midiendo archivos locales…</p>}>
        <Show when={state()?.native}>{native => <>
          <div class="syka-storage-summary"><div><span>Espacio disponible en el disco del perfil</span><strong>{native().availableBytes === undefined ? 'No disponible' : size(native().availableBytes!)}</strong></div><Button variant="ghost" onClick={() => void mainBridge.call(MAIN_CHANNELS.APP_SHOW_IN_FOLDER, { path: native().profile })}>Mostrar ubicación</Button></div>
          <For each={native().areas}>{area => <div class="syka-settings-row"><div><p>{area.name}</p><small>{area.unavailable ? 'No se pudo leer' : `${area.files} archivos${area.partial ? ' · medición parcial' : ''}`}</small></div><span class="syka-storage-size">{area.partial ? '≥ ' : ''}{area.unavailable ? '—' : size(area.bytes)}</span></div>}</For>
          <p class="syka-storage-path">{native().profile}</p>
        </>}</Show>
        <Show when={state()?.browser?.usage !== undefined}><div class="syka-settings-row"><div><p>Uso informado por el navegador</p><small>Estimación del almacenamiento del editor, incluidos proyectos importados.</small></div><span class="syka-storage-size">{size(state()!.browser!.usage!)}</span></div></Show>
        <p class="text-xxs text-muted-foreground">Los videos exportados y las carpetas de proyectos se conservan en las ubicaciones que elegiste.</p>
      </Show>
      <Button variant="secondary" class="self-start" disabled={state.loading} onClick={() => void refetch()}>{state.loading ? 'Midiendo…' : 'Actualizar uso'}</Button>
    </DashboardSurfaceSection>
  </DashboardScrollView>;
}
