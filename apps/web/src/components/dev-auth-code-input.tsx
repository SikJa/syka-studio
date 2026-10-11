/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal } from 'solid-js';
import { toast } from 'somoto';

import { Button } from '@/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '@/components/ui/text-field';
import { supabase } from '@/lib/supabase';

function extractAuthCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return (
      url.searchParams.get('code') ??
      new URLSearchParams(url.hash.replace(/^#/, '')).get('code')
    );
  } catch {
    return trimmed;
  }
}

export function DevAuthCodeInput() {
  if (!import.meta.env.DEV || !window.desktop) return null;

  const [code, setCode] = createSignal('');
  const [exchanging, setExchanging] = createSignal(false);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!supabase) {
      toast.error('Auth is not configured');
      return;
    }
    const extracted = extractAuthCode(code());
    if (!extracted) {
      toast.error('Paste the callback URL or auth code');
      return;
    }
    setExchanging(true);
    const { error } = await supabase.auth.exchangeCodeForSession(extracted);
    setExchanging(false);
    if (error) {
      toast.error(error.message);
    } else {
      setCode('');
    }
  };

  return (
    <form
      class="flex flex-col gap-2 rounded-xl border border-dashed border-border p-4"
      onSubmit={handleSubmit}
    >
      <TextField>
        <TextFieldLabel
          uiSize="compact"
          class="text-xs text-muted-foreground"
        >
          Dev: paste callback URL or code
        </TextFieldLabel>
        <TextFieldInput
          uiSize="compact"
          type="text"
          placeholder="diffusion://... or raw code"
          value={code()}
          onInput={(e) => setCode(e.currentTarget.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
        />
      </TextField>
      <Button
        type="submit"
        variant="secondary"
        class="w-full"
        disabled={exchanging() || !code().trim()}
      >
        {exchanging() ? 'Exchanging...' : 'Exchange code'}
      </Button>
    </form>
  );
}
