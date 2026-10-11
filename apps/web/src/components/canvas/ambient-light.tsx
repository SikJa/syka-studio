import { createEffect, createSignal, onCleanup } from 'solid-js';
import { useWorld } from '@diffusionstudio/koota-solid';
import { RenderSurface, getActiveEntity } from '@diffusionstudio/runtime';
import { clipCaptureBox, targetBox } from '@/agent-chat/visual-target-model';
import './ambient-light.css';

const KEY='syka:preview-ambient:v1';
export const [ambientLight, updateAmbientLight]=createSignal(localStorage.getItem(KEY)!=='false');
export function setAmbientLight(enabled:boolean){updateAmbientLight(enabled);localStorage.setItem(KEY,String(enabled));}

/** A small, throttled copy of the preview. The hole leaves the actual video
 * pixels untouched; neither the light nor editor controls enter the export. */
export function AmbientLight(props:{fullscreen:boolean}){
  const world=useWorld();
  let canvas!:HTMLCanvasElement,layer!:HTMLDivElement;
  createEffect(()=>{
    if(!props.fullscreen||!ambientLight())return;
    const context=canvas.getContext('2d');if(!context)return;
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer:ReturnType<typeof setTimeout>;
    const sample=()=>{
      if(!document.hidden){
        const source=world.get(RenderSurface)?.canvas,scene=getActiveEntity(world);
        if(source instanceof HTMLCanvasElement&&scene?.isAlive()&&source.width&&source.height){
          const box=clipCaptureBox(targetBox(world,scene),source.width,source.height);
          if(box.width>1&&box.height>1){
            try{
              context.drawImage(source,box.x,box.y,box.width,box.height,0,0,canvas.width,canvas.height);
              // The light covers the whole fullscreen area; the render surface
              // keeps a smaller viewport so the video clears the chat/controls.
              const surface=source.getBoundingClientRect(),bounds=layer.getBoundingClientRect();
              if(bounds.width&&bounds.height){
                const left=surface.left-bounds.left+box.x/source.width*surface.width;
                const top=surface.top-bounds.top+box.y/source.height*surface.height;
                const x=left/bounds.width*100,y=top/bounds.height*100;
                const r=(left+box.width/source.width*surface.width)/bounds.width*100;
                const b=(top+box.height/source.height*surface.height)/bounds.height*100;
                layer.style.clipPath=`polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${x}% ${y}%,${x}% ${b}%,${r}% ${b}%,${r}% ${y}%,${x}% ${y}%)`;
                layer.dataset.ready='true';
              }else layer.dataset.ready='false';
            }catch{layer.dataset.ready='false';}
          }else layer.dataset.ready='false';
        }
      }
      timer=setTimeout(sample,reduce?500:125);
    };
    sample();onCleanup(()=>{clearTimeout(timer);layer.dataset.ready='false';context.clearRect(0,0,canvas.width,canvas.height);});
  });
  return <div ref={layer} class="syka-ambient-light" hidden={!props.fullscreen||!ambientLight()} aria-hidden="true"><canvas ref={canvas} width={96} height={54}/></div>;
}
