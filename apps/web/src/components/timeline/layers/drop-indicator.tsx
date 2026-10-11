/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Show } from 'solid-js';
import { useLayerContext } from './context';

import type { DropTarget } from './drag';

/** Narrow the drop target to one kind, for keyed `<Show>`s. */
function pick<K extends DropTarget['kind']>(target: DropTarget | null, kind: K) {
  return target?.kind === kind ? (target as Extract<DropTarget, { kind: K }>) : null;
}

/**
 * Where a dragged row would drop: a line with a dot between rows, the dot
 * stepping inwards with the depth of the spot; a border around a container
 * the row would drop into. Positioned in the list's own space, so it rides
 * the scroll transform with the rows.
 */
export function DropIndicator() {
  const { drag } = useLayerContext();

  return (
    <>
      <Show when={pick(drag.target(), 'line')}>
        {(line) => (
          <div
            data-drop-indicator
            class="absolute inset-x-0 top-0 z-30 pointer-events-none"
            style={{ transform: `translateY(${line().y}px)` }}
          >
            <div
              class="absolute right-0 -top-px h-0.5 rounded-full bg-primary"
              style={{ left: `${line().inset + 3}px` }}
            />
            <div
              class="absolute -top-1 size-2 rounded-full border-2 border-primary"
              style={{ left: `${line().inset - 4}px` }}
            />
          </div>
        )}
      </Show>
      <Show when={pick(drag.target(), 'inside')}>
        {(box) => (
          <div
            data-drop-indicator
            class="absolute inset-x-0 z-30 pointer-events-none ring-2 ring-inset ring-primary"
            style={{ top: `${box().top}px`, height: `${box().height}px` }}
          />
        )}
      </Show>
    </>
  );
}
