import { createEffect, createSignal, For, Match, onCleanup, onMount, Show, Switch, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import { DashboardAccountView } from '@/components/dashboard/account-view';
import { DashboardSettingsView } from '@/components/dashboard/settings-view';
import { DashboardGlossaryView } from '@/components/dashboard/glossary-view';
import { DashboardHelpView } from '@/components/dashboard/help-view';
import { AgentSettings } from '@/components/dashboard/syka-agent-settings';
import { DependencySettings } from '@/components/dashboard/syka-dependencies';
import { GroqKeySettings } from './groq';
import { LocalVoiceSettings } from './local-voice';
import { TESTING_INSTANCE } from '@/lib/instance';
import { ParakeetSettings } from './parakeet';
import { DictationSettings } from '@/components/dashboard/syka-dictation-settings';
import { DashboardScrollView } from '@/components/dashboard/shared';
import { ZernioSettingsView } from '@/components/publication/settings';
import { AppearanceSettings } from './appearance';
import { ChatSettings } from './chat';
import { SykaOnboardingSettings } from '@/components/dashboard/syka-onboarding-settings';
import { CodexSettings } from './codex';
import { StorageSettings } from './storage';
import { DiagnosticsSettings } from './diagnostics';
import { RecordingSettings } from './recording';
import { ShortcutsSettings } from './shortcuts';
import { openSettings } from './state';
import { closeSettings, motionPreference, settingsPage, setMotionPreference, type SettingsPage } from './state';
import { SETTINGS_GROUPS, filterSettings, sectionInfo } from './sections';
import { SettingsNavIcon } from './nav-icon';
import { GeneralOptions } from './general';
import { NotificationSettings } from './notifications';
import { ProvidersSettings } from './providers';
import './syka-code-settings.css';
import './settings.css';
import './settings-shell.css';
import './appearance-prefs.css';
import { applyAppearancePrefs } from '@/lib/appearance-prefs';

/**
 * Settings as a full page, like Syka Code: the app stays blurred behind, the
 * sidebar takes back to the app, searches settings and lists the sections by
 * group, and the section sits in a 760 px column with its title.
 */
export type SettingsPanes = Partial<Record<SettingsPage, Component>>;
export function SettingsModal(props: { isOpen: boolean; onClose(): void; defaultPage?: SettingsPage; panes?: SettingsPanes }) {
  const [page, setPage] = createSignal<SettingsPage>(props.defaultPage ?? 'general');
  const [query, setQuery] = createSignal('');
  const groups = () => filterSettings(SETTINGS_GROUPS, query());
  let scroller: HTMLDivElement | undefined;
  createEffect(() => { if (props.isOpen) { setPage(props.defaultPage ?? 'general'); setQuery(''); } });
  createEffect(() => { page(); scroller?.scrollTo({ top: 0 }); });
  // The settings palette (syka-code-settings.css) applies while this mark is on <html>.
  createEffect(() => {
    if (!props.isOpen) return;
    document.documentElement.setAttribute('data-syka-settings-open', '');
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('[data-kb-popper-content-id], [role="menu"]')) return;
      event.preventDefault(); props.onClose();
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => { document.documentElement.removeAttribute('data-syka-settings-open'); window.removeEventListener('keydown', onKey); });
  });
  return <Show when={props.isOpen}>
    <Portal mount={document.body}>
      <div class="syka-settings-shell" role="dialog" aria-modal="true" aria-label="Configuración de Syka">
        {/* The window still moves from the strip above the page; the sidebar and its back button stay clickable. */}
        <Show when={!!window.desktop}><div class="syka-settings-drag" aria-hidden="true" /></Show>
        <nav class="syka-settings-sidenav" aria-label="Apartados de configuración">
          <button type="button" class="syka-settings-back" onClick={() => props.onClose()}>
            <svg aria-hidden="true" viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7M19 12H5" /></svg>
            Volver a la aplicación
          </button>
          <label class="syka-settings-search">
            <svg aria-hidden="true" viewBox="0 0 24 24" class="size-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input value={query()} placeholder="Buscar ajustes…" aria-label="Buscar ajustes" onInput={event => setQuery(event.currentTarget.value)}
              onKeyDown={event => {
                if (event.key === 'Escape' && query()) { event.preventDefault(); event.stopPropagation(); setQuery(''); }
                const first = groups()[0]?.sections[0];
                if (event.key === 'Enter' && first) setPage(first.id);
              }} />
          </label>
          <div class="syka-settings-sidenav-list">
            <Show when={groups().length} fallback={<p class="syka-settings-sidenav-empty">Sin resultados</p>}>
              <For each={groups()}>{group =>
                <section aria-label={group.label}>
                  <h2>{group.label}</h2>
                  <For each={group.sections}>{section =>
                    <button type="button" class="syka-settings-navrow" aria-current={page() === section.id ? 'page' : undefined} onClick={() => setPage(section.id)}>
                      <span class="syka-settings-navrow-icon"><SettingsNavIcon page={section.id} /></span>
                      <span>{section.label}</span>
                    </button>}
                  </For>
                </section>}
              </For>
            </Show>
          </div>
          <small class="syka-settings-sidenav-version">{TESTING_INSTANCE ? 'Pruebas' : 'Local'} · v{APP_VERSION}</small>
        </nav>
        <div ref={scroller} class="syka-settings-scroll">
          <div class="syka-settings-column" data-settings-page={page()}>
            <div class="syka-settings-page">
              <h1>{sectionInfo(page()).label}</h1>
              <p class="syka-settings-page-description">{sectionInfo(page()).description}</p>
              <Show when={props.panes?.[page()]} fallback={
              <Switch>
                <Match when={page() === 'general'}><GeneralOptions /><DashboardSettingsView /></Match>
                <Match when={page() === 'notifications'}><NotificationSettings /></Match>
                <Match when={page() === 'providers'}><ProvidersSettings /></Match>
                <Match when={page() === 'profile'}><DashboardAccountView /></Match>
                <Match when={page() === 'appearance'}><AppearanceSettings /></Match>
                <Match when={page() === 'chat'}><ChatSettings /></Match>
                <Match when={page() === 'brand-kit'}><DashboardScrollView><SykaOnboardingSettings /></DashboardScrollView></Match>
                <Match when={page() === 'zernio'}><ZernioSettingsView /></Match>
                <Match when={page() === 'groq'}><GroqKeySettings /><ParakeetSettings /><LocalVoiceSettings /><DictationSettings /></Match>
                <Match when={page() === 'codex'}><CodexSettings /></Match>
                <Match when={page() === 'plugins'}><AgentSettings section="plugins" /></Match>
                <Match when={page() === 'skills'}><AgentSettings section="skills" /></Match>
                <Match when={page() === 'tools'}><DashboardScrollView><RecordingSettings /><DependencySettings /></DashboardScrollView></Match>
                <Match when={page() === 'storage'}><StorageSettings /></Match>
                <Match when={page() === 'diagnostics'}><DiagnosticsSettings /></Match>
                <Match when={page() === 'shortcuts'}><ShortcutsSettings /></Match>
                <Match when={page() === 'glossary'}><DashboardGlossaryView /></Match>
                <Match when={page() === 'help'}><DashboardHelpView /></Match>
              </Switch>
              }>{Pane => <>{Pane()({})}</>}</Show>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  </Show>;
}

