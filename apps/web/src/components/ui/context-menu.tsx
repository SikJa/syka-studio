/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Copied from https://shadcn-solid.netlify.app/docs/components/context-menu

import type { Accessor, ComponentProps, ValidComponent } from "solid-js"
import { createContext, splitProps, useContext } from "solid-js"
import { ContextMenu as ContextMenuPrimitive } from "@kobalte/core/context-menu"

import { cx } from "@/lib/cva"

export const ContextMenuPortal = ContextMenuPrimitive.Portal
const ContextMenuContentDisabledContext = createContext<Accessor<boolean>>()

const useContextMenuContentDisabled = () => {
  return useContext(ContextMenuContentDisabledContext) ?? (() => false)
}

export type ContextMenuProps = ComponentProps<typeof ContextMenuPrimitive>

export const ContextMenu = (props: ContextMenuProps) => {
  return <ContextMenuPrimitive data-slot="context-menu" {...props} />
}

export type ContextMenuTriggerProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof ContextMenuPrimitive.Trigger<T>>

export const ContextMenuTrigger = <T extends ValidComponent = "div">(
  props: ContextMenuTriggerProps<T>,
) => {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  )
}

export type ContextMenuGroupProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof ContextMenuPrimitive.Group<T>>

export const ContextMenuGroup = <T extends ValidComponent = "div">(
  props: ContextMenuGroupProps<T>,
) => {
  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  )
}

export type ContextMenuSubProps = ComponentProps<
  typeof ContextMenuPrimitive.Sub
>

export const ContextMenuSub = (props: ContextMenuSubProps) => {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />
}

export type ContextMenuRadioGroupProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof ContextMenuPrimitive.RadioGroup<T>>

export const ContextMenuRadioGroup = <T extends ValidComponent = "div">(
  props: ContextMenuRadioGroupProps<T>,
) => {
  return (
    <ContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...props}
    />
  )
}

export type ContextMenuSubTriggerProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof ContextMenuPrimitive.SubTrigger<T>> & {
    inset?: boolean
  }

export const ContextMenuSubTrigger = <T extends ValidComponent = "div">(
  props: ContextMenuSubTriggerProps<T>,
) => {
  const isContentDisabled = useContextMenuContentDisabled()
  const [local, rest] = splitProps(props as ContextMenuSubTriggerProps, [
    "class",
    "children",
    "inset",
    "disabled",
  ])

  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={local.inset}
      disabled={local.disabled || isContentDisabled()}
      class={cx(
        "group data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[expanded]:bg-primary data-[expanded]:text-primary-foreground flex cursor-default items-center gap-1 rounded-md bg-popover pl-2 pr-0 py-0 text-xs outline-hidden select-none data-[inset]:pl-8 data-[highlighted]:[&_svg]:text-primary-foreground data-[expanded]:[&_svg]:text-primary-foreground h-7 w-full",
        local.class,
      )}
      {...rest}
    >
      <span class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {local.children}
      </span>
      <span class="h-7 w-6 shrink-0 flex items-center justify-center text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24">
          <path
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="m9 18l6-6l-6-6"
          />
        </svg>
      </span>
    </ContextMenuPrimitive.SubTrigger>
  )
}

export type ContextMenuSubContentProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof ContextMenuPrimitive.SubContent<T>>

