import { createSignal, onCleanup, Show } from 'solid-js';
import { generalPrefs, onGeneralPrefsChange, updateGeneralPrefs, type GeneralPrefs } from '@/lib/general-prefs';
import { isDesktop } from '@/projects';
import { SettingsGroup, SettingsRow, SettingsSelect, SettingsSwitch } from './kit';

/** Settings › General, Syka Code's «Conversaciones» and «Espacio de trabajo» groups, with the options Syka Studio has. */
export function GeneralOptions() {
  const [prefs, setPrefs] = createSignal<GeneralPrefs>(generalPrefs());
  onCleanup(onGeneralPrefsChange(() => setPrefs(generalPrefs())));
  const set = (patch: Partial<GeneralPrefs>) => updateGeneralPrefs(patch);
  return <>
    <SettingsGroup title="Conversaciones">
      <SettingsRow title="Generación de títulos" description="Con el primer mensaje, el chat toma un nombre corto. Un nombre que escribiste se conserva.">
        <SettingsSelect label="Generación de títulos" value={prefs().autoTitles ? 'auto' : 'off'}
          options={[{ value: 'auto', label: 'Automático' }, { value: 'off', label: 'Desactivado' }]}
          onChange={value => set({ autoTitles: value === 'auto' })} />
      </SettingsRow>
      <SettingsRow title="Enviar durante una tarea" description="Enter usa esta opción; Ctrl+Enter usa la otra. Steer depende del motor y de su sesión activa.">
        <SettingsSelect label="Enviar durante una tarea" value={prefs().followUpMode}
          options={[{ value: 'queue', label: 'Cola' }, { value: 'steer', label: 'Steer' }]}
          onChange={followUpMode => set({ followUpMode })} />
      </SettingsRow>
      <SettingsRow title="Atajo para enviar" description="Qué tecla envía el mensaje en el composer.">
        <SettingsSelect label="Atajo para enviar" value={prefs().enterBehavior}
          options={[{ value: 'enter', label: 'Intro' }, { value: 'ctrl-enter', label: 'Ctrl+Intro' }]}
          onChange={enterBehavior => set({ enterBehavior })} />
      </SettingsRow>
      <SettingsRow title="Mostrar uso de contexto" description="Indicador de cuánto contexto ha consumido el chat.">
        <SettingsSwitch label="Mostrar uso de contexto" checked={prefs().showContextUsage} onChange={showContextUsage => set({ showContextUsage })} />
      </SettingsRow>
    </SettingsGroup>
    <Show when={isDesktop()}>
      <SettingsGroup title="Espacio de trabajo">
        <SettingsRow title="Cerrar a la bandeja" description="Cerrar oculta la ventana y conserva los trabajos. Salir de Syka Studio desde la bandeja cierra la aplicación. Al desactivarlo, cerrar la ventana sale de Syka.">
          <SettingsSwitch label="Cerrar a la bandeja" checked={prefs().closeToTray} onChange={closeToTray => set({ closeToTray })} />
        </SettingsRow>
      </SettingsGroup>
    </Show>
  </>;
}
