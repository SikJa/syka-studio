import { LibraryPreview } from './library-ui';
import { createEffect, createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { Dialog, DialogContent, DialogTitle, DialogCloseButton, DialogPortal } from '@/components/ui/dialog';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { toast } from 'somoto';
import './motion-preview.css';

export type MotionReference = {
  slug: string; title: string; author: string; url: string;
  posterUrl?: string; previewUrl?: string; videoUrl?: string;
  promptShared: boolean; tags: string[];
};
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const labels: Record<string, string> = { 'anchor-morph': 'Formas conectadas', 'ui-demo': 'Interfaces', 'kinetic-type': 'Tipografía en movimiento', 'data-story': 'Datos', 'audio-sync': 'Ritmo y sonido', 'camera-continuity': 'Cámara continua', 'shape-morph': 'Transformación de formas', 'product-launch': 'Producto', 'typography': 'Tipografía', 'particles': 'Partículas', 'shapes': 'Formas' };
export function filterMotionReferences(entries: MotionReference[], query: string) {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return entries.filter(entry => words.every(word => normalize([entry.title, entry.author, ...entry.tags, ...entry.tags.map(tag => labels[tag] ?? '')].join(' ')).includes(word)));
}
function ReferencePoster(props: { source?: string }) {
  const [failed, setFailed] = createSignal(false);
  createEffect(() => { props.source; setFailed(false); });
  return <Show when={props.source && !failed()} fallback={<span class="syka-preview-placeholder">Vista previa no disponible</span>}><img src={props.source} loading="lazy" decoding="async" referrerPolicy="no-referrer" alt="" onError={() => setFailed(true)}/></Show>;
}

export function MotionLibrary(props: { query: string; expanded?:boolean; onUse(entry: MotionReference): void }) {
  const [catalog] = createResource(async () => (await import('./prompt-motion-catalog')).MOTION_REFERENCES);
  const [gallery,setGallery]=createSignal(false),[galleryQuery,setGalleryQuery]=createSignal(props.query);
  const [selected, setSelected] = createSignal<MotionReference>();
  const [limit, setLimit] = createSignal(24);
  const [failed, setFailed] = createSignal(false);
  createEffect(() => { props.query; setLimit(24); });
  createEffect(() => { selected(); setFailed(false); });
  const entries = createMemo(() => filterMotionReferences(catalog() ?? [], props.query));
  const openOriginal = async (entry: MotionReference) => {
    try {
      if (window.desktop) await mainBridge.call(MAIN_CHANNELS.APP_OPEN_EXTERNAL, { url: entry.url });
      else window.open(entry.url, '_blank', 'noopener,noreferrer');
    } catch { toast.error('No se pudo abrir la referencia original.'); }
  };
  return <section class="syka-motion-library" aria-label="Referencias de Prompt Motion">
    <header class="syka-motion-library-header"><strong>Prompt Motion</strong><span>{entries().length} referencias</span><Show when={!props.expanded}><button onClick={()=>{setGalleryQuery(props.query);setGallery(true)}}>Ver en grande</button></Show></header>
    <p class="syka-panel-note">Explorá ritmo, composición y transiciones. Abrí una referencia para verla grande y consultar el prompt de su autor.</p>
    <Show when={catalog.loading}><p role="status" class="syka-panel-note">Cargando referencias…</p></Show>
    <Show when={catalog.error}><p role="alert" class="syka-panel-error">No se pudo abrir el catálogo de referencias.</p></Show>
    <div class="syka-resource-grid syka-motion-reference-grid">
      <For each={entries().slice(0, limit())}>{entry => <button type="button" class="syka-resource-card" onClick={() => setSelected(entry)} aria-label={'Ver motion: ' + entry.title}>
        <span class="syka-resource-thumb"><ReferencePoster source={entry.posterUrl}/><span class="syka-motion-play" aria-hidden="true">▶</span></span>
        <strong>{entry.title}</strong><small>@{entry.author} · {entry.promptShared ? 'Prompt en la fuente' : 'Referencia visual'}</small>
      </button>}</For>
    </div>
    <Show when={!catalog.loading && !catalog.error && !entries().length}><p class="syka-panel-note" role="status">No hay referencias para esta búsqueda. Probá por autor, UI, typography o shapes.</p></Show>
    <Show when={entries().length > limit()}><button class="syka-motion-more" onClick={() => setLimit(value => value + 24)}>Mostrar más referencias</button></Show>
    <p class="syka-panel-note">Catálogo de estudio del 6/10/2026. Los videos se reproducen desde la fuente; no se incorporan como assets del proyecto.</p>
    <Show when={!props.expanded}><LibraryPreview open={gallery()} gallery title="Biblioteca de motions" onClose={()=>setGallery(false)}><label class="syka-search"><input aria-label="Buscar motions en galería" value={galleryQuery()} onInput={event=>setGalleryQuery(event.currentTarget.value)}/></label><Show when={gallery()}><MotionLibrary query={galleryQuery()} expanded onUse={entry=>{props.onUse(entry);setGallery(false)}}/></Show></LibraryPreview></Show>
    <Dialog open={!!selected()} onOpenChange={open => { if (!open) setSelected(undefined); }}>
      <DialogPortal><DialogContent class="syka-motion-preview syka-motion-reference-dialog" showCloseButton={false}>
        <DialogCloseButton class="syka-motion-close" aria-label="Cerrar referencia">×</DialogCloseButton>
        <Show when={selected()}>{entry => <>
          <DialogTitle>{entry().title}</DialogTitle>
          <div class="syka-motion-stage"><Show when={!failed() && (entry().videoUrl || entry().previewUrl)} fallback={<p role="status">La fuente no pudo reproducirse acá. Podés abrir el original y seguir usando la referencia.</p>}>
            <video src={entry().videoUrl || entry().previewUrl} poster={entry().posterUrl} controls playsinline preload="metadata" onError={() => setFailed(true)} />
          </Show></div>
          <div class="syka-motion-reference-info"><div><strong>@{entry().author}</strong><p>{entry().tags.map(tag => labels[tag]).filter(Boolean).join(' · ') || 'Referencia de movimiento y composición'}</p></div><p>Estudiá la continuidad, los tiempos y la jerarquía. Syka adapta esas decisiones a tu contenido con elementos editables.</p></div>
          <div class="syka-motion-reference-actions"><button onClick={() => void openOriginal(entry())}>{entry().promptShared ? 'Ver prompt original ↗' : 'Abrir fuente ↗'}</button><button onClick={() => { props.onUse(entry()); setSelected(undefined); }}>Usar como referencia</button></div>
        </>}</Show>
      </DialogContent></DialogPortal>
    </Dialog>
  </section>;
}