export const ContextMenuSubContent = <T extends ValidComponent = "div">(
  props: ContextMenuSubContentProps<T>,
) => {
  const [, rest] = splitProps(props as ContextMenuSubContentProps, ["class"])

  return (
    <ContextMenuPrimitive.SubContent
      data-slot="context-menu-sub-content"
      class={cx(
        "bg-popover text-popover-foreground data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 z-[10000] min-w-[8rem] origin-(--kb-menu-content-transform-origin) overflow-x-hidden overflow-y-auto flex flex-col gap-2 rounded-xl border border-border p-2 shadow-[0px_0px_1px_2px_rgba(0,0,0,0.12),0px_4px_12px_8px_rgba(0,0,0,0.12),0px_12px_16px_0px_rgba(0,0,0,0.16)] outline-none max-h-[var(--kb-popper-content-available-height)]",
        "[[data-popper-positioner][style*='--kb-popper-content-transform-origin:_top']>[data-slot=context-menu-sub-content]]:slide-in-from-top-2 [[data-popper-positioner][style*='--kb-popper-content-transform-origin:_bottom']>[data-slot=context-menu-sub-content]]:slide-in-from-bottom-2 [[data-popper-positioner][style*='--kb-popper-content-transform-origin:_left']>[data-slot=context-menu-sub-content]]:slide-in-from-left-2 [[data-popper-positioner][style*='--kb-popper-content-transform-origin:_right']>[data-slot=context-menu-sub-content]]:slide-in-from-right-2",
        props.class,
      )}
      {...rest}
    />
  )
}

export type ContextMenuContentProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof ContextMenuPrimitive.Content<T>> & {
    disabled?: boolean
  }

// Keep `ContextMenuContent` mounted while a menu may be open.
// Unmounting it from volatile app state (for example selection changes) can bypass close animations.
export const ContextMenuContent = <T extends ValidComponent = "div">(
  props: ContextMenuContentProps<T>,
) => {
  const [local, rest] = splitProps(props as ContextMenuContentProps, [
    "class",
    "disabled",
  ])

  return (
    <ContextMenuContentDisabledContext.Provider value={() => !!local.disabled}>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        class={cx(
          "bg-popover text-popover-foreground data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 z-[10000] min-w-[8rem] origin-(--kb-menu-content-transform-origin) overflow-x-hidden overflow-y-auto flex flex-col gap-2 rounded-xl border border-border p-2 shadow-[0px_0px_1px_2px_rgba(0,0,0,0.12),0px_4px_12px_8px_rgba(0,0,0,0.12),0px_12px_16px_0px_rgba(0,0,0,0.16)] outline-none max-h-[var(--kb-popper-content-available-height)]",
          "[[data-popper-positioner][style*='--kb-popper-content-transform-origin:_top']>[data-slot=context-menu-content]]:slide-in-from-top-2 [[data-popper-positioner][style*='--kb-popper-content-transform-origin:_bottom']>[data-slot=context-menu-content]]:slide-in-from-bottom-2 [[data-popper-positioner][style*='--kb-popper-content-transform-origin:_left']>[data-slot=context-menu-content]]:slide-in-from-left-2 [[data-popper-positioner][style*='--kb-popper-content-transform-origin:_right']>[data-slot=context-menu-content]]:slide-in-from-right-2",
          local.class,
        )}
        {...rest}
      />
    </ContextMenuContentDisabledContext.Provider>
  )
}

export type ContextMenuItemProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof ContextMenuPrimitive.Item<T>> & {
    inset?: boolean
    variant?: "default" | "destructive"
  }

export const ContextMenuItem = <T extends ValidComponent = "div">(
  props: ContextMenuItemProps<T>,
) => {
  const isContentDisabled = useContextMenuContentDisabled()
  const [local, rest] = splitProps(props as ContextMenuItemProps, [
    "class",
    "inset",
    "variant",
    "disabled",
  ])

  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={local.inset}
      data-variant={local.variant}
      disabled={local.disabled || isContentDisabled()}
      class={cx(
        "group data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[disabled]:data-[highlighted]:bg-transparent data-[disabled]:data-[highlighted]:text-muted-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:bg-destructive/10 dark:data-[variant=destructive]:data-[highlighted]:bg-destructive/20 data-[variant=destructive]:data-[highlighted]:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-1 rounded-md bg-popover px-2 py-0 text-xs outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 h-7 w-full data-[highlighted]:[&_svg]:text-primary-foreground",
        local.class,
      )}
      {...rest}
    />
  )
}

export type ContextMenuCheckboxItemProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof ContextMenuPrimitive.CheckboxItem<T>>

