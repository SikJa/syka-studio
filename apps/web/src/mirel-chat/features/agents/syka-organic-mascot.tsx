/** @jsxImportSource react */
import {useEffect, useRef} from 'react';
import {drawSykaMascot, MASCOT_LABELS, type MascotActivity, type MascotEyeFinish, type MascotPointer} from '@/lib/syka-mascot';

/** The original orb, with the approved face and optional gesture overlays. */
// eslint-disable-next-line solid/no-destructure -- This is a React island.
export function SykaOrganicMascot({activity, size=36, paused=false, face=true, finish='accent', accent, interactive=true}: {
  activity:MascotActivity; size?:number; paused?:boolean; face?:boolean; finish?:MascotEyeFinish; accent?:string; interactive?:boolean;
}) {
  const canvas=useRef<HTMLCanvasElement>(null),clock=useRef(.6);
  const pointer=useRef<MascotPointer>(null);
  useEffect(()=>{
    const node=canvas.current,ctx=node?.getContext('2d');if(!node||!ctx)return;
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const staticMotion=()=>media.matches||(document.documentElement.dataset.motion==='reduced'||document.documentElement.dataset.sykaMotion==='reduced');
    // The real editor and notification windows both expose the selected colour
    // through --primary. Standalone previews may supply an explicit value.
    let selectedAccent=accent??getComputedStyle(node).getPropertyValue('--primary').trim();
    let visible=false,frame=0,last=0,lastDraw=0;
    const paint=()=>{
      const px=Math.ceil(size*Math.min(2,devicePixelRatio||1));
      if(node.width!==px)node.width=node.height=px;
      ctx.clearRect(0,0,px,px);drawSykaMascot(ctx,px,clock.current,activity,true,staticMotion()||paused,face,finish,selectedAccent,pointer.current);
    };
    // Idle breathing does not need 30 fps, and an unfocused window does not
    // need to animate at all: this canvas kept the GPU busy while Syka idled.
    const interval=()=>activity==='idle'&&!pointer.current?1000/10:1000/30;
    const running=()=>!paused&&!staticMotion()&&!document.hidden&&visible&&document.hasFocus();
    const tick=(now:number)=>{
      frame=0;if(!running())return;
      if(last)clock.current+=Math.min(.12,(now-last)/1000);last=now;
      if(now-lastDraw>=interval()){paint();lastDraw=now;}
      frame=requestAnimationFrame(tick);
    };
    const sync=()=>{
      cancelAnimationFrame(frame);frame=0;last=0;paint();
      if(running())frame=requestAnimationFrame(tick);
    };
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});observer.observe(node);
    const input:HTMLElement=node.closest('button')??node;
    const look=(event:PointerEvent)=>{
      if(event.pointerType==='touch'||staticMotion()||paused)return;
      const rect=node.getBoundingClientRect();
      pointer.current={x:(event.clientX-rect.left)/rect.width*2-1,y:(event.clientY-rect.top)/rect.height*2-1};
      node.dataset.interaction='following';if(!frame)paint();
    };
    const rest=()=>{pointer.current=null;node.dataset.interaction='rest';paint();};
    const focus=()=>{pointer.current={x:0,y:0};node.dataset.interaction='following';paint();};
    input.addEventListener('pointerenter',look);input.addEventListener('pointermove',look);
    input.addEventListener('pointerleave',rest);input.addEventListener('pointercancel',rest);
    input.addEventListener('focus',focus);input.addEventListener('blur',rest);
    const appearance=new MutationObserver(()=>{
      selectedAccent=accent??getComputedStyle(node).getPropertyValue('--primary').trim();sync();
    });
    appearance.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-kb-theme','data-theme','data-motion','data-syka-motion']});
    media.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);window.addEventListener('resize',sync);
    window.addEventListener('focus',sync);window.addEventListener('blur',sync);sync();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();appearance.disconnect();media.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);window.removeEventListener('resize',sync);
      window.removeEventListener('focus',sync);window.removeEventListener('blur',sync);
      input.removeEventListener('pointerenter',look);input.removeEventListener('pointermove',look);input.removeEventListener('pointerleave',rest);input.removeEventListener('pointercancel',rest);input.removeEventListener('focus',focus);input.removeEventListener('blur',rest);};
  },[activity,size,paused,face,finish,accent]);
  return <canvas ref={canvas} role="img" tabIndex={face&&interactive?0:undefined} title="Pasá el mouse: Syka sigue tu mirada" aria-label={MASCOT_LABELS[activity]} style={{display:'block',width:size,height:size}}/>;
}
