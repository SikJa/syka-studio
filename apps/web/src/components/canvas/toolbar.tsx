/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { SceneSwitcher } from './scene-switcher';
import { CanvasTransport } from './transport';
import { PreviewIcon } from './preview-icon';
import { ActionBar } from "../genai/action-bar";
import { ObjectMaskBar } from "./object-mask-bar";
import { ClipPathBar } from "./clip-path-bar";
import { For, Match, Show, Switch, createEffect, createMemo, onCleanup, onMount } from "solid-js";
import { Tool, ToolType, getSelection } from "@diffusionstudio/runtime";
import { useDerived } from '@/engine/hooks';
import { useProject } from '@/context/project';
import { referenceInChat, selectionContext } from '@/agent-chat/visual-context';
import { visualPickMode, setVisualPickMode, VISUAL_SELECT_SHORTCUT, requestScreenRecording } from '@/agent-chat/visual-target-state';
import { activeChatId, draftKey } from '@/agent-chat/store';
import { ambientLight, setAmbientLight } from './ambient-light';
import { useWorld } from "@diffusionstudio/koota-solid";
import { clearClipPathTarget, useTool } from "@/engine";
import { t } from '@/i18n';

const CURSOR_TOOLS = [
  { tool: ToolType.MOVE, get label() { return t('Seleccionar'); }, shortcut: 'V', icon: 'move', menuIcon: 'move-small' },
  { tool: ToolType.HAND, get label() { return t('Mano'); }, shortcut: 'H', icon: 'hand', menuIcon: 'hand' },
  { tool: ToolType.OBJECT_MASK, get label() { return t('Máscara de objeto'); }, shortcut: 'M', icon: 'object-mask', menuIcon: 'object-mask' },
] as const;

