import { createResource, createEffect, onCleanup, Show } from 'solid-js';
import { assetName, type Asset } from '@diffusionstudio/assets';
import { LibraryPreview } from './library-ui';

export function LibraryAssetPreview(props:{asset:Asset|undefined;onClose():void;onInsert(asset:Asset):void}){
  let url:string|undefined,version=0;
  const release=()=>{version++;if(url)URL.revokeObjectURL(url);url=undefined};
  const [source]=createResource(()=>props.asset,async asset=>{release();const current=version;const file=await asset.handle.getFile();if(current!==version)return;url=URL.createObjectURL(file);return url});
  createEffect(()=>{if(!props.asset)release()});
  onCleanup(release);
  return <LibraryPreview open={!!props.asset} title={props.asset?assetName(props.asset):'Archivo'} onClose={props.onClose} footer={<button disabled={source.loading||!!source.error} onClick={()=>{if(props.asset)props.onInsert(props.asset)}}>Agregar a la timeline</button>}>
    <Show when={!source.loading&&!source.error&&source()} fallback={<p>{source.error?'No se pudo leer este archivo.':'Cargando archivo…'}</p>}>
      <Show when={props.asset?.mimeType.startsWith('video/')} fallback={<Show when={props.asset?.mimeType.startsWith('audio/')} fallback={<Show when={props.asset?.mimeType.startsWith('image/')} fallback={<p>Este archivo se puede agregar al proyecto.</p>}><img class="syka-library-media" src={source()} alt={props.asset?assetName(props.asset):''}/></Show>}><audio controls src={source()} class="syka-library-audio"/></Show>}><video controls playsinline src={source()} class="syka-library-media"/></Show>
    </Show>
  </LibraryPreview>;
}
