/**
 * Settings › Voz y transcripción › Parakeet v3: NVIDIA's model on this
 * computer, through Syka's own engine (syka-asr, transcribe.cpp). Its own
 * section, apart from Whisper: it uses the graphics card where it can and is
 * the recommended way to caption videos. Short texts: what it is, whether this
 * PC can run it, and the download.
 */
import { createResource, createSignal, For, onCleanup, Show } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import type { ParakeetStatus } from '@desktop/local-voice/parakeet';
import { mainBridge } from '@/lib/ipc';
import { openSettings } from './state';
import { SettingsButton, SettingsGroup, SettingsRow } from './kit';

const SIZE_MB = 741;

/**
 * What a 10-minute video takes. Measured on a GTX 1660 Ti (1,1 s for 50 s) and
 * a Ryzen 5 5600G without the card (5 s for 50 s); the slow tier is an estimate.
 */
const REQUIREMENTS = [
  { label: 'Con placa de video', detail: 'GTX 1650 o mejor, 4 GB', time: '~15 segundos' },
  { label: 'Sin placa, procesador reciente', detail: 'Ryzen 5 o Core i5 de los últimos años', time: '~1 minuto' },
  { label: 'PC modesta', detail: 'GT 1030, Ryzen 3, Core i3 o menos de 8 GB de RAM', time: 'Lento: mejor Groq' },
] as const;
/** Settings sections that show who transcribes captions listen to this. */
export const CAPTIONS_CHANGED = 'syka:captions-provider';

/** «Whispera» for its folders, otherwise the folder itself. */
const appName = (location: string | null) => location && /whispera/i.test(location) ? 'Whispera' : location && /atelier/i.test(location) ? 'Syka Code' : location ?? 'otra app';

