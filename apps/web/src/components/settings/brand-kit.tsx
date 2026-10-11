import { createEffect, createMemo, createResource, createSignal, onCleanup, Show } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { defaultBrand, type BrandKit, type BrandState } from '@desktop/studio-settings-types';
import { mainBridge } from '@/lib/ipc';
import { Button } from '@/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel, TextFieldTextArea } from '@/components/ui/text-field';
import { DashboardScrollView, DashboardSurfaceSection } from '@/components/dashboard/shared';

const browserKey = 'syka.brand-kit.v1';
async function readBrand(): Promise<BrandState> {
  if (window.desktop) return mainBridge.call(MAIN_CHANNELS.SYKA_STUDIO_SETTINGS, { action: 'get' });
  const value = JSON.parse(localStorage.getItem(browserKey) ?? 'null');
  return value?.brand && Number.isSafeInteger(value.revision) ? value : { revision: 0, brand: { ...defaultBrand } };
}
async function compactLogo(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 ** 2) throw Error('Elegí un PNG, JPEG o WebP de hasta 5 MB.');
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw Error('No se pudo preparar el logo.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const value = canvas.toDataURL('image/webp', .9);
    if (value.length > 400_000) throw Error('Probá con un logo más liviano.');
    return value;
  } finally { image.close(); }
}

