/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Copied from https://shadcn-solid.netlify.app/docs/components/separator

import type { ComponentProps, ValidComponent } from "solid-js"
import { splitProps } from "solid-js"
import { Root as SeparatorPrimitive } from "@kobalte/core/separator"

import { cx } from "@/lib/cva"

export type SeparatorProps<T extends ValidComponent = "hr"> = ComponentProps<
  typeof SeparatorPrimitive<T>
>

export const Separator = <T extends ValidComponent = "hr">(
  props: SeparatorProps<T>,
) => {
  const [, rest] = splitProps(props as SeparatorProps, ["class"])

  return (
    <SeparatorPrimitive
      data-slot="separator"
      class={cx(
        "bg-border shrink-0 border-none data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        props.class,
      )}
      {...rest}
    />
  )
}
