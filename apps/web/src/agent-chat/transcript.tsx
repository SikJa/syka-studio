/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The messages, top-anchored like a document and pinned to the bottom once
// they overflow: the end of the streaming text stays right above the
// composer, a wheel-up lets go, scrolling back near the bottom pins again.

import { For, Show, createEffect, createSignal, createMemo, on } from "solid-js";

import type { Item } from "@diffusionstudio/agent-chat";

import { ChatItem } from "./items";
import { TurnActivity } from "./turn-activity";
import { createStickToBottom } from "./stick-to-bottom";
import { transcriptPresentation } from './transcript-visibility';

type TranscriptProps = {
  items: Item[];
  /** Bumped by the panel after every send, to pin the view to the end. */
  sendCount: number;
  /** Changes with the chat, so a newly opened one starts at its end. */
  chatKey: string;
  /** A turn is running: the last item is where the agent is right now. */
  running: boolean;
  /** The turn is paused on a question: the card below is the affordance, not a loader. */
  waiting: boolean;
};

export function Transcript(props: TranscriptProps) {
  const [scrollEl, setScrollEl] = createSignal<HTMLDivElement>();
  const stick = createStickToBottom(scrollEl, { initial: "instant" });
  const byId=createMemo(()=>new Map(props.items.map(item=>[item.id,item])));
  const presentation = createMemo(() => transcriptPresentation(props.items, props.running || props.waiting));
  const responding = () => {
    const start = props.items.findLastIndex(item => item.kind === 'user');
    return props.items.slice(start + 1).some(item => item.kind === 'assistant' && item.phase === 'final');
  };

  const pin = () => {
    // A chat opens at its end, with no scroll to watch
    const element = scrollEl();
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    stick.scrollToBottom({ animation: "instant" });
  };

  createEffect(on(() => props.sendCount, (count) => count > 0 && stick.scrollToBottom(), { defer: true }));
  createEffect(on([() => props.chatKey, () => props.items.length > 0], pin));

  return (
    <div ref={setScrollEl} tabIndex={0} aria-label="Mensajes del chat" class="syka-chat-transcript min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div class="syka-chat-transcript-content flex flex-col gap-2 px-4 pb-2 pt-4">
        <For each={presentation().messages.map(item=>item.id)}>
          {(id) => <ChatItem item={byId().get(id)!} />}
        </For>
        <Show when={props.waiting || (props.running && !responding())}>
          <TurnActivity items={presentation().activity} waiting={props.waiting} responding={responding()} />
        </Show>
      </div>
    </div>
  );
}
