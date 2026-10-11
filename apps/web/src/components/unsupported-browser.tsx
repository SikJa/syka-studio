/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Show } from "solid-js";
import { isServer } from "solid-js/web";
import { Icon } from "@/components/ui/icon";

function isChromium() {
  if (isServer) return true;
  const uaData = (navigator as { userAgentData?: { brands: { brand: string }[] } }).userAgentData;
  return uaData?.brands?.some((b) => b.brand === "Chromium") ?? false;
}

export function UnsupportedBrowser() {
  return (
    <Show when={!isChromium()}>
      <div class="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6">
        <div class="flex max-w-sm flex-col items-center gap-3 text-center">
          <span class="text-muted-foreground">
            <Icon name="alert-warning" class="size-12" />
          </span>
          <h2 class="text-xl font-450 text-foreground">Unsupported browser</h2>
          <p class="text-xs text-muted-foreground">
            Syka Studio requires a Chromium-based browser. Please switch to Google Chrome, Microsoft Edge, Brave, or Arc.
          </p>
        </div>
      </div>
    </Show>
  );
}
