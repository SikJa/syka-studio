import { Show } from 'solid-js';
import { useWorld } from '@diffusionstudio/koota-solid';
import { Selected, Source, Stage } from '@diffusionstudio/runtime';
import { toast } from 'somoto';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/components/ui/tooltip';
import { useDerived } from '@/engine/hooks';
import { getEditHistory } from '@/engine/history';
import { canSplitAtPlayhead, splitAtPlayhead } from '@/engine/split';
import { audioDetachReason, detachAudio } from '@/engine/audio-detach';
import { deleteSelection, duplicateSelection } from '@/engine/input/shortcuts';
import { timelineSnapping, setTimelineSnapping } from '@/engine/timeline/preferences';
import { EditorZoomControl } from '@/components/editor-zoom-control';

function Action(props: { label: string; icon: string; shortcut?: string; disabled?: boolean; reason?: string; active?: boolean; tourTarget?: string; onClick: () => unknown }) {
  return <Tooltip><TooltipTrigger as="span" class="inline-flex" tabIndex={props.disabled ? 0 : undefined}>
    <Button variant={props.active ? 'on' : 'ghost'} class="gap-1 px-2" disabled={props.disabled}
      aria-label={props.label} aria-pressed={props.active} data-tour-target={props.tourTarget} onClick={() => {
        try { props.onClick(); } catch (error) { toast.error('No se pudo aplicar el cambio', { description: String(error instanceof Error ? error.message : error) }); }
      }}>
      <Icon name={props.icon} class="size-5" /><span>{props.label}</span>
    </Button>
  </TooltipTrigger><TooltipPortal><TooltipContent shortcut={props.shortcut}>{props.reason || props.label}</TooltipContent></TooltipPortal></Tooltip>;
}

/** Commands use the same editor/history as keyboard shortcuts and source persistence. */
export function TimelineToolbar() {
  const world = useWorld();
  const history = getEditHistory(world);
  const selected = useDerived(() => world.query(Selected).some(entity => !entity.has(Stage) && !!entity.get(Source)?.value));
  const canSplit = useDerived(() => canSplitAtPlayhead(world));
  const detachReason = useDerived(() => audioDetachReason(world));
  return <div role="toolbar" aria-label="Herramientas de timeline" class="col-span-full flex items-center gap-1 h-9 px-2 border-b border-border bg-sidebar overflow-x-auto">
    <Action label="Deshacer" icon="timeline-undo" tourTarget="undo" shortcut="Ctrl+Z" disabled={!history.canUndo()} reason={!history.canUndo() ? history.problem() || history.boundary() || 'Todavía no hay cambios para deshacer.' : undefined} onClick={() => history.undo()} />
    <Action label="Rehacer" icon="timeline-redo" shortcut="Ctrl+Shift+Z" disabled={!history.canRedo()} reason={history.problem()} onClick={() => history.redo()} />
    <div class="w-px h-4 mx-1 bg-border shrink-0" />
    <Action label="Dividir" icon="split" shortcut="Ctrl+B" disabled={!canSplit()} reason={!canSplit() ? 'Ubicá el cabezal dentro de un clip para dividirlo.' : undefined} onClick={() => splitAtPlayhead(world)} />
    <Action label="Duplicar" icon="timeline-copy" shortcut="Ctrl+D" disabled={!selected()} onClick={() => history.command(() => duplicateSelection(world))} />
    <Action label="Borrar" icon="trash" shortcut="Supr" disabled={!selected()} onClick={() => history.command(() => deleteSelection(world))} />
    <div class="w-px h-4 mx-1 bg-border shrink-0" />
    <Action label="Separar audio" icon="audio-small" disabled={!!detachReason()} reason={detachReason() || 'Conserva el video arriba y crea su audio abajo, con el mismo recorte y velocidad. El sonido sale de la nueva pista; un solo Deshacer reúne ambos.'} onClick={() => detachAudio(world)} />
    <Action label="Snapping" icon="timeline-magnet" shortcut="N" active={timelineSnapping()} reason={timelineSnapping() ? 'Ajuste magnético activado: los clips se alinean al cabezal y a otros bordes.' : 'Ajuste magnético desactivado.'} onClick={() => setTimelineSnapping(!timelineSnapping())} />
    <Show when={history.boundary()}>
      <span role="status" class="ml-auto text-xxs text-muted-foreground whitespace-nowrap px-2" title={history.boundary()}>Historial manual nuevo</span>
    </Show>
    <Show when={history.shared()}>
      <Show when={history.problem()}><span class="ml-auto text-xxs text-muted-foreground whitespace-nowrap px-2" role="status" title={history.problem()}>No se puede deshacer</span></Show>
    </Show>
    <div class="ml-auto shrink-0"><EditorZoomControl /></div>
  </div>;
}
