/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Icon } from '@/components/ui/icon';
import { ChatIdentityOrb } from './chat-identity-orb';
import { ChatPlacementButton } from './chat-placement-control';
import { chatFloating, setChatFloating, fullscreenChatMount } from './chat-presentation';
import { ContextMenu, ContextMenuTrigger, ContextMenuPortal, ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu';

export function ChatIdentityHeader(props: {
  working: boolean;
  blocked?: boolean;
  sessionsOpen: boolean;
  onToggleSessions(): void;
}) {
  return (
    <ContextMenu>
    <ContextMenuTrigger as="header" tabIndex={props.blocked?-1:0} inert={props.blocked} class="syka-chat-identity" data-chat-drag-handle aria-label="Navegación del chat" title={chatFloating()?'Arrastrá para mover el chat':'Conversaciones y proyectos'}>
      <button type="button" class="syka-session-toggle" aria-label="Sesiones y proyectos"
        aria-expanded={props.sessionsOpen} onClick={props.onToggleSessions}>
        <Icon name="sidebar" class="size-4" />
      </button>
      <ChatIdentityOrb working={props.working || !!props.blocked} paused={props.blocked} />
      <ChatPlacementButton />
    </ContextMenuTrigger>
    <ContextMenuPortal><ContextMenuContent class="syka-chat-placement-menu" aria-label="Posición del chat">
      <ContextMenuItem disabled={!!fullscreenChatMount()} onSelect={()=>setChatFloating(!chatFloating())}>{chatFloating()?'Acoplar a la barra lateral':'Desacoplar chat'}</ContextMenuItem>
    </ContextMenuContent></ContextMenuPortal>
    </ContextMenu>
  );
}
