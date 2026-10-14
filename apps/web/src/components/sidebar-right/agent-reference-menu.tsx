import { createSignal, onCleanup, Show, type JSX } from 'solid-js';
import { ContextMenu, ContextMenuTrigger, ContextMenuPortal, ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu';
import { referenceThumbnail } from '@/agent-chat/reference-attachments';
import type {MascotRect} from '@/agent-chat/mascot-journey';
import './agent-reference-menu.css';

export function AgentReferenceMenu(props: { children: JSX.Element; onUse(preview?: string,origin?:MascotRect): void }) {
  let trigger!: HTMLDivElement;
  let content!: HTMLDivElement;
  let used = false;
  let keyboard = false;
  const [present, setPresent] = createSignal(false);
  let closing: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(closing));
  return <ContextMenu forceMount={present()} onOpenChange={open => {
    clearTimeout(closing);
    if (open) { used = false; setPresent(true); }
    else {
      keyboard = false;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.sykaMotion === 'reduced';
      // Keep the portal until its close animation finishes. Kobalte can
      // otherwise dispose it before the data-closed styles are measured.
      closing = setTimeout(() => setPresent(false), reduced ? 0 : 150);
    }
  }}>
    <ContextMenuTrigger ref={trigger} class="syka-resource-menu" onKeyDown={(event: KeyboardEvent) => {
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
      event.preventDefault(); event.stopPropagation();
      keyboard = true;
      const rect = trigger.getBoundingClientRect();
      trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, cancelable:true, clientX:rect.left + 20, clientY:rect.top + 20 }));
    }}>
      {props.children}
    </ContextMenuTrigger>
    <Show when={present()}><ContextMenuPortal>
      <ContextMenuContent ref={content} class="syka-reference-menu t-dropdown" onKeyDown={(event: KeyboardEvent) => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target === content) {
          event.preventDefault(); event.stopPropagation();
          content.querySelector<HTMLElement>('[role="menuitem"]')?.click();
        }
      }} onOpenAutoFocus={event => {
        if (!keyboard) return;
        event.preventDefault();
        // Kobalte defers its collection focus until after the items register.
        // Focus the first action after that pass, rather than racing it.
        requestAnimationFrame(() => { if (content?.isConnected && keyboard) content.querySelector<HTMLElement>('[role="menuitem"]')?.focus(); });
      }} onCloseAutoFocus={event => {
        event.preventDefault();
        if (!used) trigger.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
      }}>
        <ContextMenuItem onSelect={() => { used = true; const r=trigger.getBoundingClientRect();props.onUse(referenceThumbnail(trigger),{x:r.x,y:r.y,width:r.width,height:r.height}); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-5 4z"/></svg>
          Usar con el agente
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal></Show>
  </ContextMenu>;
}
