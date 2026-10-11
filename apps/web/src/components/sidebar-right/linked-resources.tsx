import { createResource, createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import { toast } from 'somoto';
import { useWorld } from '@diffusionstudio/koota-solid';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import type { ResourceKind, ResourceEntry } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { useLibrary } from '@/engine/library';
import { insertLinkedResource } from '@/engine/linked-resource-actions';
import { beginLinkedResourceDrag, endLinkedResourceDrag } from '@/engine/linked-resource-drag';
import { Button } from '@/components/ui/button';
import { PreviewIcon } from '@/components/canvas/preview-icon';
import { useProject } from '@/context/project';
import { referenceInChat, selectionContext, linkedReferenceInstruction } from '@/agent-chat/visual-context';
import { MotionThumbnail, MotionPreview } from './motion-preview';
import { AgentReferenceMenu } from './agent-reference-menu';
import { referenceThumbnail } from '@/agent-chat/reference-attachments';
import { t } from '@/i18n';

function LogoPreview(props: { path: string }) {
  const [preview] = createResource(() => props.path, async path => {
    try { return await mainBridge.call(MAIN_CHANNELS.SYKA_RESOURCES, { action: 'preview', path }); }
    catch { return null; } // One unreadable SVG must not take down the library.
  });
  return <Show when={preview()?.preview} fallback={<span>SVG</span>}><img src={preview()!.preview} alt="" loading="lazy" /></Show>;
}
export function LinkedResources(props: { kind: ResourceKind; query: string; onInserted: () => void }) {
  const world = useWorld(), library = useLibrary();
  const project = useProject();
  const [motionPreview,setMotionPreview]=createSignal<ResourceEntry>();
  const askAgent = (entry: ResourceEntry, preview?: string) => referenceInChat(project.id(),
    linkedReferenceInstruction(props.kind),
    {kind:props.kind,path:entry.path,name:entry.title ?? entry.name,brand:entry.brand,audioType:entry.audioType,componentPath:entry.componentPath,componentFiles:entry.componentFiles,usage:entry.usage,...selectionContext(world)}, preview);
  const [offset, setOffset] = createSignal(0), [busy, setBusy] = createSignal(false);
  const [audioType, setAudioType] = createSignal<ResourceEntry['audioType']>('sfx');
  const [audioFamily, setAudioFamily] = createSignal<ResourceEntry['audioFamily']>();
  const [familyTitle, setFamilyTitle] = createSignal('');
  const [revealed, setRevealed] = createSignal(false);
  const categoryOverview = () => props.kind==='sounds' && audioType()==='sfx' && !audioFamily() && !props.query.trim();
  const [playing, setPlaying] = createSignal<string | null>(null), [previewLoading, setPreviewLoading] = createSignal<string | null>(null);
  let player: HTMLAudioElement | undefined, previewRequest = 0;
  const stopPreview = () => { previewRequest++; if(player) {player.pause();player.removeAttribute('src');player.load();player=undefined;}setPlaying(null);setPreviewLoading(null); };
  createEffect(() => { props.query; props.kind; audioType(); audioFamily(); offset(); stopPreview(); });
  createEffect(() => { props.kind; audioFamily(); audioType(); props.query; setRevealed(false); const frame=requestAnimationFrame(()=>setRevealed(true));onCleanup(()=>cancelAnimationFrame(frame)); });
  onCleanup(stopPreview);
  const audition = async (entry: ResourceEntry) => {
    if(playing()===entry.path||previewLoading()===entry.path) {stopPreview();return;}
    stopPreview();const request=previewRequest;setPreviewLoading(entry.path);
    try {
      const result=await mainBridge.call(MAIN_CHANNELS.SYKA_RESOURCES,{action:'preview',path:entry.path});
      if(request!==previewRequest)return;
      if(!result.preview)throw Error('No se pudo preparar el sonido.');
      const audio=new Audio(result.preview);player=audio;audio.volume=.55;
      audio.onended=()=>{if(player===audio)stopPreview();};
      audio.onerror=()=>{if(player===audio){stopPreview();toast.error('No se pudo reproducir este formato de audio.');}};
      await audio.play();
      if(request===previewRequest){setPlaying(entry.path);setPreviewLoading(null);}
    } catch(error) {if(request===previewRequest){stopPreview();toast.error(String(error));}}
  };
  createEffect(() => { props.kind; audioType(); setAudioFamily(undefined); });
  createEffect(() => { props.query; props.kind; audioType(); audioFamily(); setOffset(0); });
  const [data, { refetch }] = createResource(() => ({ kind: props.kind, query: props.query, audioType: props.kind==='sounds'?audioType():undefined, audioFamily: props.kind==='sounds'?audioFamily():undefined, offset: offset(), limit: 48 }), async req => {
    if (!window.desktop) return null;
    try { return await mainBridge.call(MAIN_CHANNELS.SYKA_RESOURCES, { action: 'list', ...req }); }
    catch (error) { return { folders: [], entries: [], total: 0, nextOffset: null, audioCategories: [], warnings: ['No se pudo leer la biblioteca: ' + String(error)] }; }
  });
  const addFolder = async () => {
    setBusy(true);
    try {
      const path = await mainBridge.call(MAIN_CHANNELS.PROJECTS_PICK_FOLDER, undefined);
      if (path) { await mainBridge.call(MAIN_CHANNELS.SYKA_RESOURCES, { action: 'add-folder', kind: props.kind, path }); await refetch(); }
    } catch (error) { toast.error(String(error)); } finally { setBusy(false); }
  };
  const add = async (entry: ResourceEntry) => {
    if (busy()) return;
    setBusy(true);
    try {
      const lib = library(); if (!lib) throw Error('Abrí un proyecto para agregar recursos.');
      stopPreview();
      await insertLinkedResource(world, lib, { kind: props.kind, path: entry.path, title: entry.title ?? entry.name, audioType: entry.audioType });
      props.onInserted();
      toast.success((entry.title ?? entry.name) + ' agregado a la timeline');
    } catch (error) { toast.error(String(error)); } finally { setBusy(false); }
  };
  const drag = (event: DragEvent, entry: ResourceEntry) => {
    if (!library() || busy() || !event.dataTransfer) { event.preventDefault(); return; }
    stopPreview();
    beginLinkedResourceDrag(event.dataTransfer, props.kind, entry, referenceThumbnail(event.currentTarget as Element));
  };
  onCleanup(endLinkedResourceDrag);
  const remove = async (path: string) => {
    setBusy(true);
    try { await mainBridge.call(MAIN_CHANNELS.SYKA_RESOURCES, { action: 'remove-folder', kind: props.kind, path }); await refetch(); }
    catch (error) { toast.error(String(error)); }
    finally { setBusy(false); }
  };
  return <div class="syka-linked-resources" onKeyDown={e => e.stopPropagation()}>
    <div class="syka-library-folder-actions"><Button variant="secondary" disabled={!window.desktop || busy()} onClick={() => void addFolder()}>Conectar carpeta</Button><button onClick={() => void refetch()} disabled={busy()}>Actualizar</button></div>
    <p class="syka-panel-note">{props.kind === 'logos' ? 'Logos originales. Pasale la variante al agente para integrarla en tu video.' : props.kind === 'sounds' ? 'Escuchá los sonidos y pasáselos al agente con el momento del video.' : 'Mirá la animación y arrastrala al chat. El agente puede adaptar los componentes incluidos con tu contenido.'}</p>
    <Show when={props.kind==='sounds'}><div class="syka-audio-filters" role="group" aria-label="Tipo de sonido"><For each={[{label:'Efectos',value:'sfx'},{label:'Música',value:'music'},{label:'Capas',value:'stem'}] as const}>{option=><button aria-pressed={audioType()===option.value} onClick={()=>setAudioType(option.value)}>{t(option.label)}</button>}</For></div></Show>
    <For each={data()?.folders.filter(f => f.kind === props.kind)}>{f => <div class="syka-library-folder"><span title={f.bundled ? 'Catálogo incluido con Syka' : f.path}>{f.bundled ? props.kind==='sounds'?'Sonidos incluidos':props.kind==='motions'?'Motions incluidos':'Logos incluidos' : f.path.split(/[\\/]/).pop()}</span><Show when={!f.bundled}><button disabled={busy()} aria-label={'Desconectar ' + f.path} onClick={() => void remove(f.path)}>Desconectar</button></Show></div>}</For>
    <Show when={data.error}><p role="alert" class="syka-panel-note">No se pudo leer la biblioteca: {String(data.error)}</p></Show>
    <For each={data()?.warnings}>{warning => <p class="syka-panel-note" role="status">{warning}</p>}</For>
    <Show when={data.loading}><p class="syka-panel-note">Leyendo recursos…</p></Show>
    <Show when={props.kind==='sounds'&&audioFamily()}><div class="syka-audio-breadcrumb"><button aria-label="Volver a categorías de sonido" onClick={()=>setAudioFamily(undefined)}>‹ Categorías</button><strong>{familyTitle()}</strong></div></Show>
    <Show when={data()?.total&&!categoryOverview()}><div class="syka-section-label">{data()!.total} {props.kind==='sounds'?'sonidos':'recursos'}</div></Show>
    <div classList={{'t-panel-slide':props.kind==='sounds','syka-audio-detail':props.kind==='sounds'}} data-open={revealed()}>
    <Show when={categoryOverview()} fallback={<div class="syka-resource-grid"><For each={data()?.entries}>{entry => <AgentReferenceMenu onUse={preview => askAgent(entry, preview)}><div class="syka-resource-reference"><Show when={props.kind==='sounds'} fallback={<button class="syka-resource-card syka-linked-draggable" draggable={!!library()&&!busy()} onDragStart={event=>drag(event,entry)} onDragEnd={endLinkedResourceDrag} disabled={!library() || busy()} title={(entry.title ?? entry.brand) + ' / ' + entry.name + (props.kind === 'motions' ? ' · Arrastrar al chat para adaptar' : ' · Arrastrar al chat o a la timeline')} onClick={() => props.kind === 'motions' ? setMotionPreview(entry) : void add(entry)}>
      <span class="syka-resource-thumb syka-linked-thumb" data-logo-theme={props.kind === 'logos' ? entry.theme ?? 'any' : undefined}><Show when={props.kind === 'logos'} fallback={<MotionThumbnail path={entry.path} posterPath={entry.posterPath}/>}><LogoPreview path={entry.path} /></Show></span>
      <span>{props.kind==='motions' ? entry.title ?? entry.name.replace(/\.[^.]+$/, '') : entry.brand}</span><small>{entry.componentPath ? 'Componente editable' : entry.variant ? `${entry.variant === 'symbol' ? 'Símbolo' : 'Nombre'} · ${entry.theme === 'dark' ? 'Fondo oscuro' : entry.theme === 'light' ? 'Fondo claro' : 'Original'}` : entry.name.replace(/\.[^.]+$/, '')}</small>
    </button>}><div class="syka-resource-card syka-audio-card syka-linked-draggable" draggable={!!library()&&!busy()} onDragStart={event=>drag(event,entry)} onDragEnd={endLinkedResourceDrag} title="Arrastrar a la timeline">
      <button class="syka-audio-audition" aria-label={(playing()===entry.path?'Detener ':'Escuchar ')+(entry.title??entry.name)} aria-pressed={playing()===entry.path} aria-busy={previewLoading()===entry.path} onClick={()=>void audition(entry)}><PreviewIcon name={playing()===entry.path?'pause':'play'}/><span>{previewLoading()===entry.path?'Cargando…':entry.duration?`${entry.duration.toFixed(2)} s`:'Escuchar'}</span></button>
      <button class="syka-audio-insert" disabled={!library()||busy()} title={[entry.brand,entry.license,entry.loop?'Loop':''].filter(Boolean).join(' · ')} aria-label={'Agregar '+(entry.title??entry.name)} onClick={()=>void add(entry)}><strong>{entry.title??entry.name.replace(/\.[^.]+$/,'')}</strong><small>{[entry.provider??entry.brand,entry.bpm?`${entry.bpm} BPM`:undefined,entry.loop?'Loop':undefined].filter(Boolean).join(' · ')}</small><span>Agregar en el cabezal</span></button>
    </div></Show><button type="button" class="syka-resource-ask" aria-label={'Pasar al agente '+(entry.title??entry.name)} onClick={event => askAgent(entry, referenceThumbnail(event.currentTarget.closest('.syka-resource-reference')))}>Usar con el agente ↗</button></div></AgentReferenceMenu>}</For></div>}>
      <nav class="syka-audio-categories" aria-label="Categorías de efectos"><For each={data()?.audioCategories}>{category=><button aria-label={category.title+', '+category.count+' sonidos'} onClick={()=>{setFamilyTitle(category.title);setAudioFamily(category.id);}}><span>{category.title}</span><small>{category.count}</small></button>}</For></nav>
    </Show></div>
    <div class="syka-library-folder-actions">
      <Show when={!categoryOverview()&&offset() > 0}><Button variant="secondary" disabled={busy() || data.loading} onClick={() => setOffset(Math.max(0, offset() - 48))}>Anterior</Button></Show>
      <Show when={!categoryOverview()&&data()?.nextOffset !== null && data()?.nextOffset !== undefined}><Button variant="secondary" disabled={busy() || data.loading} onClick={() => setOffset(data()!.nextOffset!)}>Siguiente</Button></Show>
    </div>
    <Show when={!data.loading && !data.error && !data()?.total}><p class="syka-panel-note">{data()?.folders.some(f => f.kind === props.kind) ? 'No hay recursos para esta búsqueda.' : 'Conectá tu propia carpeta para empezar.'}</p></Show>
    <MotionPreview entry={motionPreview()} onClose={()=>setMotionPreview(undefined)} onUse={askAgent}/>
  </div>;
}