export function BrandKitSettings() {
  const [data, { mutate, refetch }] = createResource(readBrand);
  const [draft, setDraft] = createSignal<BrandKit>({ ...defaultBrand });
  const [busy, setBusy] = createSignal(false), [processing, setProcessing] = createSignal(false), [error, setError] = createSignal('');
  let fileInput!: HTMLInputElement, disposed = false;
  onCleanup(() => { disposed = true; });
  createEffect(() => { const current = data(); if (current) setDraft({ ...current.brand }); });
  const changed = createMemo(() => !!data() && JSON.stringify(draft()) !== JSON.stringify(data()!.brand));
  const patch = (value: Partial<BrandKit>) => setDraft(current => ({ ...current, ...value }));
  const save = async () => {
    if (!data() || busy()) return;
    setBusy(true); setError('');
    try {
      let next: BrandState;
      if (window.desktop) next = await mainBridge.call(MAIN_CHANNELS.SYKA_STUDIO_SETTINGS, { action: 'save-brand', expectedRevision: data()!.revision, brand: draft() });
      else { next = { revision: data()!.revision + 1, brand: { ...draft() } }; localStorage.setItem(browserKey, JSON.stringify(next)); }
      if (!disposed) { mutate(next); toast.success('Brand kit guardado en este equipo'); }
    } catch (failure) { if (!disposed) setError(failure instanceof Error ? failure.message : 'No se pudo guardar.'); }
    finally { if (!disposed) setBusy(false); }
  };
  const copy = async () => {
    const brand = data()?.brand; if (!brand) return;
    try { await navigator.clipboard.writeText([`Marca: ${brand.name || 'Sin nombre'}`, `Sitio: ${brand.website || 'Sin sitio'}`, `Colores: ${brand.primary}, ${brand.secondary}`, `Tipografía: ${brand.font}`, `Voz de marca: ${brand.voice || 'Sin definir'}`].join('\n')); toast.success('Referencias copiadas'); }
    catch { toast.error('No se pudieron copiar las referencias.'); }
  };
  return <DashboardScrollView>
    <Show when={data.error}><p class="syka-settings-error" role="alert">No se pudo leer el brand kit. <Button variant="ghost" onClick={() => void refetch()}>Volver a intentar</Button></p></Show>
    <Show when={!data.loading} fallback={<p role="status" class="text-xs text-muted-foreground">Leyendo referencias de marca…</p>}>
      <DashboardSurfaceSection title="Identidad de marca" description="Tu logo y tus referencias, listos para reutilizar en los proyectos.">
        <div class="syka-brand-logo-row">
          <div class="syka-brand-logo-preview"><Show when={draft().logo} fallback={<span>{(draft().name.trim() || 'S').slice(0, 1).toUpperCase()}</span>}>{logo => <img src={logo()} alt="Logo de la marca" />}</Show></div>
          <div><input ref={fileInput} type="file" class="hidden" accept="image/png,image/jpeg,image/webp" aria-label="Elegir logo de marca" disabled={processing() || busy()} onChange={async event => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return;
            setProcessing(true); try { const logo = await compactLogo(file); if (!disposed) patch({ logo }); } catch (failure) { if (!disposed) toast.error(String(failure)); } finally { if (!disposed) setProcessing(false); }
          }} />
            <div class="flex flex-wrap gap-2"><Button variant="secondary" disabled={processing() || busy()} onClick={() => fileInput.click()}>{processing() ? 'Preparando…' : draft().logo ? 'Cambiar logo' : 'Agregar logo'}</Button><Show when={draft().logo}><Button variant="ghost" disabled={processing() || busy()} onClick={() => patch({ logo: undefined })}>Quitar logo</Button></Show></div>
            <p class="mt-2 text-xxs text-muted-foreground">PNG, JPEG o WebP · hasta 5 MB · se conserva la proporción.</p>
          </div>
        </div>
        <TextField value={draft().name} onChange={name => patch({ name })}><TextFieldLabel uiSize="compact">Nombre de la marca</TextFieldLabel><TextFieldInput uiSize="compact" maxlength={80} placeholder="Tu marca o estudio" disabled={busy()} /></TextField>
        <TextField value={draft().website} onChange={website => patch({ website })}><TextFieldLabel uiSize="compact">Sitio web</TextFieldLabel><TextFieldInput uiSize="compact" type="url" maxlength={2048} placeholder="https://tumarca.com" disabled={busy()} /></TextField>
      </DashboardSurfaceSection>
      <DashboardSurfaceSection title="Colores y tipografía">
        <div class="syka-brand-colors">
          <label>Color principal<div><input type="color" aria-label="Color principal" value={draft().primary} disabled={busy()} onInput={event => patch({ primary: event.currentTarget.value })} /><code>{draft().primary.toUpperCase()}</code></div></label>
          <label>Color secundario<div><input type="color" aria-label="Color secundario" value={draft().secondary} disabled={busy()} onInput={event => patch({ secondary: event.currentTarget.value })} /><code>{draft().secondary.toUpperCase()}</code></div></label>
        </div>
        <TextField value={draft().font} onChange={font => patch({ font })}><TextFieldLabel uiSize="compact">Tipografía de la marca</TextFieldLabel><TextFieldInput uiSize="compact" maxlength={80} placeholder="Inter" disabled={busy()} /></TextField>
        <p class="text-xxs text-muted-foreground">Una referencia para tus piezas; las fuentes disponibles dependen de las que tengas instaladas.</p>
      </DashboardSurfaceSection>
      <DashboardSurfaceSection title="Voz de marca">
        <TextField value={draft().voice} onChange={voice => patch({ voice })}><TextFieldLabel uiSize="compact">Cómo habla tu marca</TextFieldLabel><TextFieldTextArea class="text-xs min-h-24 bg-input border-transparent" maxlength={1500} disabled={busy()} placeholder="Tono, expresiones, cosas que evitamos…" /></TextField>
      </DashboardSurfaceSection>
      <Show when={error()}><p class="syka-settings-error" role="alert">{error()} <Button variant="ghost" onClick={() => void refetch()}>Volver a cargar</Button></p></Show>
      <div class="syka-settings-actions"><Button variant="secondary" disabled={!changed() || busy() || processing() || !draft().font.trim()} onClick={() => void save()}>{busy() ? 'Guardando…' : 'Guardar brand kit'}</Button><Button variant="ghost" disabled={!data() || changed()} onClick={() => void copy()}>Copiar referencias</Button><span>{changed() ? 'Cambios sin guardar' : 'Guardado localmente'}</span></div>
    </Show>
  </DashboardScrollView>;
}
