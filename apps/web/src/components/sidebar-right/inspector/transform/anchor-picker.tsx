/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal, For, Show } from 'solid-js';
import { Icon } from '@/components/ui/icon';
import { anchorPositions } from './constants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import type { AnchorPosition } from './constants';

export type AnchorPointPickerProps = {
  x: number;
  y: number;
  onPick(x: number, y: number): void;
};

export function AnchorPointPicker(props: AnchorPointPickerProps) {
  const [hoveredIndex, setHoveredIndex] = createSignal<number | null>(null);

  const isActive = (pos: AnchorPosition) => {
    return Math.abs(props.x - pos.x) < 0.01 && Math.abs(props.y - pos.y) < 0.01;
  };

  return (
    <div class="flex-1 h-16 bg-input rounded-md overflow-hidden grid grid-cols-3 grid-rows-3">
      <For each={anchorPositions}>
        {(pos, index) => {
          const active = () => isActive(pos);
          const hovered = () => hoveredIndex() === index();

          return (
            <Tooltip>
              <TooltipTrigger
                as="button"
                type="button"
                class="w-full h-full relative rounded-md transition-colors flex items-center justify-center"
                onMouseEnter={() => setHoveredIndex(index())}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => props.onPick(pos.x, pos.y)}
              >
                <Show
                  when={active() || hovered()}
                  fallback={
                    <div class="size-0.5 rounded-full bg-muted-foreground" />
                  }
                >
                  <div classList={{ "text-primary": active(), "text-muted-foreground": !active() }}>
                    <Icon name={pos.icon} />
                  </div>
                </Show>
              </TooltipTrigger>
              <TooltipContent>{pos.tooltip}</TooltipContent>
            </Tooltip>
          );
        }}
      </For>
    </div>
  );
}
