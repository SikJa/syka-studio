/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { useLocation, useNavigate } from '@solidjs/router';
import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup } from 'solid-js';
import { toast } from 'somoto';
import { chatState, refreshChats } from '@/agent-chat/store';
import { useProject } from '@/context/project';
import { renderOverlay } from '@/context/render';
import { projectRoute } from '@/hooks/use-project-route';
import { listProjects, projectKey, projectsRevision, type ProjectInfo } from '@/projects';
import { drainProjectEdits } from '@/projects/edits';
import { openProjectFromList } from '@/components/dashboard/shared';
import { parseTimestamp } from '@/components/dashboard/utils';
import {
  DropdownMenuItem, DropdownMenuPortal, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import './projects-menu.css';

export type ProjectActivity = 'running' | 'waiting' | 'idle' | 'unknown';
export type SwitcherProject = Pick<ProjectInfo, 'id' | 'name' | 'dir' | 'displayName' | 'modifiedAt'>;

const activityLabels: Record<ProjectActivity, string> = {
  running: 'Trabajando', waiting: 'Esperando tu respuesta', idle: '', unknown: 'Estado no disponible',
};

/** Display only: a running turn and a question waiting for an answer are distinct. */
export function ProjectsMenuList(props: {
  projects: SwitcherProject[];
  currentId: string;
  activity: (id: string) => ProjectActivity;
  loading?: boolean;
  error?: boolean;
  switchingId?: string | null;
  onSelect: (project: SwitcherProject) => void;
}) {
  const sorted = createMemo(() => {
    const rank = { running: 0, waiting: 1, idle: 2, unknown: 2 };
    return [...props.projects].sort((a, b) =>
      rank[props.activity(a.id || a.name)] - rank[props.activity(b.id || b.name)]
      || parseTimestamp(b.modifiedAt) - parseTimestamp(a.modifiedAt)
      || a.displayName.localeCompare(b.displayName),
    );
  });
  return <>
    <Show when={props.loading && !props.projects.length}><p class="syka-project-menu-message" role="status">Cargando proyectos…</p></Show>
    <Show when={props.error}><p class="syka-project-menu-message" role="status">No se pudo actualizar la lista.</p></Show>
    <Show when={!props.loading && !props.error && !props.projects.length}><p class="syka-project-menu-message">No hay proyectos guardados.</p></Show>
    <For each={sorted()}>{entry => {
      const id = () => entry.id || entry.name;
      const activity = () => props.activity(id());
      const current = () => props.currentId === id();
      return <DropdownMenuItem
        tone="neutral"
        class="syka-project-menu-row"
        data-project-id={id()}
        data-project-activity={activity()}
        aria-current={current() ? 'page' : undefined}
        aria-label={[entry.displayName, current() ? 'Proyecto actual' : '', activityLabels[activity()]].filter(Boolean).join(' · ')}
        title={`${entry.displayName}\n${entry.dir}${activityLabels[activity()] ? '\n' + activityLabels[activity()] : ''}`}
        disabled={!!props.switchingId}
        onSelect={() => props.onSelect(entry)}
      >
        <span class="syka-project-menu-current" aria-hidden="true">{current() ? '✓' : ''}</span>
        <span class="syka-project-menu-name">{entry.displayName}</span>
        <span class="syka-project-menu-activity" aria-hidden="true">
          <Show when={activity() === 'running'}><span class="syka-project-activity-spinner" /></Show>
          <Show when={activity() === 'waiting'}><span class="syka-project-waiting-dot" /></Show>
          <Show when={activity() === 'unknown'}><span class="syka-project-unknown">—</span></Show>
        </span>
      </DropdownMenuItem>;
    }}</For>
  </>;
}

/** Reads project/chat summaries; changing projects never cancels a chat turn. */
export function ProjectsMenu() {
  const project = useProject();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = createSignal(false);
  const [switchingId, setSwitchingId] = createSignal<string | null>(null);
  const [projects, { refetch }] = createResource(projectsRevision, listProjects);
  const activity = (id: string): ProjectActivity => {
    if (chatState.connection !== 'open') return 'unknown';
    const chats = chatState.lists[id];
    if (!chats) return 'unknown';
    if (chats.some(chat => chat.status === 'running')) return 'running';
    if (chats.some(chat => chat.status === 'waiting')) return 'waiting';
    return 'idle';
  };

  createEffect(() => {
    const entries = projects();
    if (!open() || !entries) return;
    let active = true, refreshing = false;
    const refresh = async () => {
      if (!active || refreshing) return;
      refreshing = true;
      let next = 0;
      try {
        await Promise.all(Array.from({ length: Math.min(4, entries.length) }, async () => {
          while (active && next < entries.length) {
            const entry = entries[next++];
            await refreshChats(projectKey(entry));
          }
        }));
      } finally { refreshing = false; }
    };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 4000);
    onCleanup(() => { active = false; clearInterval(timer); });
  });

  const switchTo = async (entry: SwitcherProject) => {
    const id = entry.id || entry.name;
    if (switchingId() || id === project.id()) return;
    if (renderOverlay()) {
      toast('Esperá a que termine la exportación antes de cambiar de proyecto.');
      return;
    }
    setSwitchingId(id);
    try {
      await drainProjectEdits(project.dir());
      const record = projects()?.find(item => projectKey(item) === id);
      if (!record) throw Error('El proyecto ya no está en la lista.');
      const found = await openProjectFromList(record);
      if (found) navigate(projectRoute(projectKey(found)), { state: location.state });
    } catch (error) {
      toast.error('No se pudo abrir el proyecto', { description: error instanceof Error ? error.message : String(error) });
    } finally { setSwitchingId(null); }
  };

  return <DropdownMenuSub onOpenChange={value => { setOpen(value); if (value) void refetch(); }}>
    <DropdownMenuSubTrigger>Proyectos</DropdownMenuSubTrigger>
    <DropdownMenuPortal>
      <DropdownMenuSubContent class="syka-projects-submenu" aria-label="Cambiar de proyecto">
        <ProjectsMenuList projects={projects() ?? []} currentId={project.id()} activity={activity}
          loading={projects.loading} error={!!projects.error} switchingId={switchingId()} onSelect={entry => { void switchTo(entry); }} />
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>;
}
