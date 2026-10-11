/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Icon } from "@/components/ui/icon";
import { useLocation } from '@solidjs/router';
import { Show } from 'solid-js';

export function ScreenTooSmall() {
  const location = useLocation();
  return (
    <Show when={location.pathname.startsWith('/projects/')}>
    <div class="screen-too-small fixed inset-0 z-[100] hidden items-center justify-center bg-background p-6">
      <div class="flex max-w-sm flex-col items-center gap-3 text-center">
        <span class="text-muted-foreground">
          <Icon name="alert-warning" class="size-12" />
        </span>
        <h2 class="text-xl font-450 text-foreground">Your screen is too small</h2>
        <p class="text-xs text-muted-foreground">
          Syka Studio needs at least 720×480 to work properly. Please resize your window or switch to a larger display.
        </p>
      </div>
    </div>
    </Show>
  );
}
