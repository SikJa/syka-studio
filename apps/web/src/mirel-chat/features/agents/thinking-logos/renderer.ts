import { resolveLogo, type LogoState } from './vendor/logoPresets';
import { adaptTint, paintFrameTinted, parseTint } from './vendor/engine/tint';
import { paintFrame } from './vendor/engine/core';
import type { LogoPointSet } from './vendor/engine/cloud';

/** One scheduler for the visible marks; hidden, paused and reduced-motion marks never subscribe. */
const painters=new Set<(seconds:number)=>void>();
let frame=0,previous=0,elapsed=0;
function tick(now:number) {
  frame=0;
  if(now-previous>=1000/30) {
    elapsed+=Math.min(.08,Math.max(0,(now-previous)/1000));previous=now;
    for(const paint of painters) paint(elapsed);
  }
  if(painters.size)frame=requestAnimationFrame(tick);
}
export function subscribeMark(paint:(seconds:number)=>void) {
  painters.add(paint);
  if(!frame){previous=performance.now();frame=requestAnimationFrame(tick);}
  return ()=>{painters.delete(paint);if(!painters.size){cancelAnimationFrame(frame);frame=0;}};
}
export function markPainter(canvas:HTMLCanvasElement, points:LogoPointSet, state:LogoState, size:number, dark:boolean, tint:string) {
  const context=canvas.getContext('2d');
  const scale=Math.min(3,Math.max(1,window.devicePixelRatio||1));
  canvas.width=Math.round(size*scale);canvas.height=Math.round(size*scale);
  const resolved=resolveLogo(state,points,{inkFar:.38,inkSpan:.5,inkRim:.14,rMin:.34});
  const rgb=parseTint(tint);
  const adapted=rgb?adaptTint(rgb,dark):null;
  const markTime=Number(resolved.opts.dwell??5.5)+Number(resolved.opts.morph??1.9);
  return (seconds:number)=>{
    if(!context)return;
    context.setTransform(scale,0,0,scale,0,0);context.clearRect(0,0,size,size);
    const scene=resolved.frame(size,Math.max(0,seconds)*resolved.speed+markTime,resolved.opts,resolved.binding);
    if(adapted)paintFrameTinted(context,scene,dark,adapted);else paintFrame(context,scene,dark);
    canvas.dataset.frame=String(seconds);
  };
}
