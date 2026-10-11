/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createMemo, splitProps, type ComponentProps } from "solid-js"
import { Slider as SliderPrimitive } from "@kobalte/core/slider"

import { cx } from "@/lib/cva"
import { clamp } from "@/utils"

type SliderPrimitiveProps = ComponentProps<typeof SliderPrimitive>

export type ProgressSliderProps = Omit<
  SliderPrimitiveProps,
  "value" | "defaultValue" | "onChange"
> & {
  value: number
  onChange(value: number): void
  trackClass?: string
  fillClass?: string
  thumbClass?: string
}

export function ProgressSlider(props: ProgressSliderProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "value",
    "onChange",
    "minValue",
    "maxValue",
    "trackClass",
    "fillClass",
    "thumbClass",
    "step",
    "disabled",
  ])

  const minValue = () => local.minValue ?? 0
  const maxValue = () => local.maxValue ?? 100
  const step = () => local.step ?? 1

  const currentValue = createMemo(() => clamp(local.value, minValue(), maxValue()))
  const hasProgress = createMemo(() => currentValue() > minValue())

  const handleChange = (values: number[]) => {
    local.onChange(clamp(values[0] ?? minValue(), minValue(), maxValue()))
  }

  return (
    <SliderPrimitive
      data-slot="progress-slider"
      class={cx(
        "relative flex w-full touch-none select-none items-center data-disabled:opacity-50",
        local.class,
      )}
      minValue={minValue()}
      maxValue={maxValue()}
      step={step()}
      value={[currentValue()]}
      defaultValue={[currentValue()]}
      onChange={handleChange}
      disabled={local.disabled}
      {...rest}
    >
      <SliderPrimitive.Track
        data-slot="progress-slider-track"
        class={cx(
          "bg-input relative h-3 w-full rounded-full",
          local.trackClass,
        )}
      >
        <SliderPrimitive.Fill
          data-slot="progress-slider-fill"
          class={cx(
            "bg-primary absolute inset-y-0 left-0 rounded-full",
            local.fillClass,
          )}
        />
        <SliderPrimitive.Thumb
          data-slot="progress-slider-thumb"
          class={cx(
            "border-primary-foreground -translate-y-px size-3.5 rounded-full border-[3px] shadow-sm transition-[color,box-shadow] focus-visible:ring-none focus-visible:outline-hidden disabled:pointer-events-none",
            hasProgress() ? "bg-primary" : "bg-input",
            local.thumbClass,
          )}
        >
          <SliderPrimitive.Input />
        </SliderPrimitive.Thumb>
      </SliderPrimitive.Track>
    </SliderPrimitive>
  )
}
