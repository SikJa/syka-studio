/**
 * Settings › Transcripción › Dictado, after Syka Code's VoiceSettings: who
 * transcribes (Codex with its own account, or Groq), the language, the
 * microphone, the shortcut and the local history.
 */
import { createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { updateVoicePrefs, voicePrefs, type DictationEngine } from '@/lib/voice-prefs';
import { SettingsButton, SettingsGroup, SettingsRow, SettingsSelect } from '@/components/settings/kit';

const storageKey = 'syka:dictation:v1:local';
const LANGUAGES = [
  { value: 'auto', label: 'Detectar' }, { value: 'es', label: 'Español' }, { value: 'en', label: 'Inglés' },
  { value: 'pt', label: 'Portugués' }, { value: 'fr', label: 'Francés' }, { value: 'it', label: 'Italiano' }, { value: 'de', label: 'Alemán' },
];

export function DictationSettings() {
  const [prefs, setPrefs] = createSignal(voicePrefs());
  const set = (patch: Parameters<typeof updateVoicePrefs>[0]) => setPrefs(updateVoicePrefs(patch));
  const [status] = createResource(async () => {
    if (!window.desktop) return { codex: null, groq: null, local: null };
    const [codex, groq, local] = await Promise.all([
      mainBridge.call(MAIN_CHANNELS.SYKA_CODEX_VOICE_STATUS, undefined).catch(() => null),
      mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_STATUS, undefined).catch(() => null),
      mainBridge.call(MAIN_CHANNELS.SYKA_LOCAL_VOICE, { action: 'status' }).catch(() => null),
    ]);
    return { codex, groq, local };
  });
  const [mics, setMics] = createSignal<{ value: string; label: string }[]>([]);
  const loadMics = async () => {
    try {
      const devices = await navigator.mediaDevices?.enumerateDevices() ?? [];
      setMics(devices.filter(device => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default' && device.deviceId !== 'communications')
        .map((device, index) => ({ value: device.deviceId, label: device.label || `Micrófono ${index + 1}` })));
    } catch { setMics([]); }
  };
  onMount(() => {
    void loadMics();
    navigator.mediaDevices?.addEventListener?.('devicechange', loadMics);
    onCleanup(() => navigator.mediaDevices?.removeEventListener?.('devicechange', loadMics));
  });

  const codexNote = () => {
    const codex = status()?.codex;
    if (status.loading) return 'Comprobando…';
    if (!codex?.available) return 'Sin sesión de Codex en este equipo';
    return codex.mode === 'openai' ? 'Con la clave de API de Codex' : 'Con tu cuenta de ChatGPT';
  };
  const captionName = () => { const groq = status()?.groq; return !groq ? 'Groq' : groq.active === 'compatible' ? groq.compatible?.name ?? 'el servicio compatible' : groq.active === 'openai' ? 'OpenAI' : 'Groq'; };
  const groqNote = () => status.loading ? 'Comprobando…' : status()?.groq?.configured ? `Con ${captionName()}, el de los subtítulos` : `Falta la clave de ${captionName()}`;
  const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
  const localNote = () => status.loading ? 'Comprobando…' : status()?.local?.readyModel ? 'Con el modelo descargado, sin internet' : 'Falta descargar un modelo abajo';
  const engineDescription = () => {
    const engine = prefs().engine;
    if (engine === 'codex') return `Codex: ${codexNote()}.`;
    if (engine === 'parakeet') return 'Parakeet v3 en tu PC. Mejor con frases de más de dos palabras.';
    if (engine === 'local') return `En este equipo: ${lower(localNote())}.`;
    if (engine === 'groq') return `${groqNote()}.`;
    return `Codex si tenés sesión; si no, tu PC o el de los subtítulos.`;
  };

  const [shortcut, setShortcut] = createSignal(localStorage.getItem(storageKey + ':shortcut') ?? 'Alt+Shift+V');
  const [capturing, setCapturing] = createSignal(false);
  const [history, setHistory] = createSignal<Array<{ id: string; text: string; at: string }>>((() => { try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]'); } catch { return []; } })());
  const capture = (event: KeyboardEvent) => {
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { setCapturing(false); return; }
    if ((!event.ctrlKey && !event.altKey) || ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
    const next = [event.ctrlKey ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', event.metaKey ? 'Meta' : '', event.key.toUpperCase()].filter(Boolean).join('+');
    localStorage.setItem(storageKey + ':shortcut', next); setShortcut(next); setCapturing(false);
  };

  return <>
    <SettingsGroup title="Dictado" description="El micrófono del chat.">
      <SettingsRow title="Quién transcribe" description={engineDescription()}>
        <SettingsSelect label="Quién transcribe" value={prefs().engine} onChange={engine => set({ engine: engine as DictationEngine })}
          options={[{ value: 'auto', label: 'Automático' }, { value: 'codex', label: 'Codex' }, { value: 'parakeet', label: 'Parakeet v3' }, { value: 'local', label: 'Whisper · este equipo' }, { value: 'groq', label: 'El de los subtítulos' }]} />
      </SettingsRow>
      <SettingsRow title="Idioma">
        <SettingsSelect label="Idioma" value={prefs().language} onChange={language => set({ language })} options={LANGUAGES} />
      </SettingsRow>
      <SettingsRow title="Micrófono" description={mics().length ? undefined : 'Los nombres aparecen al permitir el micrófono.'}>
        <SettingsSelect label="Micrófono" value={prefs().microphone} onChange={microphone => set({ microphone })}
          options={[{ value: '', label: 'El del sistema' }, ...mics()]} />
      </SettingsRow>
      <SettingsRow title="Atajo" description={capturing() ? 'Apretá Alt o Ctrl con una tecla. Esc cancela.' : 'Empieza y termina el dictado.'}>
        <Show when={capturing()} fallback={<SettingsButton tone="quiet" onClick={() => setCapturing(true)}>{shortcut()}</SettingsButton>}>
          <input autofocus class="syka-settings-input" aria-label="Atajo de dictado" placeholder="Alt o Ctrl + tecla" readOnly onKeyDown={capture} onBlur={() => setCapturing(false)} />
        </Show>
      </SettingsRow>
    </SettingsGroup>
    <SettingsGroup title="Últimos dictados" description="Guardados solo en este equipo."
      action={<SettingsButton tone="quiet" disabled={!history().length} onClick={() => { localStorage.removeItem(storageKey); setHistory([]); }}>Borrar historial</SettingsButton>}>
      <For each={history()} fallback={<SettingsRow title="Todavía no dictaste nada" />}>{entry =>
        <SettingsRow title={<span class="whitespace-pre-wrap font-normal">{entry.text}</span>} description={new Date(entry.at).toLocaleString('es-AR')} />}
      </For>
    </SettingsGroup>
  </>;
}
