/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// A partial document in the asset panel: a generation with no bytes yet, or
// none ever. Pending, it pulses where its asset will be; failed, it carries
// the reason, and asking again is done from here — retrying forgets the
// failure and re-asks for every element that got it, deleting only forgets.

import { Show } from "solid-js";
import { toast } from "somoto";
import { useWorld } from "@diffusionstudio/koota-solid";
import { assetName } from "@diffusionstudio/assets";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "../ui/context-menu";
import { Icon } from "../ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLibrary } from "@/engine/library";
import { retryGeneration } from "@/engine/generations";

import type { PartialAsset } from "@diffusionstudio/assets";

export type PartialAssetItemProps = {
  partial: PartialAsset;
  selected: boolean;
  onSelect(): void;
};

export function PartialAssetItem(props: PartialAssetItemProps) {
  const world = useWorld();
  const library = useLibrary();

  const failed = () => props.partial.state === "error";

  const handleRetry = async () => {
    const lib = library();
    if (!lib) return;
    try {
      await retryGeneration(world, lib, props.partial);
    } catch (e) {
      toast.error("Failed to retry", { description: (e as Error).message });
    }
  };

  const handleDelete = async () => {
    try {
      await library()?.remove([props.partial]);
    } catch (e) {
      toast.error("Failed to delete", { description: (e as Error).message });
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        as="div"
        class="flex flex-col gap-1 text-left"
        data-asset-id={props.partial.id}
        onClick={props.onSelect}
        onContextMenu={props.onSelect}>
        <Tooltip placement="bottom" openDelay={400}>
          <TooltipTrigger
            as="div"
            data-selected={props.selected}
            class="relative aspect-video w-full overflow-clip rounded bg-muted after:pointer-events-none after:absolute after:inset-0 after:rounded after:opacity-0 after:ring-2 after:ring-inset after:ring-ring after:z-10 data-[selected=true]:after:opacity-100"
            classList={{ "animate-pulse": !failed() }}
          >
            <div class="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Show when={failed()} fallback={<Icon name="spinner-loader" class="size-6 animate-spin" />}>
                <Icon name="alert-warning" class="size-6 text-destructive" />
              </Show>
            </div>
          </TooltipTrigger>
          <TooltipContent class="max-w-64">
            {failed() ? props.partial.error || "Generation failed" : "Generating…"}
          </TooltipContent>
        </Tooltip>
        <div
          class="text-xs truncate select-none"
          classList={{ "text-destructive": failed(), "text-muted-foreground": !failed() }}
          title={props.partial.error}
        >
          {assetName(props.partial)}
        </div>
      </ContextMenuTrigger>
      <ContextMenuPortal>
        <ContextMenuContent class="w-[180px]">
          <Show when={failed()}>
            <ContextMenuItem onSelect={handleRetry}>
              Retry
            </ContextMenuItem>
            <ContextMenuSeparator />
          </Show>
          <ContextMenuItem onSelect={handleDelete}>
            Delete
            <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenu>
  );
}
