/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Copied from https://shadcn-solid.netlify.app/docs/components/text-field

import type { ComponentProps, ValidComponent } from "solid-js";
import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createSignal,
  splitProps,
} from "solid-js";
import { TextField as TextFieldPrimitive } from "@kobalte/core/text-field";
import { callHandler } from "@/lib/call-handler";
import { cx } from "@/lib/cva";
import { tw } from "@/lib/tw";
import { assert } from "@/utils";

import type { JSX } from "solid-js";

export type TextFieldProps<T extends ValidComponent = "div"> = ComponentProps<
  typeof TextFieldPrimitive<T>
>;

export const TextField = <T extends ValidComponent = "div">(
  props: TextFieldProps<T>,
) => {
  const [, rest] = splitProps(props as TextFieldProps, ["class"]);

  return (
    <TextFieldPrimitive
      data-slot="text-field"
      class={cx("grid w-full gap-2", props.class)}
      {...rest}
    />
  );
};

export type TextFieldInputProps<T extends ValidComponent = "input"> =
  ComponentProps<typeof TextFieldPrimitive.Input<T>> & {
    uiSize?: "default" | "compact";
  };

export const TextFieldInput = <T extends ValidComponent = "input">(
  props: TextFieldInputProps<T>,
) => {
  const [local, rest] = splitProps(props as TextFieldInputProps, [
    "class",
    "uiSize",
  ]);

  return (
    <TextFieldPrimitive.Input
      data-slot="text-field-input"
      class={cx(
        tw`placeholder:text-muted-foreground selection:bg-selection selection:text-selection-foreground bg-input h-7 rounded-md px-2 py-1 text-base font-normal transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-ring`,
        tw`aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive`,
        tw`file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-450`,
        local.uiSize === "compact" && "text-xs",
        local.class,
      )}
      {...rest}
    />
  );
};

export type TextFieldTextAreaProps<T extends ValidComponent = "textarea"> =
  ComponentProps<typeof TextFieldPrimitive.TextArea<T>>;

export const TextFieldTextArea = <T extends ValidComponent = "textarea">(
  props: TextFieldTextAreaProps<T>,
) => {
  const [, rest] = splitProps(props as TextFieldTextAreaProps, ["class"]);

  return (
    <TextFieldPrimitive.TextArea
      data-slot="text-field-textarea"
      class={cx(
        "placeholder:text-muted-foreground selection:bg-selection selection:text-selection-foreground dark:bg-input/30 border-input flex min-h-16 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-ring",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        props.class,
      )}
      {...rest}
    />
  );
};

export type TextFieldLabelProps<T extends ValidComponent = "label"> =
  ComponentProps<typeof TextFieldPrimitive.Label<T>> & {
    uiSize?: "default" | "compact";
  };

export const TextFieldLabel = <T extends ValidComponent = "label">(
  props: TextFieldLabelProps<T>,
) => {
  const [local, rest] = splitProps(props as TextFieldLabelProps, [
    "class",
    "uiSize",
  ]);

  return (
    <TextFieldPrimitive.Label
      data-slot="text-field-label"
      class={cx(
        "text-sm font-450 select-none",
        local.uiSize === "compact" &&
        "text-xs font-normal",
        "data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "data-invalid:text-destructive",
        local.class,
      )}
      {...rest}
    />
  );
};

export type TextFieldErrorMessageProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof TextFieldPrimitive.ErrorMessage<T>> & {
    errors?: ({ message?: string } | undefined)[];
  };

export const TextFieldErrorMessage = <T extends ValidComponent = "div">(
  props: TextFieldErrorMessageProps<T>,
) => {
  const [, rest] = splitProps(props as TextFieldErrorMessageProps, [
    "class",
    "errors",
    "children",
  ]);

  const uniqueErrors = () => [
    ...new Map(props.errors?.map((error) => [error?.message, error])).values(),
  ];

  return (
    <TextFieldPrimitive.ErrorMessage
      data-slot="text-field-error-message"
      class={cx("text-destructive text-sm", props.class)}
      {...rest}
    >
      <Switch
        fallback={
          <ul class="ml-4 flex list-disc flex-col gap-1">
            <For each={uniqueErrors()}>
              {(error) => <li>{error?.message}</li>}
            </For>
          </ul>
        }
      >
        <Match when={props.children}>{props.children}</Match>
        <Match when={!props.errors?.length}>{null}</Match>
        <Match when={uniqueErrors().length == 1}>
          {uniqueErrors()[0]?.message}
        </Match>
      </Switch>
    </TextFieldPrimitive.ErrorMessage>
  );
};