export const ContextMenuCheckboxItem = <T extends ValidComponent = "div">(
  props: ContextMenuCheckboxItemProps<T>,
) => {
  const isContentDisabled = useContextMenuContentDisabled()
  const [local, rest] = splitProps(props as ContextMenuCheckboxItemProps, [
    "class",
    "children",
    "disabled",
  ])

  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      disabled={local.disabled || isContentDisabled()}
      class={cx(
        "group data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        local.class,
      )}
      {...rest}
    >
      <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator
          as="svg"
          xmlns="http://www.w3.org/2000/svg"
          class="size-4"
          viewBox="0 0 24 24"
        >
          <path
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M20 6L9 17l-5-5"
          />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {local.children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}

export type ContextMenuRadioItemProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof ContextMenuPrimitive.RadioItem<T>>

export const ContextMenuRadioItem = <T extends ValidComponent = "div">(
  props: ContextMenuRadioItemProps<T>,
) => {
  const isContentDisabled = useContextMenuContentDisabled()
  const [local, rest] = splitProps(props as ContextMenuRadioItemProps, [
    "class",
    "children",
    "disabled",
  ])

  return (
    <ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      disabled={local.disabled || isContentDisabled()}
      class={cx(
        "group data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        local.class,
      )}
      {...rest}
    >
      <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator
          as="svg"
          xmlns="http://www.w3.org/2000/svg"
          class="size-2"
          viewBox="0 0 24 24"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="currentColor"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {local.children}
    </ContextMenuPrimitive.RadioItem>
  )
}

export type ContextMenuGroupLabelProps<T extends ValidComponent = "span"> =
  ComponentProps<typeof ContextMenuPrimitive.GroupLabel<T>> & {
    inset?: boolean
  }

export const ContextMenuGroupLabel = <T extends ValidComponent = "span">(
  props: ContextMenuGroupLabelProps<T>,
) => {
  const [, rest] = splitProps(props as ContextMenuGroupLabelProps, [
    "class",
    "inset",
  ])

  return (
    <ContextMenuPrimitive.GroupLabel
      as="div"
      data-slot="context-menu-group-label"
      data-inset={props.inset}
      class={cx(
        "text-foreground my-1.5 px-2 text-sm font-450 data-[inset]:pl-8",
        props.class,
      )}
      {...rest}
    />
  )
}

export type ContextMenuItemLabelProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof ContextMenuPrimitive.ItemLabel<T>> & {
    inset?: boolean
  }

export const ContextMenuItemLabel = <T extends ValidComponent = "div">(
  props: ContextMenuItemLabelProps<T>,
) => {
  const [, rest] = splitProps(props as ContextMenuItemLabelProps, [
    "class",
    "inset",
  ])

  return (
    <ContextMenuPrimitive.ItemLabel
      data-slot="context-menu-item-label"
      data-inset={props.inset}
      class={cx(
        "text-foreground px-2 py-1.5 text-sm font-450 data-[inset]:pl-8",
        props.class,
      )}
      {...rest}
    />
  )
}

export type ContextMenuSeparatorProps<T extends ValidComponent = "hr"> =
  ComponentProps<typeof ContextMenuPrimitive.Separator<T>>

export const ContextMenuSeparator = <T extends ValidComponent = "hr">(
  props: ContextMenuSeparatorProps<T>,
) => {
  const [, rest] = splitProps(props as ContextMenuSeparatorProps, ["class"])

  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      class={cx("bg-border h-px w-full", props.class)}
      {...rest}
    />
  )
}

export type ContextMenuShortcutProps = ComponentProps<"span">

export const ContextMenuShortcut = (props: ContextMenuShortcutProps) => {
  const [, rest] = splitProps(props, ["class"])

  return (
    <span
      data-slot="context-menu-shortcut"
      class={cx(
        "ml-auto min-w-5 text-right text-xxs text-muted-foreground group-[[data-highlighted]]:text-[inherit] group-[[data-expanded]]:text-[inherit]",
        props.class,
      )}
      {...rest}
    />
  )
}
