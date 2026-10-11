/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { useSearchParams } from '@solidjs/router';
import { Match, Show, Switch, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { toast } from 'somoto';
import { DashboardHomeView } from '@/components/dashboard/home-view';
import { DashboardProjectsView } from '@/components/dashboard/projects-view';
import { PublicationView } from '@/components/publication/drafts';
import { openSettings, settingsPage, type SettingsPage } from '@/components/settings/state';
import { DashboardSidebarConnectCard, DashboardSidebarHeader, DashboardSidebarItem, DashboardSidebarNav, DashboardSidebarSection, DashboardSidebarTitleBar, DashboardSidebarUser } from '@/components/dashboard/sidebar';
import { Separator } from '@/components/ui/separator';
import { SykaBrandOrb } from '@/components/ui/syka-brand-orb';
import { useFullscreenState } from '@/hooks/use-fullscreen-state';
import { chatState, ensureConnected } from '@/agent-chat/store';
import { mainBridge } from '@/lib/ipc';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { isDesktop, isWindowsDesktop, openProjectFolder, pickProjectFolder } from '@/projects';
import { isInputTarget } from '@/utils';

const settingsAliases: Record<string, SettingsPage> = { settings: 'general', account: 'profile', preferences: 'appearance', mcp: 'codex', zernio: 'zernio', glossary: 'glossary', help: 'help', skills: 'skills', plugins: 'plugins', storage: 'storage', tools: 'tools', 'brand-kit': 'brand-kit', appearance: 'appearance', codex: 'codex' };
export function DashboardPage() {
  ensureConnected();
  const [groqConnected, setGroqConnected] = createSignal<boolean>();
  const [zernioConnected, setZernioConnected] = createSignal<boolean>();
  let connectionRevision = 0;
  const refreshConnections = async () => {
    if (!isDesktop()) return;
    const revision = ++connectionRevision;
    const results = await Promise.allSettled([
      mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_STATUS, undefined),
      mainBridge.call(MAIN_CHANNELS.SYKA_PUBLICATION, { action: 'get' }),
    ]);
    if (revision !== connectionRevision) return;
    const [groq, zernio] = results;
    setGroqConnected(groq.status === 'fulfilled' ? groq.value.configured : undefined);
    setZernioConnected(zernio.status === 'fulfilled' ? zernio.value.connections.some(c => c.configured) : undefined);
  };
  const agentMissing = () => chatState.connection === 'open' && chatState.harnesses.length > 0
    && !chatState.harnesses.some(h => h.status === 'ready' || h.status === 'checking');
  createEffect(() => { if (settingsPage() === null) void refreshConnections(); });
  const [params, setParams] = useSearchParams();
  const isFullscreen = useFullscreenState();
  const rawView = () => Array.isArray(params.dashboard) ? params.dashboard[0] : params.dashboard ?? 'home';
  const view = () => ['home', 'projects', 'publication'].includes(rawView()) ? rawView() : 'home';
  const setView = (next: string) => setParams({ dashboard: next }, { replace: true });
  createEffect(() => { const alias = settingsAliases[rawView()]; if (alias) openSettings(alias); });
  let hadSettings = false;
  createEffect(() => { const open = settingsPage() !== null; if (!open && hadSettings && settingsAliases[rawView()]) setView('home'); hadSettings = open; });

  let picking = false;
  const shortcut = async (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== 'i' || isInputTarget(event) || settingsPage() !== null) return;
    event.preventDefault(); if (picking || !isDesktop()) return; picking = true;
    try { const dir = await pickProjectFolder(); if (dir) await openProjectFolder(dir); }
    catch (error) { toast.error('No se pudo agregar el proyecto', { description: (error as Error).message }); }
    finally { picking = false; }
  };
  onMount(() => {
    window.addEventListener('keydown', shortcut);
    window.addEventListener('focus', refreshConnections);
    onCleanup(() => { connectionRevision++; window.removeEventListener('keydown', shortcut); window.removeEventListener('focus', refreshConnections); });
  });
  return <div class="flex h-screen w-full min-h-0 flex-row overflow-hidden bg-sidebar">
    <aside class="relative flex min-h-0 w-69 shrink-0 flex-col">
      <Show when={!!window.desktop && !isFullscreen()}><div class="absolute inset-x-0 top-0 h-10 z-20" style="-webkit-app-region: drag;" /></Show>
      <Show when={!isWindowsDesktop()} fallback={<DashboardSidebarTitleBar />}><DashboardSidebarHeader /></Show>
      <DashboardSidebarNav footer={<Show when={isDesktop() && (agentMissing() || groqConnected() === false || zernioConnected() === false)}><DashboardSidebarConnectCard agentMissing={agentMissing()} groqMissing={groqConnected() === false} zernioMissing={zernioConnected() === false} onConfigure={openSettings} /></Show>}>
        <DashboardSidebarSection>
          <DashboardSidebarItem active={view() === 'home'} onClick={() => setView('home')} icon="home" label="Inicio" />
          <DashboardSidebarItem active={view() === 'projects'} onClick={() => setView('projects')} icon="diffusion-project-file" leading={<SykaBrandOrb />} label="Proyectos" />
          <DashboardSidebarItem active={view() === 'publication'} onClick={() => setView('publication')} icon="film-video-export" label="Publicaciones" />
        </DashboardSidebarSection>
        <DashboardSidebarSection><DashboardSidebarItem onClick={() => openSettings('general')} icon="settings" label="Configuración" /></DashboardSidebarSection>
      </DashboardSidebarNav>
      <DashboardSidebarUser onClick={() => openSettings('profile')} />
    </aside>
    <Separator orientation="vertical" class="bg-border-strong" />
    <section class="syka-dashboard-main flex min-h-0 flex-1 flex-col"><Switch fallback={<DashboardHomeView />}><Match when={view() === 'projects'}><DashboardProjectsView /></Match><Match when={view() === 'publication'}><PublicationView /></Match></Switch></section>
  </div>;
}
