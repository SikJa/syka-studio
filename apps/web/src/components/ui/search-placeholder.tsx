/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Show, type JSX } from "solid-js";

import { Icon } from "@/components/ui/icon";

export type SearchPlaceholderProps = {
  text: string;
  trailing?: JSX.Element;
};

export function SearchPlaceholder(props: SearchPlaceholderProps) {
  return (
    <div class="px-2">
      <div class="relative h-11 flex items-center border-y border-border">
        <div class="w-6 h-7 flex items-center justify-center text-muted-foreground overflow-clip">
          <Icon name="search" />
        </div>
        <span class="flex-1 min-w-0 text-xs text-muted-foreground">
          {props.text}
        </span>
        <Show when={props.trailing}>{props.trailing}</Show>
        <div class="absolute left-6 top-1/2 -translate-y-1/2 w-px h-4 bg-foreground" />
      </div>
    </div>
  );
}

