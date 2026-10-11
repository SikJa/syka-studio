/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


type HeaderActionsProps = {
  projectId: string;
  /** The chat the panel shows; null for the empty draft. */
  chatId: string | null;
  onNewChat(): void;
  onOpenChat(chatId: string): void;
};

/** History (Chat history) and plus (Nuevo chat), at the right of the header. */
export function HeaderActions(props: HeaderActionsProps) {
  return (
    <div class="ml-auto flex items-center gap-1 relative z-30" style="-webkit-app-region: no-drag;">
      <Tooltip placement="bottom">
        <TooltipTrigger
          as={Button}
          variant="ghost"
          size="icon"
          class="text-muted-foreground"
          aria-label="Nuevo chat"
          data-chat-action="new"
          disabled={props.chatId === null}
          onClick={props.onNewChat}
        >
          <Icon name="plus-add" />
        </TooltipTrigger>
        <TooltipContent>Nuevo chat</TooltipContent>
      </Tooltip>
    </div>
  );
}