export type TextFieldDescriptionProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof TextFieldPrimitive.Description<T>>;

export const TextFieldDescription = <T extends ValidComponent = "div">(
  props: TextFieldDescriptionProps<T>,
) => {
  const [, rest] = splitProps(props as TextFieldDescriptionProps, ["class"]);

  return (
    <TextFieldPrimitive.Description
      data-slot="text-field-description"
      class={cx("text-muted-foreground text-sm", props.class)}
      {...rest}
    />
  );
};

export type ControlledTextFieldProps<T extends ValidComponent = "input"> = Omit<
  ComponentProps<typeof TextFieldPrimitive.Input<T>>,
  "type"
> & {
  icon?: JSX.Element;
  keyframe?: JSX.Element;
  autoSelect?: boolean;
  showSign?: boolean;
  inputClassName?: string;
  unit?: string;
  skipEmpty?: boolean;
  limitEvents?: boolean;
  sliderEnabled?: boolean;
  onUnitChange?: (value: string) => void;
  onNumber?: (value: number) => void;
};

const SLIDER_STEP_FACTOR = 3;

export const ControlledTextField = <T extends ValidComponent = "input">(
  props: ControlledTextFieldProps<T>,
) => {
  const [local, rest] = splitProps(props as ControlledTextFieldProps, [
    "class",
    "icon",
    "autoSelect",
    "value",
    "showSign",
    "inputClassName",
    "unit",
    "skipEmpty",
    "limitEvents",
    "keyframe",
    "onNumber",
    "step",
    "min",
    "max",
    "onChange",
    "onInput",
    "onUnitChange",
    "sliderEnabled",
  ]);
  let inputRef!: HTMLInputElement;

  const [internalValue, setInternalValue] = createSignal<string>();
  const [isControlled, setIsControlled] = createSignal(false);

  const numericEnabled = () => Boolean(local.onNumber);

  const applyStepAndClamp = (value: number) => {
    let next = value;

    if (local.step !== undefined) {
      const step = Number(local.step);
      assert(step > 0, "Step must be greater than 0");

      next = Math.round(next / step) * step;
      const decimals = (step.toString().split(".")[1] || "").length;
      next = Number(next.toFixed(decimals));
    }

    if (local.min !== undefined) next = Math.max(Number(local.min), next);
    if (local.max !== undefined) next = Math.min(Number(local.max), next);

    return next;
  };

  const emitValue = (rawValue: string) => {
    const trimmed = rawValue.trim();

    if (!trimmed) {
      if (local.skipEmpty) return;

      local.onNumber?.(applyStepAndClamp(0));
      return;
    }

    const parsed = parseFloat(trimmed);
    if (Number.isNaN(parsed)) return;

    local.onNumber?.(applyStepAndClamp(parsed));
  };

  const displayValue = createMemo(() => {
    if (isControlled()) {
      return internalValue();
    }

    let value = String(local.value ?? "");

    if (local.showSign && !value.match(/^(\+|-)/)) {
      const asNumber = Number(value);
      if (!Number.isNaN(asNumber)) {
        value = asNumber > 0 ? "+" + value : value;
      }
    }

    if (local.unit && !value.endsWith(local.unit)) {
      value = value + local.unit;
    }

    return value;
  });

  const handleInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (e) => {
    const rawValue = e.currentTarget.value;
    setInternalValue(rawValue);
    setIsControlled(true);
    callHandler(e, local.onInput);

    if (!local.limitEvents && numericEnabled()) emitValue(rawValue);
  };

  const handleChange: JSX.EventHandler<HTMLInputElement, Event> = (e) => {
    const rawValue = e.currentTarget.value;
    setInternalValue(rawValue);
    callHandler(
      e,
      local.onChange as JSX.EventHandlerUnion<HTMLInputElement, Event>,
    );

    if (local.onUnitChange) {
      // Extract unit from string (non-numeric suffix after the number)
      const unitMatch = rawValue.match(/^[+-]?[\d.]*(.*)$/);
      const extractedUnit = unitMatch?.[1]?.trim() ?? "";

      if (extractedUnit !== (local.unit ?? "").trim()) {
        local.onUnitChange(extractedUnit);
      }
    }

    if (numericEnabled()) emitValue(rawValue);
    setIsControlled(false);
  };

  const handleKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (
    e,
  ) => {
    if (e.key === "Enter") {
      (e.currentTarget as HTMLInputElement).blur();
      return;
    }

    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (!numericEnabled()) return;

    const rawValue = e.currentTarget.value;

    // Parse value: optional sign, number, optional unit
    const match = rawValue.match(/^([+-]?)([\d.]*)(.*?)$/);
    if (!match) return;

    const [, sign, numStr] = match;
    let num = parseFloat((sign || "") + (numStr || "0"));

    if (Number.isNaN(num)) num = 0;

    e.preventDefault();

    // Calculate step: use prop step or default to 1, multiply by 10 if shift
    let step = local.step !== undefined ? Number(local.step) : 1;
    if (e.shiftKey) {
      step *= 10;
    }

    // Apply increment/decrement
    if (e.key === "ArrowUp") {
      num += step;
    } else {
      num -= step;
    }

    // Fix floating point precision issues
    const stepDecimals = (step.toString().split(".")[1] || "").length;
    num = Number(num.toFixed(stepDecimals));

    // Clamp to min/max if supplied
    if (local.min !== undefined) {
      num = Math.max(Number(local.min), num);
    }
    if (local.max !== undefined) {
      num = Math.min(Number(local.max), num);
    }

    local.onNumber?.(num);

    setIsControlled(false);
  };

  // Slider drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartValue = 0;

  const getCurrentNumericValue = (): number => {
    if (isControlled()) {
      const rawInternalValue = internalValue();
      if (rawInternalValue !== undefined) {
        const num = parseFloat(rawInternalValue.trim());
        if (!Number.isNaN(num)) return num;
      }
    }

    const rawValue = String(local.value ?? "0");
    const num = parseFloat(rawValue);
    return Number.isNaN(num) ? 0 : num;
  };

  const stopDrag = () => {
    if (!isDragging) return;
    isDragging = false;

    document.removeEventListener("pointermove", handleSliderPointerMove);
    document.removeEventListener("pointerup", handleSliderPointerUp);
    document.removeEventListener("pointercancel", handleSliderPointerUp);
  };

  const handleSliderPointerDown = (e: PointerEvent) => {
    if (!local.sliderEnabled || !numericEnabled()) return;

    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartValue = getCurrentNumericValue();

    document.addEventListener("pointermove", handleSliderPointerMove);
    document.addEventListener("pointerup", handleSliderPointerUp);
    document.addEventListener("pointercancel", handleSliderPointerUp);
  };

  const handleSliderPointerMove = (e: PointerEvent) => {
    if (!isDragging) return;

    const delta = e.clientX - dragStartX;

    // Calculate step: use prop step or default to 1, multiply by 10 if shift
    let step = local.step !== undefined ? Number(local.step) : 1;
    if (e.shiftKey) {
      step *= 10;
    }

    // Apply delta (1 pixel = 1 step unit)
    let num = dragStartValue + (delta * step * SLIDER_STEP_FACTOR);

    // Fix floating point precision issues
    const stepDecimals = (step.toString().split(".")[1] || "").length;
    num = Number(num.toFixed(stepDecimals));

    // Clamp to min/max if supplied
    if (local.min !== undefined) {
      num = Math.max(Number(local.min), num);
    }
    if (local.max !== undefined) {
      num = Math.min(Number(local.max), num);
    }

    local.onNumber?.(num);

    setIsControlled(false);
  };

  const handleSliderPointerUp = () => stopDrag();

  return (
    <TextField class={cx("relative w-full min-w-0 group", local.class)}>
      <Show when={local.icon}>
        <div
          class="absolute flex items-center justify-center w-6 left-0 inset-y-0 text-muted-foreground group-hover:text-foreground transition-colors"
          classList={{
            "cursor-ew-resize": local.sliderEnabled,
            "pointer-events-none": !local.sliderEnabled,
          }}
          onPointerDown={handleSliderPointerDown}
        >
          {local.icon}
        </div>
      </Show>
      <TextFieldInput
        {...rest}
        ref={inputRef}
        type="text"
        class={cx(
          "w-full min-w-0 text-xxs",
          local.inputClassName,
          local.icon && "pl-6",
          local.keyframe && "pr-6",
        )}
        inputMode="text"
        value={displayValue()}
        onInput={handleInput}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        on:focus={() => local.autoSelect && inputRef?.select()}
      />
      <Show when={local.keyframe}>
        <div class="absolute flex items-center justify-center w-6 h-7 right-0 inset-y-0">
          {local.keyframe}
        </div>
      </Show>
    </TextField>
  );
};
