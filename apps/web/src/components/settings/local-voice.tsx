/**
 * Settings › Voz y transcripción › En este equipo: the Whisper models that run
 * on this computer (whisper.cpp), after Syka Code's local voice settings.
 * Downloads are verified by main; this page polls their progress.
 */
import { createResource, createSignal, For, onCleanup, Show } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import type { LocalVoiceModel, LocalVoiceStatus } from '@desktop/local-voice/local-voice';
import { mainBridge } from '@/lib/ipc';
import { SettingsButton, SettingsGroup, SettingsRow } from './kit';

const MODEL_INFO: Record<LocalVoiceModel, { name: string; note: string }> = {
  base: { name: 'Whisper Base', note: 'Rápido, para dictados cortos.' },
  small: { name: 'Whisper Small', note: 'Equilibrado.' },
  turbo: { name: 'Whisper Large V3 Turbo', note: 'El más preciso, pero lento sin una CPU potente.' },
};
const megabytes = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

export function LocalVoiceSettings() {
  const call = (request: { action: 'status' | 'download' | 'cancel' | 'delete' | 'choose' | 'pickFolder'; model?: LocalVoiceModel }) => mainBridge.call(MAIN_CHANNELS.SYKA_LOCAL_VOICE, request);
  const [status, { mutate }] = createResource(async () => window.desktop ? call({ action: 'status' }) : null);
  const [confirming, setConfirming] = createSignal<LocalVoiceModel | null>(null);
  let poll: ReturnType<typeof setInterval> | undefined;
  let lastError: string | null = null;
  const follow = () => {
    clearInterval(poll);
    poll = setInterval(async () => {
      const next = await call({ action: 'status' }).catch(() => null);
      if (!next) return;
      mutate(next);
      if (next.download) return;
      clearInterval(poll);
      if (next.error && next.error !== lastError) toast.error('No se pudo descargar el modelo', { description: next.error });
      else if (!next.error) toast.success('Modelo listo', { description: 'Ya podés transcribir en este equipo, sin internet.' });
      lastError = next.error;
    }, 400);
  };
  onCleanup(() => clearInterval(poll));
  const act = async (request: Parameters<typeof call>[0]) => {
    try {
      const next = await call(request);
      mutate(next);
      if (next.download) follow();
    } catch (error) { toast.error('No se pudo completar', { description: error instanceof Error ? error.message : 'Error inesperado.' }); }
  };

  const progress = (current: LocalVoiceStatus) => {
    const download = current.download!;
    const percent = download.totalBytes ? Math.min(100, Math.round(download.receivedBytes / download.totalBytes * 100)) : 0;
    return download.phase === 'verifying' ? 'Verificando…' : download.phase === 'runtime' ? `Preparando el motor · ${percent}%` : `Descargando · ${percent}%`;
  };

  return <Show when={status()} fallback={<Show when={!window.desktop}><p class="syka-settings-page-description">Los modelos locales se descargan en la aplicación de escritorio.</p></Show>}>{current =>
    <SettingsGroup title="Whisper en este equipo" description="Alternativa a Parakeet, con el procesador. Acepta un idioma fijo."
      footnote={!current().supported ? 'Esta instalación no trae el motor local.' : current().engine === 'syka-asr' ? 'Corre en el motor de Parakeet (transcribe.cpp, MIT). En este sistema sirve para dictar: para subtítulos usá Parakeet.' : 'whisper.cpp (MIT) · la primera descarga suma 9 MB del motor.'}>
      <For each={current().models}>{model => {
        const info = MODEL_INFO[model.id];
        const downloading = () => current().download?.model === model.id;
        const inUse = () => current().readyModel === model.id;
        return <SettingsRow title={info.name} description={`${info.note} ${megabytes(model.sizeBytes)}.${model.external ? ' · De otra app, se usa ahí mismo' : ''}${inUse() ? ' · En uso' : ''}${downloading() ? ` · ${progress(current())}` : ''}`}>
          <div class="flex items-center gap-2">
            <Show when={downloading()}>
              <SettingsButton tone="quiet" onClick={() => void act({ action: 'cancel' })}>Cancelar</SettingsButton>
            </Show>
            <Show when={!downloading() && !model.installed}>
              <SettingsButton disabled={!current().supported || !!current().download} onClick={() => void act({ action: 'download', model: model.id })}>Descargar</SettingsButton>
            </Show>
            <Show when={model.installed}>
              <Show when={!inUse()}><SettingsButton tone="quiet" onClick={() => void act({ action: 'choose', model: model.id })}>Usar</SettingsButton></Show>
              <Show when={!model.external}><Show when={confirming() === model.id} fallback={<SettingsButton tone="quiet" onClick={() => setConfirming(model.id)}>Borrar</SettingsButton>}>
                <SettingsButton tone="quiet" onClick={() => setConfirming(null)}>No</SettingsButton>
                <SettingsButton onClick={() => { setConfirming(null); void act({ action: 'delete', model: model.id }); }}>Sí, borrar</SettingsButton>
              </Show></Show>
            </Show>
          </div>
        </SettingsRow>;
      }}</For>
      <SettingsRow title="¿Ya tenés modelos de Whisper?" description={current().scanning ? 'Buscando…' : 'Elegí la carpeta donde están (archivos ggml-*.bin) y se usan sin descargarlos.'}>
        <SettingsButton tone="quiet" disabled={current().scanning} onClick={() => void act({ action: 'pickFolder' })}>Buscar en una carpeta</SettingsButton>
      </SettingsRow>
      <Show when={current().error && !current().download}>
        <SettingsRow title="La última descarga falló" description={current().error!} />
      </Show>
    </SettingsGroup>}
  </Show>;
}
