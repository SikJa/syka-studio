/**
 * Settings › Voz y transcripción › Subtítulos de videos: who transcribes
 * videos (Groq, OpenAI or any OpenAI-compatible service that returns word
 * timings) and each one's key. Keys enter main once, encrypted, and never
 * come back to this page.
 */
import { createResource, createSignal, For, onCleanup, Show, type JSX } from 'solid-js';
import { CAPTIONS_CHANGED } from './parakeet';
import { toast } from 'somoto';
import { MAIN_CHANNELS, type SykaCaptionProvider, type SykaGroqStatus, type SykaKeyedProvider } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import GroqLogo from '@/assets/providers/groq.svg';
import OpenAiMark from '@/assets/icons/large-openai.svg';
import { SettingsButton, SettingsGroup, SettingsRow, SettingsSelect } from './kit';

type Info = { name: string; model: string; keyHint: string; keysUrl?: string; icon: () => JSX.Element };
const CompatibleMark = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 12h3l2-5 3 10 2-5h6" /></svg>;
const INFO: Record<SykaKeyedProvider, Info> = {
  groq: { name: 'Groq', model: 'Whisper Large V3 Turbo', keyHint: 'gsk_…', keysUrl: 'https://console.groq.com/keys', icon: () => <GroqLogo /> },
  openai: { name: 'OpenAI', model: 'whisper-1', keyHint: 'sk-…', keysUrl: 'https://platform.openai.com/api-keys', icon: () => <span class="inline-grid size-[30px] place-items-center [&>svg]:!size-[30px]"><OpenAiMark /></span> },
  compatible: { name: 'Compatible con OpenAI', model: 'el modelo que elijas', keyHint: 'La clave del servicio', icon: CompatibleMark },
};
const ORDER: SykaKeyedProvider[] = ['groq', 'openai', 'compatible'];
const captionName = (status: SykaGroqStatus) => status.active === 'parakeet' ? 'Parakeet v3' : status.active === 'local' ? 'Whisper en este equipo' : status.active === 'compatible' ? status.compatible?.name ?? INFO.compatible.name : INFO[status.active].name;

