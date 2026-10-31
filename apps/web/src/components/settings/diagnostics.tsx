import { createResource, For, Show } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import type { AppDiagnostics } from '@desktop/diagnostics';
import type { HostDiagnostics } from '@diffusionstudio/agent-chat';
import { mainBridge } from '@/lib/ipc';
import { client } from '@/agent-chat/connection';
import { chatOpenTimings } from '@/agent-chat/store';
import { Button } from '@/components/ui/button';
import { DashboardScrollView, DashboardSurfaceSection } from '@/components/dashboard/shared';

const size = (bytes: number) => { const unit = bytes >= 1024 ** 3 ? 3 : bytes >= 1024 ** 2 ? 2 : bytes >= 1024 ? 1 : 0; return `${(bytes / 1024 ** unit).toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${['B', 'KB', 'MB', 'GB'][unit]}`; };
const seconds = (ms?: number) => ms === undefined ? '—' : `${(ms / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s`;
const ago = (at?: number) => { if (!at) return 'sin comprobar'; const minutes = Math.round((Date.now() - at) / 60_000); return minutes < 1 ? 'recién' : `hace ${minutes} min`; };
const STATUS: Record<string, string> = { ready: 'Conectado', checking: 'Comprobando', 'signed-out': 'Sin sesión', 'not-installed': 'No instalado', error: 'Con error' };
const PROCESS: Record<string, string> = { Browser: 'Principal', Tab: 'Ventana', GPU: 'Gráficos', Utility: 'Servicio' };

type Report = { app: AppDiagnostics | null; host: HostDiagnostics | null; hostError?: string };
/** CPU is averaged over a short window: Electron reports usage since its previous sample. */
async function measure(): Promise<Report> {
  const app = window.desktop ? await mainBridge.call(MAIN_CHANNELS.SYKA_DIAGNOSTICS, undefined).then(async () => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return mainBridge.call(MAIN_CHANNELS.SYKA_DIAGNOSTICS, undefined);
  }) : null;
  try { return { app, host: client.state === 'open' ? await client.request('diagnostics', {}) : null }; }
  catch (error) { return { app, host: null, hostError: error instanceof Error ? error.message : String(error) }; }
}

function reportText(report: Report): string {
  const lines = [`Syka Studio ${report.app?.version ?? ''} · datos en ${report.app?.runtimeRoot ?? '—'}`];
  for (const process of report.app?.processes ?? []) lines.push(`Proceso ${PROCESS[process.type] ?? process.type}${process.name ? ` (${process.name})` : ''}: ${process.cpuPercent}% CPU, ${process.memoryMB} MB`);
  for (const provider of report.host?.providers ?? []) lines.push(`Proveedor ${provider.label}: ${STATUS[provider.status] ?? provider.status}, ${provider.models} modelos, última comprobación ${seconds(provider.durationMs)}`);
  if (report.host) lines.push(`Chats: ${report.host.chats.count}, historial ${size(report.host.chats.historyBytes)}, imágenes ${size(report.host.chats.imageBytes)}, sin migrar ${report.host.chats.inlineImageChats}`);
  for (const timing of chatOpenTimings()) lines.push(`Apertura de chat: ${seconds(timing.ms)}, ${timing.items} mensajes visibles`);
  return lines.join('\n');
}

/** Read-only health view: timings, sizes and process usage, never chat content. */
export function DiagnosticsSettings() {
  const [report, { refetch }] = createResource(measure);
  const copy = async () => {
    const value = report(); if (!value) return;
    try { await navigator.clipboard.writeText(reportText(value)); toast.success('Informe copiado'); }
    catch { toast.error('No se pudo copiar el informe.'); }
  };
  const processes = () => [...(report()?.app?.processes ?? [])].sort((a, b) => b.cpuPercent - a.cpuPercent);
  return <DashboardScrollView>
    <DashboardSurfaceSection title="Uso de la app ahora" description="Promedio de un segundo y medio. En reposo, todos los procesos deberían estar cerca de 0 %.">
      <Show when={!report.loading} fallback={<div class="syka-skeleton syka-skeleton-line" style={{ width: '100%', height: '48px' }} aria-label="Midiendo" />}>
        <Show when={report()?.app} fallback={<p class="text-xs text-muted-foreground">Disponible en la app de escritorio.</p>}>{app => <>
          <For each={processes()}>{process => <div class="syka-settings-row"><div><p>{PROCESS[process.type] ?? process.type}</p><small>{process.name ?? ''}</small></div><span class="syka-storage-size">{process.cpuPercent.toLocaleString('es-AR')} % · {process.memoryMB} MB</span></div>}</For>
          <p class="syka-storage-path">Datos en {app().runtimeRoot} · versión {app().version} · abierta hace {Math.round(app().uptimeSeconds / 60)} min</p>
        </>}</Show>
      </Show>
    </DashboardSurfaceSection>
    <DashboardSurfaceSection title="Proveedores" description="Estado y duración de la última comprobación de cada conexión.">
      <Show when={report()?.hostError}><p role="alert" class="syka-settings-error">El host de chat no respondió: {report()!.hostError}</p></Show>
      <For each={report()?.host?.providers}>{provider => <div class="syka-settings-row"><div><p>{provider.label}</p><small>{STATUS[provider.status] ?? provider.status}{provider.cached ? ' · usando el catálogo guardado' : ''} · {provider.models} modelos · {ago(provider.checkedAt)}</small></div><span class="syka-storage-size">{seconds(provider.durationMs)}</span></div>}</For>
    </DashboardSurfaceSection>
    <DashboardSurfaceSection title="Historial de chats" description="Tamaño en disco. Los chats con capturas antiguas se aligeran la primera vez que los abrís.">
      <Show when={report()?.host?.chats}>{chats => <>
        <div class="syka-storage-summary"><div><span>{chats().count} chats · {chats().inlineImageChats} por aligerar</span><strong>{size(chats().historyBytes + chats().imageBytes)}</strong></div></div>
        <For each={chats().largest}>{chat => <div class="syka-settings-row"><div><p>{chat.title || 'Sin título'}</p><small>Historial {size(chat.historyBytes)} · imágenes {size(chat.imageBytes)}</small></div></div>}</For>
      </>}</Show>
    </DashboardSurfaceSection>
    <DashboardSurfaceSection title="Apertura de chats" description="Desde que se pidió cada chat hasta que su historial llegó a la ventana, en esta sesión.">
      <Show when={chatOpenTimings().length} fallback={<p class="text-xs text-muted-foreground">Todavía no se abrió ningún chat en esta sesión.</p>}>
        <For each={chatOpenTimings()}>{timing => <div class="syka-settings-row"><div><p>{timing.title || 'Sin título'}</p><small>{timing.items} mensajes visibles</small></div><span class="syka-storage-size">{seconds(timing.ms)}</span></div>}</For>
      </Show>
    </DashboardSurfaceSection>
    <div class="flex gap-2">
      <Button variant="secondary" disabled={report.loading} onClick={() => void refetch()}>{report.loading ? 'Midiendo…' : 'Volver a medir'}</Button>
      <Button variant="ghost" disabled={!report()} onClick={() => void copy()}>Copiar informe</Button>
    </div>
  </DashboardScrollView>;
}
