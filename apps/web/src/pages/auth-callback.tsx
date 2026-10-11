/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { supabase } from '@/lib/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  onMount(async () => {
    if (supabase) {
      await supabase.auth.getSession();
    }

    navigate('/', { replace: true });
  });

  return (
    <div class="grid h-screen place-items-center bg-background">
      <p class="text-sm text-muted-foreground">Signing you in...</p>
    </div>
  );
}
