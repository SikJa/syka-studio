/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Show } from "solid-js";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { desktopAppDownloadLabel, downloadDesktopApp } from "@/lib/desktop-app";
import { createStoredSignal } from "@/lib/store";
import { track } from "@/lib/analytics";
import { store } from "@/init";

/**
 * Promo bar pinned below the dashboard content. Like the canvas banner, it is
 * hidden in the desktop build, which is the thing it advertises.
 *
 * The design has no dismiss affordance, so hiding it lives in a right-click
 * context menu on the bar itself.
 */
export function DashboardGetDesktopApp() {
  const isDesktop = !!window.desktop;
  const [hidden, setHidden] = createStoredSignal(
    store.define("dashboard.desktop-app-promo-hidden", false),
  );

  const handleHide = () => {
    track("desktop_app_banner_dismissed", { source: "dashboard_footer" });
    setHidden(true);
  };

  return (
    <Show when={!isDesktop && !hidden()}>
      <ContextMenu>
        <ContextMenuTrigger
          as="div"
          class="flex shrink-0 items-center gap-4 border-t border-border bg-background px-6 py-4"
        >
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <img src="/mark-macos-small.png" alt="" class="size-8 shrink-0" />
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <p class="text-xs font-450 leading-4 text-foreground">Get desktop app</p>
              <p class="text-xxs leading-3.5 text-muted-foreground">
                The desktop app lets Claude Code, Codex, and any coding agents work with your
                footage and project.
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => downloadDesktopApp("dashboard_footer")}>
            {desktopAppDownloadLabel()}
          </Button>
        </ContextMenuTrigger>
        <ContextMenuPortal>
          <ContextMenuContent class="w-45 gap-0">
            <ContextMenuItem onSelect={handleHide}>Don&apos;t show again</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenuPortal>
      </ContextMenu>
    </Show>
  );
}
