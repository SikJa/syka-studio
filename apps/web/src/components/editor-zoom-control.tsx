/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Icon } from "@/components/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useWorld } from "@diffusionstudio/koota-solid";
import { Show } from "solid-js";
import { setCameraLocked, useCameraLocked, useCameraScale, zoomBy, zoomTo, zoomToFit, zoomToStageContent } from "@/engine";

export function EditorZoomControl() {
  const world = useWorld();

  // Camera commands own the active scene and viewport geometry; the menu only
  // distinguishes editing that scene from exploring the complete stage.
  const scale = useCameraScale();
  const locked = useCameraLocked();
  const zoomLabel = () => `${Math.round(scale() * 100)}%`;

  return (
    <div class="h-7 shrink-0 flex items-center gap-2 pl-3 border-l border-border" data-editor-zoom>
      <span class="text-[12px] leading-5 font-450 text-foreground">Editor</span>
      <DropdownMenu placement="top-end">
        <DropdownMenuTrigger<typeof Button>
          as={(triggerProps) => (
            <Button
              {...triggerProps}
              variant="link"
              aria-label={`Zoom del editor: ${zoomLabel()}`}
              disabled={locked()}
              title={locked() ? "Desbloqueá el lienzo para cambiar el zoom" : "Cambiar zoom del editor"}
              class="flex items-center gap-0 text-muted-foreground px-0 relative z-30"
              style="-webkit-app-region: no-drag;"
            >
              <span>{zoomLabel()}</span>
              <Icon name="chevron-down" class="size-6 shrink-0" />
            </Button>
          )}
        />
        <DropdownMenuPortal>
          <DropdownMenuContent class="w-[220px]" onEscapeKeyDown={event => event.stopPropagation()}>
            <DropdownMenuItem onSelect={() => zoomBy(world, 1.25)}>
              Acercar
              <DropdownMenuShortcut>Ctrl+</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => zoomBy(world, 0.8)}>
              Alejar
              <DropdownMenuShortcut>Ctrl−</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => zoomToFit(world)}>
              Ajustar a escena activa
              <DropdownMenuShortcut>Ctrl+1</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => zoomToStageContent(world)}>
              Ver todo el lienzo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => zoomTo(world, 0.5)}>
              Zoom al 50%
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => zoomTo(world, 1)}>
              Zoom al 100%
              <DropdownMenuShortcut>Ctrl+0</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => zoomTo(world, 2)}>
              Zoom al 200%
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
      <Button
        variant={locked() ? "on" : "ghost"}
        size="icon-square"
        aria-label={locked() ? "Desbloquear zoom y lienzo" : "Bloquear zoom y lienzo"}
        aria-pressed={locked()}
        title={locked() ? "Vista bloqueada. Clic para desbloquear" : "Bloquear zoom y desplazamiento del lienzo"}
        onClick={() => setCameraLocked(world, !locked())}
        data-camera-lock
      >
        <Show when={locked()} fallback={<Icon name="lock-open" class="size-5" />}>
          <Icon name="lock-closed" class="size-5" />
        </Show>
      </Button>
    </div>
  );
}
