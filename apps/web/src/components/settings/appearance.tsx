import { PersonalizationSection } from '@/components/dashboard/personalization/personalization-section';
import { createEffect, createSignal, For, Show } from 'solid-js';
import { COLOR_MODE_STORAGE_KEY, useColorMode } from '@kobalte/core';
import { toast } from 'somoto';
import { DashboardScrollView, DashboardSurfaceSection } from '@/components/dashboard/shared';
import { motionPreference, saveMotionPreference } from './state';
import { t } from '@/i18n';
import { isDesktop } from '@/projects';
import { appearancePrefs, onAppearancePrefsChange, setUiScale, uiScale, updateAppearancePrefs, UI_SCALE_STEPS } from '@/lib/appearance-prefs';
import { SettingsGroup, SettingsRow, SettingsSelect, SettingsSwitch } from './kit';
import { onCleanup } from 'solid-js';

type Theme = 'light' | 'dark' | 'system';
export function AppearanceSettings() {
  const { colorMode, setColorMode } = useColorMode();
  const [theme, setTheme] = createSignal<Theme>('dark');
  createEffect(() => {
    const resolved = colorMode();
    try {
      const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
      setTheme(stored === 'dark' || stored === 'light' || stored === 'system' ? stored : resolved);
    } catch { setTheme(resolved); }
  });
  const chooseTheme = (value: Theme) => { setColorMode(value); setTheme(value); };
  return <DashboardScrollView>
    <PersonalizationSection />
    <DashboardSurfaceSection title="Tema" description="El mismo diseño de Syka, con el contraste que prefieras.">
      <div class="syka-theme-options" role="group" aria-label="Tema de Syka">
        <For each={[['dark', 'Oscuro'], ['light', 'Claro'], ['system', 'Sistema']] as const}>{([value, label]) =>
          <button type="button" class="syka-theme-option" aria-pressed={theme() === value} onClick={() => chooseTheme(value)}>
            <span class={'syka-theme-preview syka-theme-preview-' + value}><i /><span><b /><b /><b /></span></span>
            <span>{t(label)}</span><span class="syka-option-check" aria-hidden="true">{theme() === value ? '✓' : ''}</span>
          </button>
        }</For>
      </div>
    </DashboardSurfaceSection>
    <AppearanceOptions />
  </DashboardScrollView>;
}

/** Syka Code's «Movimiento» and «Organización del espacio» options that Syka Studio has. */
function AppearanceOptions() {
  const [prefs, setPrefs] = createSignal(appearancePrefs());
  const [scale, setScale] = createSignal(uiScale());
  onCleanup(onAppearancePrefsChange(() => { setPrefs(appearancePrefs()); setScale(uiScale()); }));
  return <>
    <SettingsGroup title="Movimiento">
      <SettingsRow title="Reducir movimiento" description="Menos animaciones y transiciones. También se respeta la preferencia de Windows.">
        <SettingsSwitch label="Reducir movimiento" checked={motionPreference() === 'reduced'} onChange={reduced => {
          try { saveMotionPreference(reduced ? 'reduced' : 'system'); } catch { toast.error('No se pudo guardar la preferencia.'); }
        }} />
      </SettingsRow>
      <SettingsRow title="Pausar en segundo plano" description="Detiene el movimiento que no para, como el orbe de Syka, cuando otra ventana tiene el foco.">
        <SettingsSwitch label="Pausar en segundo plano" checked={prefs().pauseInBackground} onChange={pauseInBackground => updateAppearancePrefs({ pauseInBackground })} />
      </SettingsRow>
    </SettingsGroup>
    <SettingsGroup title="Organización del espacio">
      <Show when={isDesktop()}>
        <SettingsRow title="Escala de interfaz" description="Ajusta toda la app. También podés usar Ctrl +, Ctrl − y Ctrl 0.">
          <SettingsSelect label="Escala de interfaz" value={String(scale())} options={UI_SCALE_STEPS.map(step => ({ value: String(step), label: `${step}%` }))}
            onChange={value => setUiScale(Number(value))} />
        </SettingsRow>
      </Show>
      <SettingsRow title="Usar cursores de puntero" description="Mano al pasar sobre botones y controles interactivos.">
        <SettingsSwitch label="Usar cursores de puntero" checked={prefs().pointerCursors} onChange={pointerCursors => updateAppearancePrefs({ pointerCursors })} />
      </SettingsRow>
    </SettingsGroup>
  </>;
}
