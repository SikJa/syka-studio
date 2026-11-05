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
import { DitherAvatarPicker, ProfileAvatar } from '@/components/profile/dither-avatar-picker';

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
      if (!disposed) toast.error('No se pudo cargar la foto', {
        description: error instanceof Error ? error.message : 'Elegí otra imagen.',
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
      toast.error('No se pudo guardar el perfil', {
        description: error instanceof Error ? error.message : 'El almacenamiento local no está disponible.',
      });
    }
  };

  return (
    <DashboardScrollView>
      <DashboardSurfaceSection title="Perfil local">
        <p class="text-xs text-muted-foreground">
          Syka funciona en esta computadora sin una cuenta de Diffusion. Tus proyectos y medios se quedan acá.
        </p>
        <div class="flex items-center gap-4">
          <Show when={preview()} fallback={<ProfileAvatar name={displayName().trim() || 'Syka'} size={64} />}>
            {(url) => <img src={url()} alt="Vista previa de la foto de perfil" class="size-16 shrink-0 rounded-full object-cover" onError={() => setFailedAvatar(url())} />}
          </Show>
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <input ref={fileInput} type="file" accept={AVATAR_FILE_TYPES.join(',')} class="hidden" aria-label="Elegir foto de perfil" disabled={processing()} onChange={changePhoto} />
              <Button variant="secondary" disabled={processing()} onClick={() => fileInput?.click()}>
                {processing() ? 'Procesando…' : avatar() ? 'Cambiar foto' : 'Agregar foto'}
              </Button>
              <Show when={avatar()}>
                <Button variant="ghost" disabled={processing()} onClick={() => { setAvatar(undefined); setFailedAvatar(undefined); }}>Quitar foto</Button>
              </Show>
            </div>
            <p class="text-xxs text-muted-foreground">PNG, JPEG o WebP · hasta 5 MB. Se guarda en este equipo al guardar los cambios.</p>
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
      <DitherAvatarPicker userName={displayName().trim() || 'Syka'} hasPhoto={!!preview()} onUse={() => {
        setAvatar(undefined); setFailedAvatar(undefined);
        try { auth.updateLocalProfile({ displayName: displayName(), avatarDataUrl: undefined }); } catch { toast.error('No se pudo guardar el perfil'); }
      }} />
      <DashboardSurfaceSection title="Conexión de los agentes">
        <p class="text-xs text-muted-foreground">
          Cada asistente usa su propio inicio de sesión en este equipo. Este perfil es solo cómo te ves en Syka y no se conecta con ningún proveedor.
        </p>
      </DashboardSurfaceSection>
    </DashboardScrollView>
  );
}
