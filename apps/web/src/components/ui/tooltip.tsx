/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Copied from https://shadcn-solid.netlify.app/docs/components/tooltip

import type { ComponentProps, ValidComponent, Accessor } from "solid-js";
import { createMemo, mergeProps, Show, splitProps } from "solid-js";
import { Tooltip as TooltipPrimitive } from "@kobalte/core/tooltip";

import { cx } from "@/lib/cva";

export type TooltipProps = ComponentProps<typeof TooltipPrimitive>;

export const TooltipPortal = TooltipPrimitive.Portal;

export const Tooltip = (props: TooltipProps) => {
  const merge = mergeProps<TooltipProps[]>(
    {
      closeDelay: 0,
      openDelay: 0,
      placement: "top",
      gutter: 8,
    },
    props,
  );

  return <TooltipPrimitive data-slot="tooltip" {...merge} />;
};

export type TooltipTriggerProps<T extends ValidComponent = "button"> =
  ComponentProps<typeof TooltipPrimitive.Trigger<T>>;

export const TooltipTrigger = <T extends ValidComponent = "button">(
  props: TooltipTriggerProps<T>,
) => {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
};

export type TooltipContentProps<T extends ValidComponent = "button"> =
  ComponentProps<typeof TooltipPrimitive.Content<T>> & {
    shortcut?: Accessor<string> | string;
  };

export const TooltipContent = <T extends ValidComponent = "button">(
  props: TooltipContentProps<T>,
) => {
  const [, rest] = splitProps(props as TooltipContentProps, [
    "class",
    "children",
    "shortcut",
  ]);

  const shortcut = createMemo(() => {
    if (typeof props.shortcut === 'string') {
      return props.shortcut;
    }
    return props.shortcut?.();
  });

  return (
    <TooltipPrimitive.Content
      data-slot="tooltip-content"
      class={cx(
        "bg-background text-foreground rounded-md px-2 py-1 text-xs font-450 text-balance shadow-md flex items-center animate-in border border-border fade-in-0 zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 z-[10000] w-fit origin-(--kb-tooltip-content-transform-origin)",
        "[[data-popper-positioner][style*='--kb-popper-content-transform-origin:_top']>[data-slot=tooltip-content]]:slide-in-from-top-2 [[data-popper-positioner][style*='--kb-popper-content-transform-origin:_bottom']>[data-slot=tooltip-content]]:slide-in-from-bottom-2 [[data-popper-positioner][style*='--kb-popper-content-transform-origin:_left']>[data-slot=tooltip-content]]:slide-in-from-left-2 [[data-popper-positioner][style*='--kb-popper-content-transform-origin:_right']>[data-slot=tooltip-content]]:slide-in-from-right-2",
        props.class,
      )}
      {...rest}
    >
      {props.children}
      <Show when={shortcut()?.length}>
        <span class="text-muted-foreground text-xs  ml-1">
          {shortcut()}
        </span>
      </Show>
    </TooltipPrimitive.Content>
  );
};