export function GroqKeySettings() {
  const [status, { mutate, refetch }] = createResource(async () => window.desktop ? mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_STATUS, undefined) : null);
  // «Usar para subtítulos» in the Parakeet section changes the provider shown here.
  const changed = () => void refetch();
  window.addEventListener(CAPTIONS_CHANGED, changed);
  onCleanup(() => window.removeEventListener(CAPTIONS_CHANGED, changed));
  const [editing, setEditing] = createSignal<SykaKeyedProvider | null>(null);
  const [key, setKey] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [service, setService] = createSignal({ name: '', baseUrl: '', model: '' });
  const [serviceOpen, setServiceOpen] = createSignal(false);
  const [serviceKey, setServiceKey] = createSignal('');
  const [detected, setDetected] = createSignal<{ models: string[]; transcription: boolean } | null>(null);
  const [detecting, setDetecting] = createSignal(false);

  const run = async (work: () => Promise<SykaGroqStatus>, done?: string) => {
    setSaving(true);
    try { mutate(await work()); if (done) toast.success(done, { description: 'No se hizo ninguna llamada al servicio.' }); return true; }
    catch (error) { toast.error('No se pudo guardar', { description: error instanceof Error ? error.message : 'Error de configuración.' }); return false; }
    finally { setSaving(false); }
  };
  const saveKey = async (provider: SykaKeyedProvider, clear = false) => {
    if (await run(() => mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_SET_KEY, { key: clear ? '' : key(), provider }), clear ? `Clave de ${INFO[provider].name} eliminada` : `Clave de ${INFO[provider].name} guardada`)) { setKey(''); setEditing(null); }
  };
  const choose = (active: SykaCaptionProvider) => {
    if (active === 'compatible' && !status()?.compatible) { openService(); return; }
    void run(() => mainBridge.call(MAIN_CHANNELS.SYKA_TRANSCRIPTION_CONFIGURE, { active }));
  };
  const openService = () => {
    const current = status()?.compatible;
    setService({ name: current?.name ?? '', baseUrl: current?.baseUrl ?? '', model: current?.model ?? '' });
    setServiceKey(''); setDetected(current ? { models: [current.model], transcription: true } : null); setServiceOpen(true);
  };
  /** Asks the service for its models (no audio, no cost) so the model is picked, not typed. */
  const detect = async () => {
    setDetecting(true);
    try {
      const result = await mainBridge.call(MAIN_CHANNELS.SYKA_TRANSCRIPTION_MODELS, { baseUrl: service().baseUrl, ...(serviceKey().trim() ? { key: serviceKey() } : {}) });
      setDetected(result);
      if (!result.models.includes(service().model)) setService({ ...service(), model: result.models[0] ?? '' });
    } catch (error) { setDetected(null); toast.error('No se pudieron detectar los modelos', { description: error instanceof Error ? error.message : 'Revisá la URL y la clave.' }); }
    finally { setDetecting(false); }
  };
  const saveService = async () => {
    const ok = await run(async () => {
      if (serviceKey().trim()) await mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_SET_KEY, { key: serviceKey(), provider: 'compatible' });
      return mainBridge.call(MAIN_CHANNELS.SYKA_TRANSCRIPTION_CONFIGURE, { active: 'compatible', compatible: service() });
    }, 'Servicio guardado');
    if (ok) { setServiceOpen(false); setServiceKey(''); }
  };
  const open = (url: string) => window.desktop ? void mainBridge.call(MAIN_CHANNELS.APP_OPEN_EXTERNAL, { url }) : void window.open(url, '_blank', 'noopener');
  const activeName = () => { const current = status(); return current ? captionName(current) : ''; };
  const readiness = () => {
    const current = status();
    if (status.loading || !current) return 'Leyendo la configuración…';
    if (current.active === 'parakeet') return current.configured ? 'Parakeet v3 · listo, en tu PC.' : 'Parakeet v3 · descargalo abajo.';
    if (current.active === 'local') return current.configured ? `Whisper ${current.model} · listo, en tu PC.` : 'Whisper · descargá un modelo abajo.';
    return current.configured ? `${activeName()} · listo.` : `${activeName()} · falta su clave.`;
  };

  return <Show when={window.desktop} fallback={<p class="syka-settings-page-description">La transcripción se configura en la aplicación de escritorio.</p>}>
    <SettingsGroup title="Subtítulos de videos" description="Quién transcribe tus videos. Recomendamos Parakeet v3, en tu PC."
      footnote="Las claves se cifran con Windows y no vuelven a mostrarse.">
      <SettingsRow title="Quién transcribe" description={readiness()}>
        <SettingsSelect label="Quién transcribe" value={status()?.active ?? 'groq'} disabled={saving() || status.loading} onChange={value => choose(value as SykaCaptionProvider)}
          options={[...ORDER.map(provider => ({ value: provider as SykaCaptionProvider, label: provider === 'compatible' && status()?.compatible ? status()!.compatible!.name : INFO[provider].name })), { value: 'parakeet' as SykaCaptionProvider, label: 'Parakeet v3 · recomendado' }, { value: 'local' as SykaCaptionProvider, label: 'Whisper · este equipo' }]} />
      </SettingsRow>
      <For each={ORDER}>{provider => {
        const info = INFO[provider];
        const saved = () => !!status()?.keys[provider];
        return <>
          <SettingsRow icon={<span class="grid size-[18px] place-items-center [&_svg]:size-[18px]">{info.icon()}</span>}
            title={provider === 'compatible' && status()?.compatible ? status()!.compatible!.name : info.name}
            description={`${provider === 'compatible' ? status()?.compatible?.model ?? 'Cualquier servicio con API como la de OpenAI' : info.model} · ${saved() ? 'clave guardada' : 'sin clave'}${status()?.active === provider ? ' · en uso' : ''}`}>
            <div class="flex items-center gap-2">
              <Show when={info.keysUrl}><SettingsButton tone="quiet" onClick={() => open(info.keysUrl!)}>Obtener clave</SettingsButton></Show>
              <Show when={provider === 'compatible'}><SettingsButton tone="quiet" onClick={() => serviceOpen() ? setServiceOpen(false) : openService()}>{serviceOpen() ? 'Cerrar' : status()?.compatible ? 'Editar' : 'Configurar'}</SettingsButton></Show>
              <Show when={provider !== 'compatible'} fallback={<Show when={saved()}><SettingsButton tone="quiet" disabled={saving()} onClick={() => void saveKey(provider, true)}>Quitar clave</SettingsButton></Show>}>
                <Show when={saved()} fallback={<SettingsButton disabled={!status()?.secureStorage} onClick={() => { setKey(''); setEditing(provider); }}>Conectar</SettingsButton>}>
                  <SettingsButton tone="quiet" disabled={saving()} onClick={() => { setKey(''); setEditing(editing() === provider ? null : provider); }}>{editing() === provider ? 'Cancelar' : 'Cambiar'}</SettingsButton>
                  <SettingsButton tone="quiet" disabled={saving()} onClick={() => void saveKey(provider, true)}>Quitar</SettingsButton>
                </Show>
              </Show>
            </div>
          </SettingsRow>
          <Show when={provider === 'compatible' && serviceOpen()}>
            <SettingsRow title="URL de la API" description="La dirección que da el servicio para usarlo como OpenAI, por ejemplo https://api.servicio.com/v1.">
              <input class="syka-settings-input" placeholder="https://…/v1" value={service().baseUrl} onInput={event => { setService({ ...service(), baseUrl: event.currentTarget.value }); setDetected(null); }} />
            </SettingsRow>
            <SettingsRow title="Clave de API" description={saved() ? 'Ya hay una guardada. Escribí otra solo para reemplazarla.' : 'Se cifra con Windows y no vuelve a mostrarse.'}>
              <input class="syka-settings-input" type="password" autocomplete="off" placeholder={saved() ? '••••••••' : 'Pegá la clave'} value={serviceKey()} onInput={event => { setServiceKey(event.currentTarget.value); setDetected(null); }} />
            </SettingsRow>
            <SettingsRow title="Modelo" description={detected() ? detected()!.transcription ? 'Los modelos de voz que publica el servicio.' : 'El servicio no marca cuáles son de voz: elegí uno de transcripción.' : 'Syka le pide la lista al servicio. No envía audio ni consume cuota.'}>
              <Show when={detected()} fallback={<SettingsButton disabled={detecting() || !service().baseUrl.trim()} onClick={() => void detect()}>{detecting() ? 'Buscando…' : 'Detectar modelos'}</SettingsButton>}>
                <SettingsSelect label="Modelo" value={service().model} onChange={model => setService({ ...service(), model })} options={detected()!.models.map(model => ({ value: model, label: model }))} />
              </Show>
            </SettingsRow>
            <SettingsRow title="Nombre" description="Opcional: cómo lo vas a ver en la lista.">
              <input class="syka-settings-input" maxLength={60} placeholder="Compatible con OpenAI" value={service().name} onInput={event => setService({ ...service(), name: event.currentTarget.value })} />
            </SettingsRow>
            <div class="flex items-center justify-end gap-2 px-4 pt-1 pb-3">
              <SettingsButton tone="quiet" onClick={() => setServiceOpen(false)}>Cancelar</SettingsButton>
              <SettingsButton tone="solid" disabled={saving() || !detected() || !service().model || (!saved() && !serviceKey().trim())} onClick={() => void saveService()}>Guardar y usar</SettingsButton>
            </div>
          </Show>
          <Show when={editing() === provider}>
            <SettingsRow title={`Clave de ${info.name}`} description="Pegala solo acá, no en un chat.">
              <div class="flex items-center gap-2">
                <input class="syka-settings-input" type="password" autocomplete="off" placeholder={info.keyHint} value={key()} autofocus
                  onInput={event => setKey(event.currentTarget.value)} onKeyDown={event => { if (event.key === 'Enter' && key().trim()) void saveKey(provider); }} />
                <SettingsButton tone="solid" disabled={saving() || !key().trim()} onClick={() => void saveKey(provider)}>Guardar</SettingsButton>
              </div>
            </SettingsRow>
          </Show>
        </>;
      }}</For>
      <Show when={status() && !status()!.secureStorage}>
        <SettingsRow title="El almacenamiento seguro de Windows no está disponible" description="No se pueden guardar claves en este equipo." />
      </Show>
    </SettingsGroup>
  </Show>;
}
