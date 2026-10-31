import { createResource, createSignal, Show } from 'solid-js';
import { mainBridge } from '@/lib/ipc';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { Dialog, DialogContent, DialogTitle, DialogCloseButton, DialogPortal } from '@/components/ui/dialog';
import { PreviewIcon } from '@/components/canvas/preview-icon';
import './motion-preview.css';
import type { ResourceEntry } from '@desktop/main-channels';
import { resourcePreviews, visiblePreview } from './resource-previews';

export function MotionThumbnail(props: { path: string; posterPath?: string }) {
  const [enabled,setEnabled]=createSignal(false);
  let element!: HTMLSpanElement;
  const visible = visiblePreview(() => element);
  let video:HTMLVideoElement|undefined;
  let hovering=false;
  const [poster]=createResource(()=>visible()?props.posterPath:undefined,async path=>{
    try{return await resourcePreviews.get(path)}catch{return undefined}
  });
  const [preview, { mutate: clearPreview }]=createResource(()=>enabled()?props.path:undefined,async path=>{
    try{const source=await resourcePreviews.get(path);return hovering?source:undefined}catch{return undefined}
  });
  const enter=()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;hovering=true;setEnabled(true);void video?.play().catch(()=>{})};
  const leave=()=>{hovering=false;video?.pause();setEnabled(false);clearPreview(undefined)};
  return <span ref={element} class="absolute inset-0" onPointerEnter={enter} onPointerLeave={leave} onFocusIn={enter} onFocusOut={leave}>
    <Show when={enabled()&&preview()} fallback={<Show when={poster()} fallback={<span class="grid h-full place-items-center">Motion</span>}><img src={poster()} alt="" class="h-full w-full object-contain rounded-lg"/></Show>}>
      <video ref={video} src={preview()} muted loop playsinline preload="metadata" class="h-full w-full object-contain rounded-lg" onLoadedData={()=>{if(hovering)void video?.play().catch(()=>{})}}/>
    </Show>
  </span>;
}

export function MotionPreview(props:{entry:ResourceEntry|undefined;onClose():void;onUse(entry:ResourceEntry):void}) {
  const [preview]=createResource(()=>props.entry?.path,async path=>{
    try{return await mainBridge.call(MAIN_CHANNELS.SYKA_RESOURCES,{action:'preview',path})}catch{return null}
  });
  return <Dialog open={!!props.entry} onOpenChange={open=>{if(!open)props.onClose()}}>
    <DialogPortal><DialogContent role="dialog" class="syka-motion-preview sm:max-w-3xl rounded-2xl" showCloseButton={false}>
      <DialogCloseButton aria-label="Cerrar previsualización" class="absolute right-3 top-3 rounded-lg p-1"><PreviewIcon name="close"/></DialogCloseButton>
      <DialogTitle>{props.entry?.title ?? props.entry?.name.replace(/\.[^.]+$/,'')}</DialogTitle>
      <Show when={preview()?.preview} fallback={<p>{preview.loading?'Cargando motion…':'No se pudo abrir esta previsualización.'}</p>}>
        <video src={preview()!.preview} controls autoplay muted loop playsinline class="w-full rounded-xl"/>
      </Show>
      <p class="text-sm text-muted-foreground">{props.entry?.componentPath ? 'Incluye un componente editable. El agente puede adaptarlo con tus imágenes, textos y colores.' : 'Referencia visual. El agente revisará si hay código para reutilizarlo o recreará la técnica.'}</p>
      <button class="rounded-lg bg-secondary px-3 py-2 text-sm" onClick={()=>{if(props.entry){props.onUse(props.entry);props.onClose()}}}>Usar con el agente</button>
    </DialogContent></DialogPortal>
  </Dialog>;
}
