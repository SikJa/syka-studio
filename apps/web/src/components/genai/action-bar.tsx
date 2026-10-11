/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Show } from 'solid-js';
import { useAutoCaptions } from './use-auto-captions';

/** Cloud generation is disconnected; captions use the configured provider. */
export function ActionBar() {
  const { generate: autoCaptions, hasScene } = useAutoCaptions();
  return (
    <Show when={hasScene()}>
      <div class="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 rounded-xl p-1 bg-background border border-border flex gap-1 items-center">
        <Button variant="ghost" class="gap-0 pl-0.5 text-muted-foreground" onClick={autoCaptions}>
          <Icon name="captions" />
          Auto-Captions
        </Button>
      </div>
    </Show>
  );
}
