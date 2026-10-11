/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { For, Show, onMount, type Accessor } from "solid-js";

import { Icon } from "@/components/ui/icon";
import { SearchPlaceholder } from "@/components/ui/search-placeholder";
import { useControlledSelection } from "@/hooks/use-controlled-selection";

export type StyleItem = {
  id: string;
  name: string;
  color: string;
  border?: boolean;
};

const BRAND_STYLES: StyleItem[] = [
  { id: "brand-primary", name: "Brand Primary", color: "#008CFF" },
  { id: "brand-olive", name: "Soft Olive", color: "#999E08" },
  { id: "brand-clay", name: "Clay", color: "#CC5233" },
];

const GRAY_STYLES: StyleItem[] = [
  { id: "gray-black", name: "Black", color: "#171717", border: true },
  { id: "gray-dark", name: "Dark Gray", color: "#262626", border: true },
  { id: "gray", name: "Gray", color: "#666666" },
  { id: "gray-light", name: "Light Gray", color: "#9E9E9E" },
  { id: "white", name: "White", color: "#FFFFFF" },
];

export const DEFAULT_STYLE_ID = BRAND_STYLES[0].id;

function StyleChip(props: { color: string; border?: boolean }) {
  return (
    <div
      class="size-4 rounded-sm"
      classList={{ "border border-border/60": props.border }}
      style={{
        "background-color": props.color,
      }}
    />
  );
}

function StyleRow(props: {
  item: StyleItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div class="h-8 flex items-center w-full shrink-0">
      <div
        class="flex items-center h-7 w-full rounded-md gap-1 cursor-pointer"
        classList={{
          "bg-muted": props.selected,
          "bg-background": !props.selected,
          "hover:bg-input/80": !props.selected,
          "pr-1": !props.selected,
        }}
        onPointerDown={() => props.onSelect()}
      >
        <div class="size-7 flex items-center justify-center">
          <StyleChip color={props.item.color} border={props.item.border} />
        </div>
        <span class="flex-1 min-w-0 text-xs text-foreground truncate">
          {props.item.name}
        </span>
        <Show when={props.selected}>
          <div class="size-7 flex items-center justify-center text-foreground">
            <Icon name="confirm-check" />
          </div>
        </Show>
      </div>
    </div>
  );
}

function StyleSection(props: {
  title: string;
  items: StyleItem[];
  selectedId: Accessor<string>;
  onSelect: (item: StyleItem) => void;
}) {
  return (
    <div class="flex flex-col w-full">
      <div class="h-7 flex items-center px-1">
        <span class="text-xs text-muted-foreground font-strong">
          {props.title}
        </span>
      </div>
      <div class="flex flex-col">
        <For each={props.items}>
          {(item) => (
            <StyleRow
              item={item}
              selected={props.selectedId() === item.id}
              onSelect={() => props.onSelect(item)}
            />
          )}
        </For>
      </div>
    </div>
  );
}

export type StylesModalProps = {
  value?: Accessor<string | undefined>;
  onChange?: (style: StyleItem) => void;
};

export function StylesModal(props: StylesModalProps = {}) {
  const [selectedStyleId, selectStyle] = useControlledSelection<StyleItem, string>(
    {
      value: props.value,
      defaultValue: DEFAULT_STYLE_ID,
      getValue: (style) => style.id,
      onChange: props.onChange,
    },
  );

  onMount(() => {
    const id = selectedStyleId();
    const style =
      BRAND_STYLES.find((item) => item.id === id) ??
      GRAY_STYLES.find((item) => item.id === id);
    if (style) props.onChange?.(style);
  });

  return (
    <div class="flex flex-col">
      <SearchPlaceholder text="Search in styles" />

      <div class="flex flex-col gap-2 px-4 pt-2 pb-4">
        <StyleSection
          title="Brand"
          items={BRAND_STYLES}
          selectedId={selectedStyleId}
          onSelect={selectStyle}
        />
        <StyleSection
          title="Grays"
          items={GRAY_STYLES}
          selectedId={selectedStyleId}
          onSelect={selectStyle}
        />
      </div>
    </div>
  );
}
