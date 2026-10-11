/** @jsxImportSource react */
import {useEffect, useRef, useState} from 'react';
import {MODE_DRAWS, resolvePreset, type OrbState, type OrbSize} from 'thinking-orbs/engine';

/** Keep the tuned geometry, but rasterize at the actual CSS size, including HiDPI. */
export function AgentOrbCanvas({state, preset, theme, speed, paused}: {
  state:OrbState; preset:OrbSize; theme:'dark'|'light'|'auto'; speed:number; paused:boolean;
}) {
  const canvas=useRef<HTMLCanvasElement>(null),lastTime=useRef(.6);
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)'),sync=()=>setReduced(media.matches);
    media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);
  },[]);
  useEffect(()=>{
    const element=canvas.current,context=element?.getContext('2d');if(!element||!context)return;
    const resolved=resolvePreset(state,preset),draw=MODE_DRAWS[resolved.mode];
    let cssSize=preset as number,ratio=2,frame=0,visible=true,lastDraw=0;
    const dark=theme==='dark'||(theme==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);
    const paint=(time:number)=>{
      lastTime.current=time;
      context.setTransform(ratio*cssSize/preset,0,0,ratio*cssSize/preset,0,0);
      context.clearRect(0,0,preset,preset);draw(context,preset,time,dark,resolved.opts);
    };
    const resize=()=>{
      // clientWidth is unaffected by the notification's animated scale.
      cssSize=element.clientWidth||preset;
      ratio=Math.max(2,Math.min(3,window.devicePixelRatio||1));
      element.width=Math.ceil(cssSize*ratio);element.height=element.width;
      element.dataset.renderPixels=String(element.width);element.dataset.cssSize=String(cssSize);
      paint(reduced?.6:lastTime.current);
    };
    const tick=(now:number)=>{
      frame=0;if(paused||reduced||!visible||document.visibilityState==='hidden')return;
      if(now-lastDraw>=1000/30){paint(now/1000*resolved.speed*speed);lastDraw=now;}
      frame=requestAnimationFrame(tick);
    };
    const sync=()=>{cancelAnimationFrame(frame);frame=0;if(!paused&&!reduced&&visible&&document.visibilityState!=='hidden')frame=requestAnimationFrame(tick);};
    resize();const observer=new ResizeObserver(resize);observer.observe(element);
    const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();},{rootMargin:'80px'});visibility.observe(element);
    document.addEventListener('visibilitychange',sync);window.addEventListener('resize',resize);sync();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();document.removeEventListener('visibilitychange',sync);window.removeEventListener('resize',resize);};
  },[state,preset,theme,speed,paused,reduced]);
  return <canvas ref={canvas} aria-hidden="true" style={{width:preset,height:preset,display:'block'}}/>;
}
