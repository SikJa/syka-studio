/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal, onCleanup, Show } from 'solid-js';
import { toast } from 'somoto';
import { Button } from '@/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth';
import { DashboardScrollView, DashboardSurfaceSection } from './shared';
import { AVATAR_FILE_TYPES, avatarDataUrl, cropAndResizeAvatar } from './utils';

export function DashboardAccountView() {
  const auth = useAuth();
  const [displayName, setDisplayName] = createSignal(auth.localProfile().displayName);
  const [avatar, setAvatar] = createSignal<string | undefined>(auth.localProfile().avatarDataUrl);
  const [processing, setProcessing] = createSignal(false);
  const [failedAvatar, setFailedAvatar] = createSignal<string | undefined>();
  const preview = () => avatar() !== failedAvatar() ? avatar() : undefined;
  let fileInput: HTMLInputElement | undefined;
  let disposed = false;
  onCleanup(() => { disposed = true; });

  const changePhoto = async (event: Event & { currentTarget: HTMLInputElement }) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || processing()) return;
    setProcessing(true);
    try {
      const next = await avatarDataUrl(await cropAndResizeAvatar(file));
      if (disposed) return;
      setFailedAvatar(undefined);
      setAvatar(next);
    } catch (error) {
      if (!disposed) toast.error('Could not load profile photo', {
        description: error instanceof Error ? error.message : 'Choose another image.',
      });
    } finally {
      if (!disposed) setProcessing(false);
    }
  };

  const save = () => {
    try {
      auth.updateLocalProfile({ displayName: displayName(), avatarDataUrl: preview() });
      setDisplayName(auth.localProfile().displayName);
      toast.success('Perfil guardado');
    } catch (error) {
      toast.error('Failed to save profile', {
        description: error instanceof Error ? error.message : 'Local storage is unavailable.',
      });
    }
  };

  return (
    <DashboardScrollView>
      <DashboardSurfaceSection title="Local profile">
        <p class="text-xs text-muted-foreground">
          Syka works on this computer without a Diffusion account. Your projects and media stay local.
        </p>
        <div class="flex items-center gap-4">
          <Show when={preview()} fallback={
            <div class="grid size-16 shrink-0 place-items-center rounded-md bg-input text-lg text-foreground">
              {(displayName().trim() || 'Syka').charAt(0).toUpperCase()}
            </div>
          }>
            {(url) => <img src={url()} alt="Profile photo preview" class="size-16 shrink-0 rounded-md object-cover" onError={() => setFailedAvatar(url())} />}
          </Show>
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <input ref={fileInput} type="file" accept={AVATAR_FILE_TYPES.join(',')} class="hidden" aria-label="Choose profile photo" disabled={processing()} onChange={changePhoto} />
              <Button variant="secondary" disabled={processing()} onClick={() => fileInput?.click()}>
                {processing() ? 'Processing…' : avatar() ? 'Change photo' : 'Add photo'}
              </Button>
              <Show when={avatar()}>
                <Button variant="ghost" disabled={processing()} onClick={() => { setAvatar(undefined); setFailedAvatar(undefined); }}>Remove photo</Button>
              </Show>
            </div>
            <p class="text-xxs text-muted-foreground">PNG, JPEG or WebP · up to 5 MB. Saved locally when you save changes.</p>
          </div>
        </div>
        <TextField>
          <TextFieldLabel uiSize="compact" class="text-muted-foreground">Nombre visible</TextFieldLabel>
          <TextFieldInput
            uiSize="compact"
            value={displayName()}
            maxLength={80}
            onInput={(event) => setDisplayName(event.currentTarget.value)}
            onKeyDown={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
          />
        </TextField>
        <Button variant="secondary" class="self-start" disabled={processing()} onClick={save}>Guardar cambios</Button>
      </DashboardSurfaceSection>
      <DashboardSurfaceSection title="Agent connection">
        <p class="text-xs text-muted-foreground">
          Codex uses your own local Codex login. This profile is only a display preference and does not authenticate with any provider.
        </p>
      </DashboardSurfaceSection>
    </DashboardScrollView>
  );
}
