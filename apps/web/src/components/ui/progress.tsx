/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Copied from https://shadcn-solid.netlify.app/docs/components/progress

import { splitProps, type ComponentProps, type ValidComponent } from "solid-js"
import { Progress as ProgressPrimitive } from "@kobalte/core/progress"

import { cx } from "@/lib/cva"

export type ProgressProps<T extends ValidComponent = "div"> = ComponentProps<
  typeof ProgressPrimitive<T>
>

export const Progress = <T extends ValidComponent = "div">(
  props: ProgressProps<T>,
) => {
  const [, rest] = splitProps(props as ProgressProps, ["class", "children"])

  return (
    <ProgressPrimitive
      data-slot="progress"
      class={cx("flex w-full flex-col gap-3", props.class)}
      {...rest}
    >
      {props.children}
      <ProgressPrimitive.Track
        data-slot="progress-track"
        class="bg-primary/20 relative h-2 w-full overflow-hidden rounded-full"
      >
        <ProgressPrimitive.Fill
          data-slot="progress-fill"
          class="bg-primary h-full w-(--kb-progress-fill-width) transition-all"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive>
  )
}

export type ProgressGroupProps = ComponentProps<"div">

export const ProgressGroup = (props: ProgressGroupProps) => {
  const [, rest] = splitProps(props, ["class"])

  return (
    <div
      data-slot="progress-group"
      class={cx("flex justify-between", props.class)}
      {...rest}
    />
  )
}

export type ProgressLabelProps<T extends ValidComponent = "span"> =
  ComponentProps<typeof ProgressPrimitive.Label<T>>

export const ProgressLabel = <T extends ValidComponent = "span">(
  props: ProgressLabelProps<T>,
) => {
  const [, rest] = splitProps(props as ProgressLabelProps, ["class"])

  return (
    <ProgressPrimitive.Label
      data-slot="progress-label"
      class={cx("text-sm font-450 select-none", props.class)}
      {...rest}
    />
  )
}

export type ProgressValueLabelProps<T extends ValidComponent = "span"> =
  ComponentProps<typeof ProgressPrimitive.ValueLabel<T>>

export const ProgressValueLabel = <T extends ValidComponent = "span">(
  props: ProgressValueLabelProps<T>,
) => {
  const [, rest] = splitProps(props as ProgressValueLabelProps, ["class"])

  return (
    <ProgressPrimitive.ValueLabel
      data-slot="progress-value-label"
      class={cx("text-sm font-450 select-none", props.class)}
      {...rest}
    />
  )
}