export function ParakeetSettings() {
  const call = (action: 'status' | 'download' | 'cancel' | 'delete' | 'warmup' | 'scan' | 'pickFolder') => mainBridge.call(MAIN_CHANNELS.SYKA_PARAKEET, { action });
  const [status, { mutate }] = createResource(async () => {
    if (!window.desktop) return null;
    const first = await call('status');
    // Syka is still checking copies other apps downloaded (Whispera): follow until it knows.
    if (first.scanning) queueMicrotask(() => follow(value => !value.scanning));
    return first;
  });
  const [confirming, setConfirming] = createSignal(false);
  const [captions, { refetch: refetchCaptions }] = createResource(async () => window.desktop ? mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_STATUS, undefined) : null);
  const useForCaptions = async () => {
    try {
      await mainBridge.call(MAIN_CHANNELS.SYKA_TRANSCRIPTION_CONFIGURE, { active: 'parakeet' });
      await refetchCaptions();
      window.dispatchEvent(new CustomEvent(CAPTIONS_CHANGED));
      toast.success('Parakeet v3 transcribe tus videos', { description: 'Lo cambiás cuando quieras en «Subtítulos de videos».' });
    } catch (error) { toast.error('No se pudo elegir Parakeet', { description: error instanceof Error ? error.message : 'Error inesperado.' }); }
  };
  let poll: ReturnType<typeof setInterval> | undefined;
  const follow = (until: (next: ParakeetStatus) => boolean, done?: (next: ParakeetStatus) => void) => {
    clearInterval(poll);
    poll = setInterval(async () => {
      const next = await call('status').catch(() => null);
      if (!next) return;
      mutate(next);
      if (!until(next)) return;
      clearInterval(poll);
      done?.(next);
    }, 400);
  };
  onCleanup(() => clearInterval(poll));
  const act = async (action: 'download' | 'cancel' | 'delete' | 'warmup' | 'pickFolder') => {
    try {
      const next = await call(action);
      mutate(next);
      if (action === 'download' && next.download) follow(value => !value.download, value => value.error
        ? toast.error('No se pudo descargar Parakeet', { description: value.error })
        : (toast.success('Parakeet v3 listo', { description: 'Probando tu placa de video…' }), void act('warmup')));
      if (action === 'warmup') follow(value => value.state !== 'starting');
      if (action === 'pickFolder' && !next.installed) toast.error('No encontré Parakeet en esa carpeta', { description: 'Tiene que estar el archivo parakeet-tdt-0.6b-v3-Q8_0.gguf original, junto con el de Silero.' });
    } catch (error) { toast.error('No se pudo completar', { description: error instanceof Error ? error.message : 'Error inesperado.' }); }
  };
  const percent = (current: ParakeetStatus) => current.download?.totalBytes ? Math.min(100, Math.round(current.download.receivedBytes / current.download.totalBytes * 100)) : 0;
  const modelText = (current: ParakeetStatus) => {
    if (current.download) return current.download.phase === 'verifying' ? 'Verificando…' : `Descargando · ${percent(current)}%`;
    if (current.scanning) return 'Buscando si ya lo tenés instalado…';
    if (!current.installed) return `Descargalo una vez (${SIZE_MB} MB). Después funciona sin internet.`;
    const where = current.source === 'external' ? ` · usa el de ${appName(current.location)}` : '';
    if (current.device) return (current.cpuFallback ? `Con el procesador (la placa no se pudo usar) · ${current.device}` : `Listo · ${current.device}`) + where;
    if (current.source === 'external') return `Encontrado en ${appName(current.location)}: se usa ahí mismo, sin descargarlo.`;
    if (current.state === 'starting') return 'Cargando el modelo…';
    if (current.device) return current.cpuFallback ? `Con el procesador (la placa no se pudo usar) · ${current.device}` : `Listo · ${current.device}`;
    return current.error ?? 'Descargado. Tocá «Probar» para ver en qué corre.';
  };

  return <Show when={status()}>{current =>
    <SettingsGroup title={<span class="inline-flex items-center gap-2">Parakeet v3 <span class="syka-settings-badge">Recomendado</span></span>}
      description="Un modelo que pasa a texto el audio de tus videos en tu propia PC: sin internet, sin clave y sin enviar el audio a nadie. Reconoce solo el idioma: español y otros 24 europeos."
      footnote="Parakeet TDT 0.6B v3 de NVIDIA (CC-BY-4.0) · transcribe.cpp y Silero VAD (MIT). Para otros idiomas usá Groq.">
      <Show when={current().engineReady} fallback={<SettingsRow title="No disponible en esta instalación" description="Usá Groq o Whisper en este equipo." />}>
        <SettingsRow title="Modelo" description={modelText(current())}>
          <div class="flex items-center gap-2">
            <Show when={current().download}><SettingsButton tone="quiet" onClick={() => void act('cancel')}>Cancelar</SettingsButton></Show>
            <Show when={!current().download && !current().installed && !current().scanning}>
              <SettingsButton tone="quiet" onClick={() => void act('pickFolder')}>Ya lo tengo</SettingsButton>
              <SettingsButton onClick={() => void act('download')}>Descargar</SettingsButton>
            </Show>
            <Show when={current().installed}>
              <Show when={!current().device && current().state !== 'starting'}><SettingsButton tone="quiet" onClick={() => void act('warmup')}>Probar</SettingsButton></Show>
              <Show when={current().source === 'syka'}><Show when={confirming()} fallback={<SettingsButton tone="quiet" onClick={() => setConfirming(true)}>Borrar</SettingsButton>}>
                <SettingsButton tone="quiet" onClick={() => setConfirming(false)}>No</SettingsButton>
                <SettingsButton onClick={() => { setConfirming(false); void act('delete'); }}>Sí, borrar</SettingsButton>
              </Show></Show>
            </Show>
          </div>
        </SettingsRow>
      </Show>
      <Show when={current().installed && current().engineReady}>
        <SettingsRow title="Usarlo" description={captions()?.active === 'parakeet' ? 'Ya transcribe tus videos. Para dictar, elegilo en «Dictado», más abajo.' : 'Todavía no transcribe nada: elegilo para los subtítulos de tus videos.'}>
          <Show when={captions()?.active !== 'parakeet'} fallback={<span class="syka-settings-badge">En uso para subtítulos</span>}>
            <SettingsButton onClick={() => void useForCaptions()}>Usar para subtítulos</SettingsButton>
          </Show>
        </SettingsRow>
      </Show>
      <SettingsRow title="¿Cuánto tarda en mi PC?" description="Un video de 10 minutos:" below>
        <div class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[12px]">
          <For each={REQUIREMENTS}>{item => <>
            <span><b class="font-medium text-[var(--z-text)]">{item.label}</b><span class="text-[var(--z-muted)]"> · {item.detail}</span></span>
            <span class="text-right text-[var(--z-text)]">{item.time}</span>
          </>}</For>
        </div>
      </SettingsRow>
      <SettingsRow title="Palabras que salen mal" description="Corregilas en el glosario (por ejemplo, «grog» → Groq).">
        <SettingsButton tone="quiet" onClick={() => openSettings('glossary')}>Abrir glosario</SettingsButton>
      </SettingsRow>
    </SettingsGroup>}
  </Show>;
}
