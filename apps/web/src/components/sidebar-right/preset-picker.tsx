import {
  createEffect,
  createSignal,
  createUniqueId,
  For,
  Show,
  onCleanup,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { Icon } from '@/components/ui/icon';
import { EDITOR_RESOURCES, type ResourceKind } from './resources';
import { PresetPreview } from './preset-preview';
import { RESOURCE_DRAG_TYPE, RESOURCE_PREVIEW_DRAG_TYPE } from './library-model';
import { AgentReferenceMenu } from './agent-reference-menu';
import { referenceThumbnail } from '@/agent-chat/reference-attachments';
import { referenceInChat, selectionContext } from '@/agent-chat/visual-context';
import { useProject } from '@/context/project';
import { useWorld } from '@diffusionstudio/koota-solid';

export function PresetPicker(props: {
  kind: ResourceKind;
  label: string;
  text?: boolean;
  audio?: boolean;
  onSelect: (value: string) => void;
}) {
  const project = useProject(), world = useWorld();
  const [open, setOpen] = createSignal(false),
    [playing, setPlaying] = createSignal('');
  const [present, setPresent] = createSignal(false);
  const [position, setPosition] = createSignal({ left: 8, top: 8, width: 300 });
  const id = createUniqueId();
  let trigger!: HTMLButtonElement, panel!: HTMLDivElement;
  let closing: ReturnType<typeof setTimeout> | undefined;
  const reposition = () => {
    if (!trigger || !panel) return;
    const anchor = trigger.getBoundingClientRect();
    const sidebar = trigger
      .closest('.syka-right-sidebar')
      ?.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 16);
    const height = Math.min(panel.scrollHeight, 520, window.innerHeight - 16);
    setPosition({
      width,
      left: Math.max(
        8,
        Math.min(
          (sidebar?.left ?? anchor.left) - width - 8,
          window.innerWidth - width - 8,
        ),
      ),
      top: Math.max(8, Math.min(anchor.top, window.innerHeight - height - 8)),
    });
  };
  const close = (restoreFocus = false) => {
    setOpen(false);
    setPlaying('');
    clearTimeout(closing);
    closing = setTimeout(() => setPresent(false), 150);
    if (restoreFocus) trigger.focus({ preventScroll: true });
  };
  const show = (focus = false) => {
    clearTimeout(closing);
    setPresent(true);
    setOpen(true);
    queueMicrotask(() => {
      reposition();
      if (focus)
        panel
          ?.querySelector<HTMLButtonElement>('button')
          ?.focus({ preventScroll: true });
    });
  };
  createEffect(() => {
    if (!open()) return;
    const outside = (event: PointerEvent) => {
      const path = event.composedPath();
      if (!path.includes(trigger) && !path.includes(panel)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close(true);
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('scroll', reposition, true);
    const observer = new ResizeObserver(reposition);
    queueMicrotask(() => {
      if (panel && open()) observer.observe(panel);
    });
    onCleanup(() => {
      observer.disconnect();
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('scroll', reposition, true);
    });
  });
  onCleanup(() => clearTimeout(closing));
  return (
    <>
      <button
        ref={trigger}
        type="button"
        class="syka-preset-add"
        aria-label={props.label}
        aria-haspopup="dialog"
        aria-expanded={open()}
        aria-controls={present() ? id : undefined}
        title={props.label}
        onClick={(event) => (open() ? close() : show(event.detail === 0))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            show(true);
          }
        }}
      >
        <Icon name="plus-add" />
      </button>
      <Show when={present()}>
        <Portal>
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={props.label}
            aria-hidden={!open()}
            class="syka-preset-picker t-dropdown"
            data-expanded={open() ? '' : undefined}
            data-closed={open() ? undefined : ''}
            data-origin="top-right"
            onKeyDown={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
            style={{
              position: 'fixed',
              left: position().left + 'px',
              top: position().top + 'px',
              width: position().width + 'px',
            }}
          >
            <strong>{props.label}</strong>
            <p>Pasá sobre una muestra para verla en movimiento.</p>
            <div class="syka-resource-grid">
              <For
                each={EDITOR_RESOURCES.filter(
                  (r) => r.kind === props.kind && (!r.textOnly || props.text),
                )}
              >
                {(r) => (
                  <AgentReferenceMenu onUse={preview => { referenceInChat(project.id(), 'Usá este preset como referencia visual para mi edición. Revisá la selección y proponé cómo adaptarlo.', {preset:{id:r.id,label:r.label,kind:r.kind,value:r.value},...selectionContext(world)}, preview); close(); }}>
                  <button
                    class="syka-resource-card"
                    draggable="true"
                    aria-label={'Agregar ' + r.label}
                    onDragStart={(event) => {
                      if (!event.dataTransfer) return;
                      event.dataTransfer.setData(RESOURCE_DRAG_TYPE, r.id);
                      event.dataTransfer.effectAllowed = 'copy';
                      const preview = referenceThumbnail(event.currentTarget);
                      if (preview) event.dataTransfer.setData(RESOURCE_PREVIEW_DRAG_TYPE, preview);
                      setPlaying('');
                    }}
                    onDragEnd={() => close()}
                    onPointerEnter={() => setPlaying(r.id)}
                    onPointerLeave={() => setPlaying('')}
                    onFocus={() => setPlaying(r.id)}
                    onBlur={() => setPlaying('')}
                    onClick={() => {
                      props.onSelect(r.value);
                      close();
                    }}
                  >
                    <span class="syka-resource-thumb">
                      <PresetPreview
                        resource={r}
                        playing={playing() === r.id}
                      />
                    </span>
                    <span>{r.label}</span>
                  </button>
                  </AgentReferenceMenu>
                )}
              </For>
              <Show when={props.audio}>
                <button
                  class="syka-resource-card"
                  aria-label="Agregar Volume"
                  onClick={() => {
                    props.onSelect('gain');
                    close();
                  }}
                >
                  <span class="syka-resource-thumb">0 → 100%</span>
                  <span>Volume · audio</span>
                </button>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
}
