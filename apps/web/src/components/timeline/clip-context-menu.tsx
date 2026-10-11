import { createMemo, createSignal, Show, untrack, type JSX } from 'solid-js';
import { useWorld } from '@diffusionstudio/koota-solid';
import { toast } from 'somoto';
import type { Entity } from 'koota';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from '@/components/ui/context-menu';
import { useEditor } from '@/engine/hooks';
import { useEngineContext } from '@/engine/context';
import { getEditHistory } from '@/engine/history';
import { audioDetachReason, detachAudio } from '@/engine/audio-detach';
import { canSplitAtPlayhead, splitAtPlayhead } from '@/engine/split';
import { TimelineSurface } from '@/engine/timeline/surface';
import { contextClip, selectContextClip } from '@/engine/timeline/context-target';

export function ClipContextMenu(props: { children: JSX.Element }) {
  const world = useWorld();
  const editor = useEditor();
  const { frame } = useEngineContext();
  const history = getEditHistory(world);
  const [targets, setTargets] = createSignal<Entity[]>([]);
  const selected = createMemo(() => {
    frame();
    const entities = targets();
    return untrack(() => entities.every(entity => entity.isAlive())) ? entities : [];
  });
  // Opening on a new target must update disabled states immediately, even
  // before the next engine tick; ticks still refresh metadata and source state.
  const reason = createMemo(() => {
    frame();
    const entities = selected();
    return untrack(() => entities.length ? audioDetachReason(world, entities) : 'Hacé clic derecho sobre un clip de video con audio.');
  });
  const canSplit = createMemo(() => {
    frame();
    const hasTarget = selected().length > 0;
    return untrack(() => hasTarget && canSplitAtPlayhead(world));
  });
  const run = (command: () => unknown) => {
    try { command(); } catch (error) { toast.error('No se pudo aplicar el cambio', { description: error instanceof Error ? error.message : String(error) }); }
  };
  const targetClip = (event: MouseEvent) => {
    // Prevent the page's text/browser context menu from replacing this editor menu.
    event.stopPropagation();
    const pointer = world.get(TimelineSurface)?.pointer;
    setTargets(selectContextClip(world, contextClip(world, pointer?.hitAt(event.clientX, event.clientY) ?? null)));
  };
  return <ContextMenu>
    <ContextMenuTrigger as="div" class="relative size-full" onContextMenu={targetClip} data-timeline-clip-menu>
      {props.children}
    </ContextMenuTrigger>
    <ContextMenuPortal><ContextMenuContent class="w-[250px]" aria-label="Acciones del clip" onEscapeKeyDown={event => event.stopPropagation()}>
      <ContextMenuItem disabled={!history.canUndo()} onSelect={() => history.undo()}>Deshacer<ContextMenuShortcut>Ctrl+Z</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem disabled={!history.canRedo()} onSelect={() => history.redo()}>Rehacer<ContextMenuShortcut>Ctrl+Shift+Z</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={!canSplit()} onSelect={() => run(() => splitAtPlayhead(world))}>Dividir en el cabezal<ContextMenuShortcut>Ctrl+B</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem disabled={!selected().length} onSelect={() => run(() => history.command(() => editor.duplicate(selected())))}>Duplicar<ContextMenuShortcut>Ctrl+D</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem disabled={!selected().length} onSelect={() => run(() => history.command(() => editor.remove(selected())))}>Borrar<ContextMenuShortcut>Supr</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={!!reason()} aria-describedby={reason() ? 'clip-audio-disabled-reason' : undefined} onSelect={() => run(() => detachAudio(world, selected()))}>Separar audio</ContextMenuItem>
      <Show when={reason()}><p id="clip-audio-disabled-reason" class="px-2 pb-2 pt-1 text-xxs text-muted-foreground leading-relaxed">{reason()}</p></Show>
    </ContextMenuContent></ContextMenuPortal>
  </ContextMenu>;
}
