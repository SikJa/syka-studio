/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/cva";

type IncrementDecrementControlProps = {
  class?: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel?: string;
  incrementLabel?: string;
};

export function IncrementDecrementControl(props: IncrementDecrementControlProps) {
  return (
    <div class={cx("grid grid-cols-2 gap-px rounded-md overflow-hidden", props.class)}>
      <button
        type="button"
        class="flex-1 h-7 bg-input flex items-center justify-center hover:bg-input/80 active:bg-muted-foreground/20 text-foreground"
        onClick={props.onDecrement}
        title={props.decrementLabel}
        aria-label={props.decrementLabel ?? "Decrease"}
      >
        <Icon name="minus" />
      </button>
      <button
        type="button"
        class="flex-1 h-7 bg-input flex items-center justify-center hover:bg-input/80 active:bg-muted-foreground/20 text-foreground"
        onClick={props.onIncrement}
        title={props.incrementLabel}
        aria-label={props.incrementLabel ?? "Increase"}
      >
        <Icon name="plus-add" />
      </button>
    </div>
  );
}
