import {createEffect,createSignal,onCleanup,Show} from 'solid-js';
import {ElectronFileHandle} from '@/lib/electron-file-handle';
import {mainBridge} from '@/lib/ipc';
import {MAIN_CHANNELS} from '@desktop/main-channels';
import {attachmentFromPath} from './attachments';
import './sent-attachment.css';

/** The durable path in the transcript is the source, never a stale blob URL. */
export function SentAttachment(props:{path:string}) {
 const [preview,setPreview]=createSignal<string>();
 let dialog:HTMLDialogElement|undefined;
 let closeTimer:ReturnType<typeof setTimeout>|undefined;
 onCleanup(()=>clearTimeout(closeTimer));
 const name=()=>/[\\/]\.syka[\\/]chat-context[\\/]export-[a-f0-9-]+\.json$/i.test(props.path) ? 'Video exportado · Portada y textos' : attachmentFromPath(props.path).name.replace(/^chat-[a-f0-9-]{36}-/i,'');
 createEffect(()=>{
  const path=props.path;let cancelled=false,url:string|undefined;
  setPreview(undefined);
  if(window.desktop && /\.(png|jpe?g|webp|gif|avif)$/i.test(path))void (async()=>{
   const file=await new ElectronFileHandle(path).getFile();
   if(cancelled||file.size>16*1024*1024)return;
   url=URL.createObjectURL(file);setPreview(url);
  })().catch(()=>{});
  onCleanup(()=>{cancelled=true;if(url)URL.revokeObjectURL(url)});
 });
 const close=()=>{if(!dialog?.open)return;dialog.classList.remove('is-open');dialog.classList.add('is-closing');clearTimeout(closeTimer);closeTimer=setTimeout(()=>{dialog?.close();dialog?.classList.remove('is-closing')},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:150);};
 const open=()=>{if(preview()){clearTimeout(closeTimer);dialog?.classList.remove('is-closing');dialog?.showModal();requestAnimationFrame(()=>dialog?.classList.add('is-open'));}else if(window.desktop)void mainBridge.call(MAIN_CHANNELS.APP_SHOW_IN_FOLDER,{path:props.path}).catch(()=>{});};
 return <>
  <button type="button" class="syka-sent-attachment" data-image={!!preview()} title={name()} aria-label={`Abrir adjunto: ${name()}`} onClick={open}>
   <Show when={preview()} fallback={<span>{name()}</span>}><img src={preview()} alt={name()} loading="lazy"/></Show>
  </button>
  <dialog ref={dialog} class="syka-sent-image-dialog t-modal" aria-label={`Imagen adjunta: ${name()}`} onCancel={event=>{event.preventDefault();close()}} onClick={event=>{if(event.target===event.currentTarget)close()}}>
   <button type="button" aria-label="Cerrar imagen" onClick={close}>×</button>
   <img src={preview()} alt={name()}/><p>{name()}</p>
  </dialog>
 </>;
}
