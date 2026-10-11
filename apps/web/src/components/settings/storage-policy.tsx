import { createEffect, createResource, createSignal, For, Show } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { DEFAULT_STORAGE_POLICY, STORAGE_POLICY_CHOICES, type CleanupCategory, type StorageOverview, type StoragePolicy } from '@desktop/storage/types';
import { mainBridge } from '@/lib/ipc';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectPortal, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardSurfaceSection } from '@/components/dashboard/shared';

export function storageSize(bytes: number): string {
  const unit = bytes >= 1024 ** 3 ? 3 : bytes >= 1024 ** 2 ? 2 : bytes >= 1024 ? 1 : 0;
  return `${(bytes / 1024 ** unit).toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${['B', 'KB', 'MB', 'GB'][unit]}`;
}
const categories: { key: CleanupCategory; label: string; detail: string }[] = [
  { key: 'cache', label: 'Caché de transcripciones', detail: 'Resultados reutilizables para evitar repetir una transcripción.' },
  { key: 'temporary', label: 'Descargas temporales', detail: 'Restos de procesamiento. Los trabajos en curso se conservan.' },
  { key: 'trash', label: 'Papelera de Syka', detail: 'Referencias y grabaciones descartadas explícitamente.' },
];
function PolicySelect(props: { label: string; value: number; choices: readonly number[]; text(value: number): string; onChange(value: number): void; disabled: boolean }) {
  return <Select<number> options={[...props.choices]} optionTextValue={value => props.text(value)} value={props.value} onChange={value => { if (value !== null) props.onChange(value); }} disabled={props.disabled} itemComponent={item => <SelectItem item={item.item}>{props.text(item.item.rawValue)}</SelectItem>}>
    <SelectTrigger class="syka-settings-select" aria-label={props.label}><SelectValue<number>>{value => props.text(value.selectedOption())}</SelectValue></SelectTrigger>
    <SelectPortal><SelectContent class="syka-storage-select" /></SelectPortal>
  </Select>;
}

