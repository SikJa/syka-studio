/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { A } from '@solidjs/router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div class="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <div class="relative z-10 text-center px-6">
        <div class="mb-8">
          <span
            class="bg-gradient-to-b from-foreground to-muted-foreground text-[12rem] font-extralight tracking-tighter leading-none text-transparent bg-clip-text select-none font-mono"
          >
            404
          </span>
        </div>

        <p class="text-muted-foreground text-lg font-light  mb-4">
          Nothing here.
        </p>

        <Button as={A} href="/" variant="ghost">
          Back home
        </Button>
      </div>
    </div>
  );
}
