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
import { onCleanup, onMount } from "solid-js";
import { isInputTarget } from "@/utils";
import type { ProjectRouteState } from "@/hooks/use-project-route";
import { FileMenu } from "./file-menu";
import { EditMenu } from "./edit-menu";
import { ViewMenu } from "./view-menu";
import { ToolMenu } from "./tool-menu";
import { HelpMenu } from "./help-menu";
import { ProjectsMenu } from "./projects-menu";
import { EditorTour } from '@/components/onboarding/editor-tour';

export function ProjectMenu() {
  let menuAnchor: HTMLButtonElement | undefined;
  const navigate = useNavigate();
  const location = useLocation<ProjectRouteState>();

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
      <DropdownMenu placement="bottom-start">
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
          <DropdownMenuContent class="w-[196px]">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={handleOpenDashboard}>
                Volver al inicio
                <DropdownMenuShortcut>⇧⌘D</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <ProjectsMenu />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Archivo</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent class="w-[196px]">
                    <FileMenu />
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
              <DropdownMenuItem onSelect={handleOpenGlossary}>Configuración / Glosario</DropdownMenuItem>
            </DropdownMenuGroup>

          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
      <EditorTour menuAnchor={() => menuAnchor} />
    </>
  );
}
