import { createRoot, createSignal, onMount, For, Show } from 'solid-js';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { Button } from '@/components/ui/button';
import { DashboardSurfaceSection } from './shared';
import type { DependencyProgress, DependencyStatus } from '@desktop/dependency-types';
import { t } from '@/i18n';
import { toast } from 'somoto';
import { openSettings } from '@/components/settings/state';

const store = createRoot(() => ({
  status: createSignal<DependencyStatus | null>(null),
  setup: createSignal<DependencyProgress>({ phase: 'idle' }),
  loading: createSignal(false),
  error: createSignal<string | null>(null),
}));
const [status, setStatus] = store.status, [setup, setSetup] = store.setup;
const [loading, setLoading] = store.loading, [error, setError] = store.error;
let connected = false;
async function refetch() {
  if (!window.desktop) return;
  setLoading(true);
  try {
    const value = await mainBridge.call(MAIN_CHANNELS.SYKA_DEPENDENCIES, { action: 'status' });
    setStatus(value); setSetup(value.setup); setError(null);
  } catch (cause) { setError(String(cause)); }
  finally { setLoading(false); }
}
function connect() {
  if (connected || !window.desktop) return;
  connected = true;
  mainBridge.handle(MAIN_CHANNELS.SYKA_DEPENDENCIES_CHANGED, value => {
    setSetup(value);
    if (value.phase !== 'installing') void refetch();
  });
  void refetch();
}
async function install() {
  try {
    const value = await mainBridge.call(MAIN_CHANNELS.SYKA_DEPENDENCIES, { action: 'install' });
    setStatus(value); setSetup(value.setup);
  } catch (cause) { toast.error(t('No se pudieron configurar las herramientas'), { description: t((cause as Error).message) }); }
}

/** First-run setup remains visible without opening Settings. One IPC subscription
 * is shared with the settings page, including when either view is remounted. */
export function DependencySetupNotice() {
  onMount(connect);
  return <Show when={setup().phase === 'installing' || setup().phase === 'error'}>
    <div class="mx-3 mt-2 rounded-md border border-border bg-accent px-3 py-2 text-xxs text-muted-foreground" role={setup().phase === 'error' ? 'alert' : 'status'}>
      <Show when={setup().phase === 'installing'} fallback={<button type="button" class="text-left focus-ring" onClick={() => openSettings('tools')}>{t('No se pudieron configurar las herramientas')} · {t('Configuración')} ↗</button>}>
        <p>{t('Configurando herramientas…')} {setup().tool} {setup().percent ?? 0}%</p>
        <p class="mt-1">{t('Podés seguir usando el editor durante la descarga.')}</p>
      </Show>
    </div>
  </Show>;
}

const purposes: Record<string, string> = {
  codex: 'Chat del agente · requiere tu sesión de Codex', node: 'Scripts y componentes del agente',
  git: 'Trabajo con repositorios', python: 'Procesamiento y audio con código',
  ffmpeg: 'Mejora de audio y conversión', ffprobe: 'Medición de medios',
  'yt-dlp': 'Descarga de referencias de video',
};
export function DependencySettings() {
  onMount(connect);
  const progress = setup;
  return <Show when={window.desktop}><DashboardSurfaceSection title="Herramientas locales">
    <div class="flex flex-col gap-3 text-xs">
      <p>El editor puede previsualizar y exportar sin Python ni FFmpeg. Estas herramientas amplían las tareas del agente.</p>
      <Show when={status()?.packaged}><p class="text-muted-foreground">El instalador configura Node.js, FFmpeg y yt-dlp cuando faltan. Se descargan versiones verificadas del proveedor, sin modificar las instalaciones del sistema.</p></Show>
      <Show when={progress()?.phase === 'installing'}><p role="status">{t('Configurando herramientas…')} {progress()?.tool} {progress()?.percent ?? 0}%</p></Show>
      <Show when={progress()?.phase === 'error'}><p role="alert">{t(progress()?.message)}</p></Show>
      <Show when={error()}><p role="alert">No se pudo comprobar: {error()}</p></Show>
      <For each={status()?.tools}>{tool => <div class="border-b border-border pb-2">
        <div class="flex items-center justify-between gap-2"><span class="font-medium">{tool.name}</span><span class={tool.path ? 'text-foreground' : 'text-muted-foreground'}>{tool.path ? 'Encontrado' : 'No encontrado'}</span></div>
        <p class="text-muted-foreground mt-1">{t(purposes[tool.name])}</p>
        <Show when={tool.path}><p class="mt-1 break-all select-text text-muted-foreground">{tool.path}</p></Show>
        <Show when={tool.issue}><p role="alert" class="mt-1">{tool.issue}</p></Show>
      </div>}</For>
      <p class="text-muted-foreground">Se buscan instalaciones locales y herramientas del paquete. Encontrado indica que existe el ejecutable; no verifica login, versiones ni sus dependencias internas.</p>
      <Button variant="secondary" disabled={loading()} onClick={() => void refetch()}>{loading() ? 'Comprobando…' : 'Volver a comprobar'}</Button>
      <Show when={status()?.packaged}><Button variant="secondary" disabled={progress()?.phase === 'installing'} onClick={() => void install()}>Configurar herramientas faltantes</Button></Show>
    </div>
  </DashboardSurfaceSection></Show>;
}