export function SykaSettingsRoot(props: { panes?: SettingsPanes } = {}) {
  createEffect(() => {
    const preference = motionPreference();
    document.documentElement.dataset.sykaMotion = preference;
    // Shared React controls and MetalFX use this attribute for reduced motion.
    document.documentElement.dataset.motion = preference;
  });
  onMount(() => {
    applyAppearancePrefs();
    const listener = (event: StorageEvent) => { if (event.key === 'syka.settings.motion.v1') setMotionPreference(event.newValue === 'reduced' ? 'reduced' : 'system'); };
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey) return;
      if ((event.ctrlKey || event.metaKey) && (event.code === 'Comma' || event.key === ',')) {
        event.preventDefault(); event.stopPropagation(); openSettings(event.shiftKey ? 'storage' : 'general');
      } else if (event.key === 'F1' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault(); event.stopPropagation(); openSettings('shortcuts');
      }
    };
    window.addEventListener('storage', listener);
    window.addEventListener('keydown', shortcut, true);
    onCleanup(() => { window.removeEventListener('storage', listener); window.removeEventListener('keydown', shortcut, true); });
  });
  return <SettingsModal isOpen={settingsPage() !== null} defaultPage={settingsPage() ?? 'general'} onClose={closeSettings} panes={props.panes} />;
}
