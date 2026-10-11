import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { openSettings } from '@/components/settings/state';
import { Button } from '@/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel, TextFieldTextArea } from '@/components/ui/text-field';
import { Checkbox, CheckboxInput, CheckboxControl, CheckboxLabel } from '@/components/ui/checkbox';
import { DashboardScrollView, DashboardSurfaceSection, DashboardFormModal } from '@/components/dashboard/shared';
import type { DraftChanges, PublicationDraft, ZernioConnection } from '@desktop/publication/types';
import { openZernio, usePublication } from './state';
import './motion.css';

const selectClass = 'h-7 w-full rounded-md bg-input px-2 text-xs text-foreground focus-ring disabled:opacity-50';
const statusLabel: Record<string, string> = { local_draft: 'Borrador local', uploading: 'Subiendo video', submitting_unknown: 'Resultado por verificar', error: 'Requiere atención', draft: 'Borrador en Zernio', scheduled: 'Programado', publishing: 'Publicando', published: 'Publicado', partial: 'Publicación parcial', failed: 'Falló', cancelled: 'Cancelado', unknown: 'Estado por verificar' };
function localDate(value: string) {
  const date = new Date(value); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16);
}

function DraftEditor(props: { draft: PublicationDraft; connections: ZernioConnection[]; busy: boolean; act: ReturnType<typeof usePublication>['act'] }) {
  const [changes, setChanges] = createSignal<DraftChanges | null>(null), [date, setDate] = createSignal('');
  const [confirm, setConfirm] = createSignal(false);
  let loaded = '';
  createEffect(() => {
    const d = props.draft, version = `${d.id}:${d.revision}`;
    if (version === loaded) return; loaded = version;
    setChanges({ connectionId: d.connectionId, target: d.target, title: d.title, text: d.text, visibility: d.visibility, madeForKids: d.madeForKids, syntheticMedia: d.syntheticMedia, timing: d.timing });
    setDate(d.timing.mode === 'schedule' ? localDate(d.timing.atUtc) : localDate(new Date(Date.now() + 30 * 60_000).toISOString()));
  });
  const patch = (fields: Partial<DraftChanges>) => setChanges(current => current ? { ...current, ...fields } : current);
  const locked = () => props.busy || !!props.draft.attempt || !!props.draft.externalPostId;
  const connection = () => props.connections.find(c => c.id === changes()?.connectionId);
  const accounts = () => connection()?.accounts.filter(a => ['youtube', 'instagram'].includes(a.platform)) ?? [];
  const dirty = () => { const d = props.draft; return JSON.stringify(changes()) !== JSON.stringify({ connectionId: d.connectionId, target: d.target, title: d.title, text: d.text, visibility: d.visibility, madeForKids: d.madeForKids, syntheticMedia: d.syntheticMedia, timing: d.timing }); };
  const scheduled = () => changes()?.timing.mode === 'schedule';
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const invalidDate = () => changes()?.timing.mode === 'schedule' && !Number.isFinite(Date.parse((changes()!.timing as { atUtc: string }).atUtc));
  const updateDate = (value: string) => {
    setDate(value); const time = new Date(value).getTime();
    patch({ timing: { mode: 'schedule', atUtc: Number.isFinite(time) ? new Date(time).toISOString() : '', timezone: localTimezone } });
  };
  const targetName = () => props.draft.target ? `${props.draft.target.username} · ${props.draft.target.platform}` : 'Sin destino';
  return (
    <DashboardSurfaceSection title={props.draft.media.name} description={statusLabel[props.draft.phase === 'remote' ? props.draft.providerStatus || 'unknown' : props.draft.phase] || 'Estado por verificar'}>
      <div class="t-panel-slide flex flex-col gap-4 text-xs" data-open="true">
        <p class="truncate text-muted-foreground" title={props.draft.media.path}>{props.draft.media.path}</p>
        <p class="text-muted-foreground">{(props.draft.media.size / 1024 ** 2).toFixed(1)} MB · {props.draft.media.width ?? '?'} × {props.draft.media.height ?? '?'} · {props.draft.media.duration?.toFixed(1) ?? '?'} s</p>
        <label class="flex flex-col gap-2">Conexión de Zernio
          <select aria-label="Conexión de Zernio" class={selectClass} value={changes()?.connectionId ?? ''} disabled={locked()} onChange={e => patch({ connectionId: e.currentTarget.value || null, target: null })}><option value="">Elegí una conexión</option><For each={props.connections}>{c => <option value={c.id} disabled={!c.configured || !!c.error}>{c.label}</option>}</For></select>
        </label>
        <Show when={changes()?.target?.platform === 'instagram'}><p class="text-muted-foreground">Reels: MP4 o MOV con H.264, formato 9:16, de 3–90 segundos y hasta 300 MB.</p></Show>
        <label class="flex flex-col gap-2">Cuenta de destino
          <select aria-label="Cuenta de destino" class={selectClass} value={changes()?.target?.accountId ?? ''} disabled={locked() || !connection()} onChange={e => { const a = accounts().find(a => a.id === e.currentTarget.value); patch({ target: a ? { accountId: a.id, platform: a.platform as 'youtube' | 'instagram', username: a.username } : null }); }}><option value="">Elegí una cuenta social</option><For each={accounts()}>{a => <option value={a.id} disabled={!a.active || a.canPost !== true}>{a.username} · {a.platform}{a.canPost !== true ? ' · verificar permisos' : ''}</option>}</For></select>
        </label>
        <Show when={!props.connections.length}><p class="text-muted-foreground">Agregá una conexión en <button class="underline" onClick={() => openSettings('zernio')}>Configuración → Zernio</button>.</p></Show>
        <Show when={changes()?.target?.platform === 'youtube'}>
          <TextField value={changes()?.title ?? ''} onChange={title => patch({ title })}><TextFieldLabel uiSize="compact">Título de YouTube</TextFieldLabel><TextFieldInput uiSize="compact" maxlength={100} disabled={locked()} /></TextField>
          <label class="flex flex-col gap-2">Visibilidad<select aria-label="Visibilidad" class={selectClass} value={changes()?.visibility} disabled={locked()} onChange={e => patch({ visibility: e.currentTarget.value as DraftChanges['visibility'] })}><option value="private">Privado</option><option value="unlisted">No listado</option><option value="public">Público</option></select></label>
          <Checkbox class="flex items-center gap-2" checked={changes()?.madeForKids ?? false} disabled={locked()} onChange={madeForKids => patch({ madeForKids })}><CheckboxInput /><CheckboxControl /><CheckboxLabel class="text-xs">Contenido creado para niños</CheckboxLabel></Checkbox>
          <Checkbox class="flex items-center gap-2" checked={changes()?.syntheticMedia ?? false} disabled={locked()} onChange={syntheticMedia => patch({ syntheticMedia })}><CheckboxInput /><CheckboxControl /><CheckboxLabel class="text-xs">Contiene contenido sintético que requiere declaración</CheckboxLabel></Checkbox>
        </Show>
        <TextField value={changes()?.text ?? ''} onChange={text => patch({ text })}><TextFieldLabel uiSize="compact">{changes()?.target?.platform === 'youtube' ? 'Descripción' : 'Texto de la publicación'}</TextFieldLabel><TextFieldTextArea class="text-xs min-h-24 bg-input border-transparent" maxlength={changes()?.target?.platform === 'instagram' ? 2200 : 5000} disabled={locked()} /></TextField>
        <div class="flex gap-1 rounded-md bg-input p-1 self-start" role="group" aria-label="Momento de publicación"><Button variant={!scheduled() ? 'secondary' : 'ghost'} aria-pressed={!scheduled()} disabled={locked()} onClick={() => patch({ timing: { mode: 'now' } })}>Enviar ahora</Button><Button variant={scheduled() ? 'secondary' : 'ghost'} aria-pressed={scheduled()} disabled={locked()} onClick={() => updateDate(date())}>Programar</Button></div>
        <Show when={scheduled()}><label class="flex flex-col gap-2">Fecha y hora local<input class={selectClass} type="datetime-local" value={date()} disabled={locked()} onInput={e => updateDate(e.currentTarget.value)} /><span class="text-muted-foreground">{localTimezone}</span></label><Show when={invalidDate()}><p class="text-destructive" role="alert">Elegí una fecha y una hora antes de guardar.</p></Show><Show when={changes()?.target?.platform === 'youtube' && changes()?.visibility !== 'public'}><p class="text-muted-foreground">Si querés que aparezca públicamente a esa hora, elegí visibilidad Pública.</p></Show></Show>
        <Show when={props.draft.error}><p class="text-destructive" role="alert">{props.draft.error}</p></Show>
        <For each={props.draft.results}>{result => <div class="flex flex-wrap gap-2"><span>{result.platform} · {statusLabel[result.status] || result.status}</span><Show when={result.error}><span class="text-destructive">{result.error}</span></Show><Show when={result.url}><a class="underline" href={result.url!} target="_blank" rel="noopener noreferrer">Ver publicación</a></Show></div>}</For>
        <Show when={props.draft.externalPostId}><p class="text-muted-foreground">ID Zernio: {props.draft.externalPostId}</p></Show>
        <div class="flex flex-wrap gap-2">
          <Show when={!props.draft.attempt && !props.draft.externalPostId}>
            <Button variant="secondary" disabled={locked() || !dirty() || invalidDate()} onClick={() => void props.act({ action: 'save-draft', id: props.draft.id, revision: props.draft.revision, changes: changes()! }, 'Borrador guardado en este equipo')}>Guardar borrador</Button>
            <Button variant="ghost" disabled={locked()} onClick={() => void props.act({ action: 'delete-draft', id: props.draft.id, revision: props.draft.revision })}>Eliminar borrador</Button>
          </Show>
          <Show when={!props.draft.externalPostId && props.draft.phase !== 'uploading'}><Button variant="secondary" disabled={props.busy || dirty() || invalidDate() || !props.draft.target || !props.draft.connectionId || !!props.draft.retryAfterAt && props.draft.retryAfterAt > Date.now()} onClick={() => setConfirm(true)}>{props.draft.attempt ? 'Verificar y reintentar envío' : 'Revisar publicación'}</Button></Show>
          <Show when={props.draft.phase === 'uploading'}><Button variant="ghost" onClick={() => void props.act({ action: 'cancel-upload', id: props.draft.id, revision: props.draft.revision })}>Cancelar upload</Button></Show>
          <Show when={props.draft.externalPostId}><Button variant="secondary" disabled={props.busy} onClick={() => void props.act({ action: 'refresh-post', id: props.draft.id, revision: props.draft.revision })}>Actualizar estado</Button></Show>
        </div>
        <Show when={dirty()}><p class="text-muted-foreground">Guardá los cambios antes de revisar el envío.</p></Show>
      </div>
      <DashboardFormModal open={confirm()} title={props.draft.attempt ? 'Verificar un envío pendiente' : 'Revisar publicación'} onClose={() => setConfirm(false)} footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Volver</Button><Button variant="secondary" disabled={props.busy} onClick={() => { setConfirm(false); void props.act({ action: 'submit', id: props.draft.id, revision: props.draft.revision }); }}>{props.draft.attempt ? 'Reintentar operación' : props.draft.timing.mode === 'schedule' ? 'Confirmar programación' : 'Confirmar envío'}</Button></>}>
        <div class="flex flex-col gap-3 text-xs">
          <p class="text-foreground break-words">{props.draft.media.name}</p><p>{targetName()} · {connection()?.label}</p>
          <Show when={props.draft.target?.platform === 'youtube'}><p>{props.draft.title} · {({ private: 'Privado', unlisted: 'No listado', public: 'Público' })[props.draft.visibility]}</p></Show>
          <p class="text-muted-foreground whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{props.draft.text || 'Sin texto'}</p>
          <p>{props.draft.timing.mode === 'schedule' ? `${new Date(props.draft.timing.atUtc).toLocaleString([], { timeZone: props.draft.timing.timezone })} · ${props.draft.timing.timezone}` : 'Se enviará al confirmar.'}</p>
          <Show when={props.draft.attempt}><p class="text-muted-foreground">Se usa la misma operación guardada para recuperar su resultado. No cambies el contenido mientras se verifica.</p></Show>
        </div>
      </DashboardFormModal>
    </DashboardSurfaceSection>
  );
}

