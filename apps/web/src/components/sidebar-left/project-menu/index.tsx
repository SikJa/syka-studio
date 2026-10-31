/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Icon } from "@/components/ui/icon";
import { SykaBrandOrb } from "@/components/ui/syka-brand-orb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { useLocation, useNavigate } from "@solidjs/router";
import { createSignal, onCleanup, onMount } from "solid-js";
import { isInputTarget } from "@/utils";
import type { ProjectRouteState } from "@/hooks/use-project-route";
import { FileMenu, useNewProjectAction } from "./file-menu";
import { EditMenu } from "./edit-menu";
import { ViewMenu } from "./view-menu";
import { ToolMenu } from "./tool-menu";
import { HelpMenu } from "./help-menu";
import { ProjectsMenu } from "./projects-menu";
import { ProjectActions, type ProjectActionTarget } from './project-actions';
import { DeleteProjectDialog, type DeletableProject } from '@/components/dashboard/delete-project-dialog';
import { useProject } from '@/context/project';
import { chatState } from '@/agent-chat/store';
import { renderOverlay } from '@/context/render';
import { useLibrary } from '@/engine/library';
import { EditorTour } from '@/components/onboarding/editor-tour';

export function ProjectMenu() {
  let menuAnchor: HTMLButtonElement | undefined;
  const navigate = useNavigate();
  const location = useLocation<ProjectRouteState>();
  const [open, setOpen] = createSignal(false);
  const [actionTarget, setActionTarget] = createSignal<ProjectActionTarget | null>(null);
  const handleNewProject = useNewProjectAction();
  const project = useProject();
  const library = useLibrary();
  const [pendingDelete, setPendingDelete] = createSignal<DeletableProject | null>(null);
  const deleteCurrent = () => setPendingDelete({ id: project.id(), dir: project.dir(), displayName: project.name() });

  const handleOpenDashboard = () => {
    (document.activeElement as HTMLElement)?.blur?.();
    navigate(location.state?.returnTo ?? "/");
  };

  const handleOpenAccount = () => {
    (document.activeElement as HTMLElement)?.blur?.();
    navigate("/?dashboard=account");
  };

  const handleOpenGlossary = () => {
    (document.activeElement as HTMLElement)?.blur?.();
    navigate("/?dashboard=glossary");
  };

  /**
   * Leaving the editor is the app's command rather than the runtime's, so its
   * key is bound here, with the item that offers it.
   */
  const handleShortcut = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
    if (event.key.toLowerCase() !== "d" || isInputTarget(event)) return;

    event.preventDefault();
    handleOpenDashboard();
  };

  onMount(() => {
    window.addEventListener("keydown", handleShortcut);
    onCleanup(() => window.removeEventListener("keydown", handleShortcut));
  });

  return (
    <>
      <DropdownMenu placement="bottom-start" open={open()} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          ref={menuAnchor}
          as="button"
          type="button"
          aria-label="Menú del proyecto"
          data-tour-target="project-menu"
          class="flex items-center gap-0 h-7 rounded-md text-muted-foreground outline-none focus-ring hover:text-foreground data-expanded:text-foreground"
        >
          <SykaBrandOrb />
          <div class="flex items-center justify-center overflow-clip h-6 w-4">
            <Icon name="chevron-down" class="size-6" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent class="w-[196px]" onCloseAutoFocus={event => { if (actionTarget()) event.preventDefault(); }}>
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={handleOpenDashboard}>
                Volver al inicio
                <DropdownMenuShortcut>⇧⌘D</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleNewProject}>Nuevo proyecto</DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <ProjectsMenu onContextRequest={(project, point) => {
                setOpen(false);
                queueMicrotask(() => setActionTarget({ project, ...point }));
              }} />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Archivo</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent class="w-[196px]">
                    <FileMenu onDeleteRequested={deleteCurrent} />
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Editar</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent class="w-[196px]">
                    <EditMenu />
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Vista</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent class="w-[216px]">
                    <ViewMenu />
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Herramientas</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent class="w-[172px]">
                    <ToolMenu />
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Ayuda</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent class="w-[188px]">
                    <HelpMenu />
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuItem onSelect={handleOpenAccount}>Perfil local</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleOpenGlossary}>Configuración</DropdownMenuItem>
            </DropdownMenuGroup>

          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
      <ProjectActions target={actionTarget()} onClose={() => setActionTarget(null)} onDelete={setPendingDelete} />
      <DeleteProjectDialog project={pendingDelete()} onClose={() => setPendingDelete(null)}
        beforeDelete={async entry => {
          if (renderOverlay()) throw Error('Esperá a que termine la exportación antes de eliminar el proyecto.');
          if (chatState.lists[entry.id]?.some(chat => chat.status === 'running' || chat.status === 'waiting')) throw Error('Esperá a que termine el turno de este proyecto antes de eliminarlo.');
          if (entry.id === project.id()) await library()?.flush();
        }}
        onDeleted={entry => { if (entry.id === project.id()) navigate('/?dashboard=projects'); }} />
      <EditorTour menuAnchor={() => menuAnchor} />
    </>
  );
}
