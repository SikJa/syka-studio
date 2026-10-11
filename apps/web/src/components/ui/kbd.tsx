/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Copied from https://shadcn-solid.netlify.app/docs/components/kbd

import { splitProps, type ComponentProps } from "solid-js"

import { cx } from "@/lib/cva"

export type KbdProps = ComponentProps<"kbd">

export const Kbd = (props: KbdProps) => {
  const [, rest] = splitProps(props, ["class"])

  return (
    <kbd
      data-slot="kbd"
      class={cx(
        "bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-450 select-none",
        "[&_svg:not([class*='size-'])]:size-3",
        "[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10",
        props.class,
      )}
      {...rest}
    />
  )
}

export type KbdGroupProps = ComponentProps<"div">

export const KbdGroup = (props: KbdGroupProps) => {
  const [, rest] = splitProps(props, ["class"])

  return (
    <div
      data-slot="kbd-group"
      class={cx("inline-flex items-center gap-1", props.class)}
      {...rest}
    />
  )
}