export function PublicationView() {
  const state = usePublication(); const [selected, setSelected] = createSignal<string | null>(null);
  const draft = () => state.data()?.drafts.find(d => d.id === selected()) ?? state.data()?.drafts[0];
  onMount(() => {
    let running = false, failures = 0, nextCheck = 0;
    const timer = setInterval(async () => {
      const d = draft();
      if (running || state.busy() || !navigator.onLine || Date.now() < nextCheck || !d?.externalPostId || !['publishing', 'scheduled', 'unknown'].includes(d.providerStatus ?? '') || d.timing.mode === 'schedule' && Date.parse(d.timing.atUtc) > Date.now()) return;
      running = true;
      try {
        const ok = await state.act({ action: 'refresh-post', id: d.id, revision: d.revision }, undefined, { quiet: true });
        failures = ok ? 0 : Math.min(failures + 1, 4);
        nextCheck = Date.now() + Math.min(300_000, 30_000 * 2 ** failures);
      } finally { running = false; }
    }, 30_000); onCleanup(() => clearInterval(timer));
  });
  return (
    <DashboardScrollView class="syka-publication">
      <DashboardSurfaceSection title="Publicaciones" description="Prepará un video exportado, elegí su destino y revisá el envío.">
        <div class="flex flex-wrap gap-2"><Button variant="secondary" disabled={!window.desktop || state.busy()} onClick={() => void state.act({ action: 'pick-export' })}>Elegir video exportado</Button><Button variant="ghost" onClick={() => openSettings('zernio')}>Conexiones Zernio</Button><Button variant="ghost" onClick={() => openZernio('dashboard')}>Abrir Zernio</Button></div>
        <p class="text-xs text-muted-foreground">Los borradores se guardan en este equipo. El archivo se sube al confirmar un envío o una programación.</p>
        <p class="text-xs text-muted-foreground">Destinos disponibles: YouTube e Instagram Reels. Cada borrador tiene su cuenta y su horario.</p>
        <Show when={state.error()}><p class="text-xs text-destructive" role="alert">{state.error()}</p></Show>
        <Show when={state.loading()}><p class="text-xs text-muted-foreground" role="status">Leyendo borradores…</p></Show>
      </DashboardSurfaceSection>
      <Show when={state.data()?.drafts.length} fallback={<Show when={!state.loading()}><DashboardSurfaceSection title="Todavía no hay borradores"><p class="text-xs text-muted-foreground">Elegí un export del editor para preparar tu primera publicación.</p></DashboardSurfaceSection></Show>}>
        <Show when={(state.data()?.drafts.length ?? 0) > 1}><label class="flex flex-col gap-2 text-xs">Borradores e historial<select class={selectClass} value={draft()?.id} onChange={e => setSelected(e.currentTarget.value)}><For each={state.data()?.drafts}>{d => <option value={d.id}>{d.media.name} · {statusLabel[d.phase === 'remote' ? d.providerStatus || 'unknown' : d.phase] || 'Estado por verificar'}</option>}</For></select></label></Show>
        <Show when={draft()}>{current => <DraftEditor draft={current()} connections={state.data()?.connections ?? []} busy={state.busy()} act={state.act} />}</Show>
      </Show>
    </DashboardScrollView>
  );
}