/** Own settings resource: changing a deadline never rescans all project folders. */
export function StoragePolicySettings() {
  const [loadError, setLoadError] = createSignal<string>();
  const [state, { refetch }] = createResource(async (): Promise<StorageOverview | null> => {
    setLoadError(undefined);
    if (!window.desktop) return null;
    try { return (await mainBridge.call(MAIN_CHANNELS.SYKA_STORAGE, { action: 'overview' })).overview!; }
    catch (reason) { setLoadError(reason instanceof Error ? reason.message : String(reason)); return null; }
  });
  const [draft, setDraft] = createSignal<StoragePolicy>({ ...DEFAULT_STORAGE_POLICY });
  const [dirty, setDirty] = createSignal(false), [busy, setBusy] = createSignal(false), [review, setReview] = createSignal<'eligible' | 'cache'>();
  createEffect(() => { const current = state(); if (current && !dirty()) setDraft({ ...current.policy }); });
  const change = <K extends keyof StoragePolicy>(key: K, value: StoragePolicy[K]) => { setDirty(true); setReview(undefined); setDraft(current => ({ ...current, [key]: value })); };
  const error = (reason: unknown) => toast.error('No se pudo completar la operación', { description: reason instanceof Error ? reason.message : String(reason) });
  const save = async () => {
    if (!state() || busy()) return; setBusy(true);
    try { await mainBridge.call(MAIN_CHANNELS.SYKA_STORAGE, { action: 'save', expectedRevision: state()!.revision, policy: draft() }); await refetch(); setDirty(false); toast.success('Configuración de almacenamiento guardada'); }
    catch (reason) { error(reason); } finally { setBusy(false); }
  };
  const preview = async (category: 'eligible' | 'cache') => {
    setBusy(true);
    try { if (await refetch()) setReview(category); } catch (reason) { error(reason); } finally { setBusy(false); }
  };
  const clean = async () => {
    const category = review(); if (!category || busy()) return; setBusy(true);
    try {
      const result = await mainBridge.call(MAIN_CHANNELS.SYKA_STORAGE, { action: 'clean', category });
      setReview(undefined); await refetch();
      const report = result.cleanup!;
      if (report.failures) toast.warning('La limpieza terminó con archivos pendientes', { description: `${storageSize(report.bytes)} liberados. ${report.failures} elementos se conservaron porque no pudieron limpiarse.` });
      else toast.success(report.bytes ? `${storageSize(report.bytes)} liberados` : 'No había archivos disponibles para limpiar');
    } catch (reason) { error(reason); } finally { setBusy(false); }
  };
  const restore = async (id: string) => {
    setBusy(true);
    try { await mainBridge.call(MAIN_CHANNELS.SYKA_STORAGE, { action: 'restore', id }); await refetch(); toast.success('Elemento recuperado en su proyecto'); }
    catch (reason) { error(reason); } finally { setBusy(false); }
  };
  const reviewedBytes = () => { const current = state(); return !current ? 0 : review() === 'cache' ? current.totals.cache.bytes : categories.reduce((total, item) => total + current.eligible[item.key].bytes, 0); };
  const disabled = () => busy() || state.loading || !state();
  const days = (value: number) => value === 0 ? 'Sin vencimiento' : value === 1 ? '1 día' : `${value} días`;
  return <>
    <DashboardSurfaceSection title="Limpieza automática" description="Elegí cuánto conservar los archivos temporales y la caché. Tus medios y referencias guardadas no vencen.">
      <Show when={loadError()}><p class="syka-settings-error" role="alert">{loadError()} <button type="button" onClick={() => void refetch()}>Volver a intentar</button></p></Show>
      <Show when={!window.desktop}><p class="text-xs text-muted-foreground">La limpieza automática requiere Syka para escritorio.</p></Show>
      <div class="syka-settings-row"><div><p>Limpiar automáticamente</p><small>Syka aprovecha los momentos de inactividad y espera si estás grabando, descargando o transcribiendo.</small></div><label class="syka-storage-toggle"><input type="checkbox" aria-label="Limpiar automáticamente" checked={draft().automatic} disabled={disabled()} onChange={event => change('automatic', event.currentTarget.checked)} /><span>{draft().automatic ? 'Activada' : 'Desactivada'}</span></label></div>
      <div class="syka-settings-row"><div><p>Revisar cada</p><small>La primera revisión ocurre un minuto después de abrir Syka.</small></div><PolicySelect label="Frecuencia de limpieza" value={draft().intervalMinutes} choices={STORAGE_POLICY_CHOICES.intervalMinutes} text={value => value < 60 ? `${value} minutos` : value === 60 ? '1 hora' : value === 1440 ? '1 día' : '6 horas'} onChange={value => change('intervalMinutes', value)} disabled={disabled()} /></div>
      <div class="syka-settings-row"><div><p>Caché sin uso</p><small>El plazo vuelve a empezar cuando se reutiliza una transcripción.</small></div><PolicySelect label="Conservar caché sin uso" value={draft().cacheDays} choices={STORAGE_POLICY_CHOICES.cacheDays} text={days} onChange={value => change('cacheDays', value)} disabled={disabled()} /></div>
      <div class="syka-settings-row"><div><p>Límite de caché</p><small>Al superar el límite se limpian primero los resultados más antiguos. También aplica si elegís sin vencimiento.</small></div><PolicySelect label="Límite de caché" value={draft().cacheLimitMB} choices={STORAGE_POLICY_CHOICES.cacheLimitMB} text={value => value === 0 ? 'Sin límite' : storageSize(value * 1024 ** 2)} onChange={value => change('cacheLimitMB', value)} disabled={disabled()} /></div>
      <div class="syka-settings-row"><div><p>Restos de trabajos interrumpidos</p><small>Las descargas normales se eliminan al finalizar. Este plazo cubre los temporales que quedaron después de un fallo.</small></div><PolicySelect label="Conservar temporales interrumpidos" value={draft().orphanDays} choices={STORAGE_POLICY_CHOICES.orphanDays} text={days} onChange={value => change('orphanDays', value)} disabled={disabled()} /></div>
      <div class="syka-settings-row"><div><p>Papelera</p><small>Tiempo para recuperar un elemento que descartaste. Al vencer, se elimina definitivamente.</small></div><PolicySelect label="Conservar papelera" value={draft().trashDays} choices={STORAGE_POLICY_CHOICES.trashDays} text={days} onChange={value => change('trashDays', value)} disabled={disabled()} /></div>
      <div class="syka-settings-row"><div><p>Avisar cuando queda poco espacio</p><small>El aviso no elimina archivos de tus proyectos.</small></div><PolicySelect label="Aviso de espacio disponible" value={draft().lowSpaceGB} choices={STORAGE_POLICY_CHOICES.lowSpaceGB} text={value => value ? `Menos de ${value} GB` : 'Desactivado'} onChange={value => change('lowSpaceGB', value)} disabled={disabled()} /></div>
      <div class="syka-storage-protection"><strong>Fotos, videos, audios y referencias del proyecto</strong><span>Se conservan mientras los necesites. Cerrar Syka o dejar un proyecto una semana no los elimina.</span></div>
      <div class="syka-storage-actions"><Button variant="secondary" disabled={disabled()} onClick={() => { setDirty(true); setReview(undefined); setDraft({ ...DEFAULT_STORAGE_POLICY }); }}>Restablecer valores</Button><Button disabled={disabled() || !dirty()} onClick={() => void save()}>{busy() ? 'Guardando…' : 'Guardar cambios'}</Button></div>
    </DashboardSurfaceSection>
    <DashboardSurfaceSection title="Liberar espacio" description="Revisá qué se puede limpiar antes de eliminarlo.">
      <Show when={state()}>{current => <>
        <Show when={current().availableBytes !== undefined && current().policy.lowSpaceGB > 0 && current().availableBytes! < current().policy.lowSpaceGB * 1024 ** 3}><p class="syka-storage-warning" role="status">Quedan {storageSize(current().availableBytes!)} libres en el disco de Syka. Podés limpiar la caché o elegir otra carpeta para los próximos proyectos.</p></Show>
        <For each={categories}>{item => <div class="syka-settings-row"><div><p>{item.label}</p><small>{item.detail}</small></div><span class="syka-storage-size">{storageSize(current().totals[item.key].bytes)}</span></div>}</For>
        <Show when={current().partial}><p class="text-xxs text-muted-foreground">La medición es parcial. Los elementos que no se pudieron verificar se conservan.</p></Show>
        <Show when={current().lastCleanup}>{last => <p class="text-xxs text-muted-foreground">Última limpieza en esta sesión: {new Date(last().at).toLocaleString('es-AR')} · {storageSize(last().bytes)} liberados.</p>}</Show>
      </>}</Show>
      <div class="syka-storage-actions"><Button variant="secondary" disabled={disabled() || dirty()} onClick={() => void preview('eligible')}>Revisar limpieza</Button><Button variant="ghost" disabled={disabled() || dirty()} onClick={() => void preview('cache')}>Limpiar toda la caché…</Button><Button variant="ghost" disabled={disabled()} onClick={() => void refetch()}>Actualizar</Button></div>
      <Show when={dirty()}><p class="text-xxs text-muted-foreground">Guardá los cambios de plazos antes de revisar una limpieza.</p></Show>
      <Show when={review()}><div class="syka-storage-review" role="region" aria-label="Revisión de limpieza"><strong>{review() === 'cache' ? 'Limpiar toda la caché de transcripciones' : 'Limpiar archivos que cumplieron su plazo'}</strong><p>Se pueden liberar {storageSize(reviewedBytes())}. Se conservan los proyectos, sus medios, los adjuntos del chat y los trabajos en curso.</p><div class="syka-storage-actions"><Button variant="secondary" disabled={busy()} onClick={() => setReview(undefined)}>Cancelar</Button><Button disabled={busy() || reviewedBytes() === 0} onClick={() => void clean()}>{busy() ? 'Limpiando…' : 'Confirmar limpieza'}</Button></div></div></Show>
      <Show when={state()?.trash.length}><div class="syka-storage-trash"><strong>Podés recuperar</strong><For each={state()?.trash}>{item => <div class="syka-settings-row"><div><p>{item.name}</p><small>Descartado {new Date(item.discardedAt).toLocaleDateString('es-AR')} · {storageSize(item.bytes)}</small><p class="syka-storage-path">{item.originalPath}</p></div><Button variant="secondary" disabled={disabled()} onClick={() => void restore(item.id)}>Recuperar</Button></div>}</For></div></Show>
    </DashboardSurfaceSection>
  </>;
}