export function Toolbar(props: { fullscreen: boolean; onFullscreen: () => void; portalMount: HTMLElement }) {
  const world = useWorld();
  const project = useProject();
  const hasSelection = useDerived(() => getSelection(world).length > 0);
  const selectedTool = useTool();
  const cursorTool = createMemo(() => CURSOR_TOOLS.find((cursor) => cursor.tool === selectedTool()));
  let dock!: HTMLDivElement;

  onMount(() => {
    const preview = dock.closest<HTMLElement>('.syka-canvas-preview');
    if (!preview) return;
    // Wrapping controls must reserve their real height instead of covering the video.
    const reserveDock = () => preview.style.setProperty('--syka-preview-dock-height', `${Math.ceil(dock.getBoundingClientRect().height)}px`);
    const observer = new ResizeObserver(reserveDock);
    observer.observe(dock);
    reserveDock();
    onCleanup(() => { observer.disconnect(); preview.style.removeProperty('--syka-preview-dock-height'); });
  });

  createEffect(() => {
    if (selectedTool() !== ToolType.CLIP_PATH) {
      clearClipPathTarget();
    }
  });

  const handleToolChange = (tool: ToolType) => {
    setVisualPickMode(null);
    world.set(Tool, { value: tool });
  }

  return (
    <>
      <Show when={!props.fullscreen}><SceneSwitcher />
        <Switch fallback={<ActionBar />}>
          <Match when={selectedTool() === ToolType.OBJECT_MASK}>
            <ObjectMaskBar />
          </Match>
          <Match when={selectedTool() === ToolType.CLIP_PATH}>
            <ClipPathBar />
          </Match>
        </Switch>
      </Show>
      <div ref={dock} class="syka-canvas-dock">
        <CanvasTransport fullscreen={props.fullscreen} onFullscreen={props.onFullscreen} portalMount={props.portalMount} />
        <Show when={props.fullscreen}><Button size="icon-square" variant="ghost" aria-label="Luz ambiental" title="Activar o apagar la luz ambiental" aria-pressed={ambientLight()} onClick={()=>setAmbientLight(!ambientLight())}><PreviewIcon name="ambient"/></Button></Show>
        <Button size="icon-square" variant="ghost" data-tour-target="visual-select" aria-label="Señalar componente editable" aria-keyshortcuts="Control+Shift+S Meta+Shift+S" title={`Señalar componente · ${VISUAL_SELECT_SHORTCUT}`} aria-pressed={visualPickMode()==='element'} onClick={()=>setVisualPickMode(visualPickMode()==='element'?null:'element')}><PreviewIcon name="inspect"/></Button>
        <Button size="icon-square" variant="ghost" data-tour-target="visual-capture" aria-label="Capturar zona para el agente" title="Marcar y capturar una zona del video" aria-pressed={visualPickMode()==='region'} onClick={()=>setVisualPickMode(visualPickMode()==='region'?null:'region')}><PreviewIcon name="camera"/></Button>
        <Button size="icon-square" variant="ghost" aria-label="Grabar una zona de la pantalla" title="Grabar una zona de la pantalla" onClick={()=>{setVisualPickMode(null);requestScreenRecording({region:true,chatKey:draftKey(project.id(),activeChatId(project.id()))});}}><PreviewIcon name="record"/></Button>
        <Show when={hasSelection()}><Button size="icon-square" variant="ghost" aria-label="Consultar selección con el agente" title="Consultar selección con el agente" onClick={() => referenceInChat(project.id(), 'Quiero consultar o modificar estos elementos. Preguntame qué cambio quiero antes de editar.', selectionContext(world))}><PreviewIcon name="chat" /></Button></Show>
        <Show when={!props.fullscreen}>
        <div role="toolbar" aria-label="Herramientas del lienzo" class="syka-canvas-tools">
        <div class="flex gap-1">
          <Tooltip>
            <TooltipTrigger
              as={Button}
              size="icon-square"
              class={cursorTool() ? 'text-foreground' : 'text-muted-foreground'}
              variant={cursorTool() ? 'default' : 'ghost'}
              aria-label={(cursorTool() ?? CURSOR_TOOLS[0]!).label}
              onClick={() => handleToolChange(cursorTool()?.tool ?? ToolType.MOVE)}
            >
              {cursorTool()?.tool === ToolType.MOVE ? <PreviewIcon name="move" /> : <Icon name={(cursorTool() ?? CURSOR_TOOLS[0]!).icon} />}
            </TooltipTrigger>
            <TooltipContent shortcut={(cursorTool() ?? CURSOR_TOOLS[0]!).shortcut}>
              {(cursorTool() ?? CURSOR_TOOLS[0]!).label}
            </TooltipContent>
          </Tooltip>
          <DropdownMenu placement="top-start">
            <Tooltip>
              <TooltipTrigger<typeof DropdownMenuTrigger>
                as={(triggerProps: object) => (
                  <DropdownMenuTrigger<typeof Button>
                    {...triggerProps}
                    as={(buttonProps) => (
                      <Button {...buttonProps} size="icon-select" variant="ghost" class="text-muted-foreground" aria-label="Elegir herramienta">
                        <PreviewIcon name="chevron" />
                      </Button>
                    )}
                  />
                )}
              />
              <TooltipContent>Elegir herramienta</TooltipContent>
            </Tooltip>
            <DropdownMenuPortal>
              <DropdownMenuContent>
                <For each={CURSOR_TOOLS}>
                  {(cursor) => (
                    <DropdownMenuItem class="px-0 pr-2 gap-0.5" onSelect={() => handleToolChange(cursor.tool)}>
                      <div classList={{ "visible": selectedTool() === cursor.tool }} class="invisible">
                        <Icon name="confirm-check" class="text-foreground" />
                      </div>
                      <Icon name={cursor.menuIcon} class="text-foreground" />
                      <span class="mx-1 flex-1 whitespace-nowrap">{cursor.label}</span>
                      <DropdownMenuShortcut class="pl-6">{cursor.shortcut}</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  )}
                </For>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        </div>
        <Separator orientation="vertical" class="min-h-5" />
        <Tooltip>
          <TooltipTrigger
            as={Button}
            size="icon-square"
            variant={selectedTool() === ToolType.SCENE ? 'default' : 'ghost'}
            aria-label="Crear lienzo"
            onClick={() => handleToolChange(ToolType.SCENE)}
            class={selectedTool() === ToolType.SCENE ? 'text-foreground' : 'text-muted-foreground'}
          >
            <PreviewIcon name="frame" />
          </TooltipTrigger>
          <TooltipContent shortcut="F">Lienzo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            as={Button}
            size="icon-square"
            variant={selectedTool() === ToolType.RECT ? 'default' : 'ghost'}
            aria-label="Rectángulo"
            onClick={() => handleToolChange(ToolType.RECT)}
            class={selectedTool() === ToolType.RECT ? 'text-foreground' : 'text-muted-foreground'}
          >
            <PreviewIcon name="rectangle" />
          </TooltipTrigger>
          <TooltipContent shortcut="R">Rectángulo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            as={Button}
            size="icon-square"
            variant={selectedTool() === ToolType.TEXT ? 'default' : 'ghost'}
            aria-label="Texto"
            onClick={() => handleToolChange(ToolType.TEXT)}
            class={selectedTool() === ToolType.TEXT ? 'text-foreground' : 'text-muted-foreground'}
          >
            <PreviewIcon name="text" />
          </TooltipTrigger>
          <TooltipContent shortcut="T">Texto</TooltipContent>
        </Tooltip>
        </div>
        </Show>
      </div>
    </>
  );
}
