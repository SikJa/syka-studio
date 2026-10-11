import { createEffect, createSignal, For, Match, onCleanup, onMount, Show, Switch, type Component } from 'solid-js';
import { Dialog, DialogCloseButton, DialogContent, DialogDescription, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { SykaBrandOrb } from '@/components/ui/syka-brand-orb';
import { ZernioMark, CodexMark } from '@/components/ui/provider-mark';
import GroqLogo from '@/assets/providers/groq.svg';
import { DashboardAccountView } from '@/components/dashboard/account-view';
import { DashboardSettingsView } from '@/components/dashboard/settings-view';
import { DashboardGlossaryView } from '@/components/dashboard/glossary-view';
import { DashboardHelpView } from '@/components/dashboard/help-view';
import { AgentSettings } from '@/components/dashboard/syka-agent-settings';
import { DependencySettings } from '@/components/dashboard/syka-dependencies';
import { GroqSettings } from '@/components/dashboard/syka-groq-settings';
import { DictationSettings } from '@/components/dashboard/syka-dictation-settings';
import { DashboardScrollView } from '@/components/dashboard/shared';
import { ZernioSettingsView } from '@/components/publication/settings';
import { AppearanceSettings } from './appearance';
import { SykaOnboardingSettings } from '@/components/dashboard/syka-onboarding-settings';
import { CodexSettings } from './codex';
import { StorageSettings } from './storage';
import { RecordingSettings } from './recording';
import { ShortcutsSettings } from './shortcuts';
import { openSettings } from './state';
import { closeSettings, motionPreference, settingsPage, setMotionPreference, type SettingsPage } from './state';
import { t } from '@/i18n';
import './settings.css';

const pages: Record<SettingsPage, { label: string; description: string; icon: string }> = {
  general: { label: 'General', description: 'El espacio de trabajo y los permisos de Syka.', icon: 'settings' },
  profile: { label: 'Perfil', description: 'Tu nombre y tu foto, guardados en este equipo.', icon: 'user' },
  appearance: { label: 'Apariencia', description: 'Color de acento, tema y movimiento de la interfaz.', icon: 'theme' },
  'brand-kit': { label: 'Brand kit', description: 'Identidad, colores y voz de tu marca.', icon: 'visual' },
  zernio: { label: 'Zernio', description: 'Conexiones y cuentas para publicar tus videos.', icon: 'external-link' },
  groq: { label: 'Groq', description: 'Conectá tu cuenta para transcribir y dictar.', icon: 'captions' },
  codex: { label: 'Modelos e IA', description: 'Conectá tus asistentes y elegí cómo editar.', icon: 'agent.codex' },
  plugins: { label: 'Plugins', description: 'Servidores MCP que amplían las herramientas del agente.', icon: 'ai-mcp-cli' },
  skills: { label: 'Skills', description: 'Tu biblioteca de flujos reutilizables de edición.', icon: 'sparkles' },
  tools: { label: 'Tools', description: 'Herramientas locales, transcripción y dictado.', icon: 'settings' },
  storage: { label: 'Almacenamiento', description: 'Espacio disponible, limpieza automática y conservación de archivos.', icon: 'navigation.folder' },
  shortcuts: { label: 'Atajos', description: 'Accesos rápidos para configurar, editar y revisar.', icon: 'keyboard-shortcut' },
  glossary: { label: 'Glosario', description: 'Nombres y términos para tus transcripciones.', icon: 'captions' },
  help: { label: 'Ayuda', description: 'Recursos para trabajar con Syka.', icon: 'help' },
};
const groups: { label: string; entries: SettingsPage[] }[] = [
  { get label() { return t('Configuración'); }, entries: ['general', 'profile', 'appearance', 'brand-kit'] },
  { get label() { return t('Conexiones'); }, entries: ['codex', 'groq', 'zernio', 'plugins'] },
  { get label() { return t('Espacio de trabajo'); }, entries: ['skills', 'tools', 'storage', 'shortcuts', 'glossary'] },
];
function PageIcon(props: { page: SettingsPage }) {
  return <Switch fallback={<Icon name={pages[props.page].icon} class="size-5" />}>
    <Match when={props.page === 'zernio'}><ZernioMark class="size-4" /></Match>
    <Match when={props.page === 'codex'}><CodexMark class="size-4" /></Match>
    <Match when={props.page === 'groq'}><span class="inline-flex size-4 [&_svg]:size-full" aria-hidden="true"><GroqLogo /></span></Match>
    <Match when={props.page === 'skills'}><svg aria-hidden="true" viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4.5h6a3 3 0 0 1 3 3v13a4 4 0 0 0-4-2H4zM13 7.5a3 3 0 0 1 3-3h4v14h-4a4 4 0 0 0-3 2" /></svg></Match>
    <Match when={props.page === 'brand-kit'}><svg aria-hidden="true" viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.6-3.2 1.8 1.8 0 0 1 1.4-2.8H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z" /><circle cx="8" cy="8" r="1" /><circle cx="14" cy="7" r="1" /><circle cx="17" cy="11" r="1" /><circle cx="6" cy="13" r="1" /></svg></Match>
  </Switch>;
}

/** BoardUI Settings Modal composition, with Syka's Solid/Kobalte dialog and real views.
 * Reference: https://www.boardui.com/components/settings-modal (871×614 rail + pane).
 */
export type SettingsPanes = Partial<Record<SettingsPage, Component>>;
export function SettingsModal(props: { isOpen: boolean; onClose(): void; defaultPage?: SettingsPage; panes?: SettingsPanes }) {
  const [page, setPage] = createSignal<SettingsPage>(props.defaultPage ?? 'general');
  let scroller: HTMLDivElement | undefined;
  createEffect(() => { if (props.isOpen) setPage(props.defaultPage ?? 'general'); });
  createEffect(() => { page(); scroller?.scrollTo({ top: 0 }); });
  return <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
    <DialogPortal>
      <DialogContent class="syka-settings-modal" overlayClass="syka-settings-backdrop" showCloseButton={false} aria-label="Configuración de Syka">
        <div class="syka-settings-layout t-panel-slide" data-open="true">
          <aside class="syka-settings-rail">
            <div class="syka-settings-brand"><SykaBrandOrb /><span>Syka Studio</span></div>
            <nav aria-label="Apartados de configuración" class="syka-settings-nav">
              <For each={groups}>{group => <div class="syka-settings-group"><span class="syka-settings-group-label">{group.label}</span><For each={group.entries}>{entry => <button type="button" aria-label={pages[entry].label} title={pages[entry].label} aria-current={page() === entry ? 'page' : undefined} onClick={() => setPage(entry)}><span class="syka-settings-nav-icon"><PageIcon page={entry} /></span><span class="syka-settings-nav-label">{pages[entry].label}</span></button>}</For></div>}</For>
            </nav>
            <div class="syka-settings-rail-footer"><button type="button" aria-label="Ayuda" aria-current={page() === 'help' ? 'page' : undefined} onClick={() => setPage('help')}><Icon name="help" class="size-5" /><span>Ayuda</span></button><small>Local · v{APP_VERSION}</small></div>
          </aside>
          <section class="syka-settings-content">
            <header class="syka-settings-header"><div><DialogTitle>{pages[page()].label}</DialogTitle><DialogDescription>{pages[page()].description}</DialogDescription></div><DialogCloseButton class="syka-settings-close" aria-label="Cerrar configuración"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 6 12 12M18 6 6 18" /></svg></DialogCloseButton></header>
            <div ref={scroller} class="syka-settings-body" data-settings-page={page()}>
              <Show when={props.panes?.[page()]} fallback={
              <Switch>
                <Match when={page() === 'general'}><DashboardSettingsView /></Match>
                <Match when={page() === 'profile'}><DashboardAccountView /></Match>
                <Match when={page() === 'appearance'}><AppearanceSettings /></Match>
                <Match when={page() === 'brand-kit'}><DashboardScrollView><SykaOnboardingSettings /></DashboardScrollView></Match>
                <Match when={page() === 'zernio'}><ZernioSettingsView /></Match>
                <Match when={page() === 'groq'}><DashboardScrollView><GroqSettings /><DictationSettings /></DashboardScrollView></Match>
                <Match when={page() === 'codex'}><CodexSettings /></Match>
                <Match when={page() === 'plugins'}><AgentSettings section="plugins" /></Match>
                <Match when={page() === 'skills'}><AgentSettings section="skills" /></Match>
                <Match when={page() === 'tools'}><DashboardScrollView><RecordingSettings /><DependencySettings /></DashboardScrollView></Match>
                <Match when={page() === 'storage'}><StorageSettings /></Match>
                <Match when={page() === 'shortcuts'}><ShortcutsSettings /></Match>
                <Match when={page() === 'glossary'}><DashboardGlossaryView /></Match>
                <Match when={page() === 'help'}><DashboardHelpView /></Match>
              </Switch>
              }>{Pane => <>{Pane()({})}</>}</Show>
            </div>
          </section>
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>;
}

export function SykaSettingsRoot(props: { panes?: SettingsPanes } = {}) {
  createEffect(() => {
    const preference = motionPreference();
    document.documentElement.dataset.sykaMotion = preference;
    // Shared React controls and MetalFX use this attribute for reduced motion.
    document.documentElement.dataset.motion = preference;
  });
  onMount(() => {
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
