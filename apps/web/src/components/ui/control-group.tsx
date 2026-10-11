/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { JSX } from "solid-js";
import { splitProps, Show } from "solid-js";
import { cx } from "@/lib/cva";

type DivProps = JSX.IntrinsicElements["div"];

type ControlRowProps = DivProps & {
  label?: string | JSX.Element;
  labelClass?: string;
  contentClass?: string;
  ref?: HTMLDivElement;
};

export function ControlRow(props: ControlRowProps) {
  const [local, others] = splitProps(props, [
    "class",
    "children",
    "label",
    "labelClass",
    "contentClass",
    "ref",
  ]);

  return (
    <div class={cx("flex items-center gap-2", local.class)} ref={local.ref} {...others}>
      <Show when={typeof local.label === "string"}>
        <span
          class={cx(
            "w-16 shrink-0 text-xs text-muted-foreground truncate",
            local.labelClass,
          )}
        >
          {local.label}
        </span>
      </Show>
      <div class={cx("flex-1 min-w-0", local.contentClass)}>
        {local.children}
      </div>
    </div>
  );
}
