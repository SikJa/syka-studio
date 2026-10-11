import { For } from 'solid-js';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuPortal } from '@/components/ui/dropdown-menu';
import { PreviewIcon } from './preview-icon';
import './transport.css';
import { EDITOR_SHORTCUTS, platformShortcut } from './editor-shortcut-list';

export function EditorShortcuts(props: { portalMount?: HTMLElement; fullscreen?: boolean }) {
  return <div style="-webkit-app-region: no-drag;"><DropdownMenu placement={props.fullscreen ? 'top-end' : 'bottom-end'}>
    <DropdownMenuTrigger as={Button} size="icon-square" variant="ghost" aria-label="Atajos del editor" title="Atajos del editor"><PreviewIcon name="keyboard" /></DropdownMenuTrigger>
    <DropdownMenuPortal mount={props.portalMount}><DropdownMenuContent class="syka-speed-menu syka-shortcuts-menu">
      <strong>Atajos del editor</strong>
      <For each={EDITOR_SHORTCUTS}>{([key, label]) => <div><span>{label}</span><kbd>{platformShortcut(key)}</kbd></div>}</For>
    </DropdownMenuContent></DropdownMenuPortal>
  </DropdownMenu></div>;
}
