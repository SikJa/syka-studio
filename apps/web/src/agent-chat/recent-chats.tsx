/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// What an empty draft shows above the composer: the project's five most
// recent chats, name on the left, last use on the right. Nothing when the
// project has no chats yet.

import { For, Show } from "solid-js";

import { Icon } from "@/components/ui/icon";

import { relativeTime } from "./history-menu";
import { chatState } from "./store";

const RECENT = 5;

type RecentChatsProps = {
  projectId: string;
  onOpen(chatId: string): void;
};

export function RecentChats(props: RecentChatsProps) {
  const recent = () => (chatState.lists[props.projectId] ?? []).slice(0, RECENT);

  return (
    <Show when={recent().length > 0}>
      <div class="mx-4 mb-2 flex shrink-0 flex-col">
        <span class="px-2 pb-1 text-[11px] font-450 text-muted-foreground">Recent</span>
        <For each={recent()}>
          {(chat) => (
            <button
              type="button"
              class="flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground focus-ring"
              onClick={() => props.onOpen(chat.id)}
            >
              <Show when={chat.status === "running"}>
                <Icon name="spinner-loader" class="size-4 shrink-0 animate-spin text-muted-foreground" />
              </Show>
              <Show when={chat.status === "waiting"}>
                <Icon name="dot" class="size-4 shrink-0 text-primary" />
              </Show>
              <span class="min-w-0 flex-1 truncate" title={chat.title}>
                {chat.title}
              </span>
              <span class="shrink-0 text-[11px]">
                {chat.status === "waiting" ? "Needs you" : relativeTime(chat.updatedAt)}
              </span>
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}
