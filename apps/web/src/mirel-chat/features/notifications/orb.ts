import {drawSykaMascot,type MascotActivity,type MascotPointer} from '@/lib/syka-mascot';

type Actor={activity:MascotActivity;pointer:MascotPointer;accent:string;visible:boolean};
const canvases=new Map<HTMLCanvasElement,Actor>();
let frame=0,last=0,painted=0,time=.6;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const staticMotion=()=>reduced.matches||(document.documentElement.dataset.motion==='reduced'||document.documentElement.dataset.sykaMotion==='reduced');
const visible=()=>[...canvases.values()].some(actor=>actor.visible);
function paint(canvas:HTMLCanvasElement){
  const actor=canvases.get(canvas);if(!actor)return;
  const size=canvas.clientWidth||61,ratio=Math.max(2,Math.min(3,devicePixelRatio||1));
  const px=Math.ceil(size*ratio);
  if(canvas.width!==px)canvas.width=canvas.height=px;
  const context=canvas.getContext('2d');if(!context)return;
  context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,px,px);
  drawSykaMascot(context,px,time,actor.activity,true,staticMotion(),true,'accent',actor.accent,actor.pointer);
}
function tick(now:number){
  frame=0;
  if(document.hidden||staticMotion()||!visible()){last=0;return;}
  if(last)time+=Math.min(.1,(now-last)/1000);last=now;
  if(now-painted>=1000/24){for(const [canvas,actor]of canvases)if(actor.visible)paint(canvas);painted=now;}
  frame=requestAnimationFrame(tick);
}
export function wakeOrbs(){if(!frame&&!document.hidden&&!staticMotion()&&visible())frame=requestAnimationFrame(tick);}
function visibility(){
  cancelAnimationFrame(frame);frame=0;last=0;
  if(!document.hidden)for(const canvas of canvases.keys())paint(canvas);
  wakeOrbs();
}
const appearance=new MutationObserver(()=>{
  for(const [canvas,actor]of canvases)actor.accent=getComputedStyle(canvas).getPropertyValue('--primary').trim();
  visibility();
});
export function attachOrb(canvas:HTMLCanvasElement,activity:MascotActivity='notification'){
  const first=!canvases.size;
  const actor:Actor={activity,pointer:null,accent:getComputedStyle(canvas).getPropertyValue('--primary').trim(),visible:true};
  canvases.set(canvas,actor);paint(canvas);wakeOrbs();
  const resize=new ResizeObserver(()=>paint(canvas));resize.observe(canvas);
  const intersection=new IntersectionObserver(([entry])=>{actor.visible=entry.isIntersecting;visibility();});intersection.observe(canvas);
  const input:HTMLElement=canvas.closest('button')??canvas;
  const look=(event:PointerEvent)=>{
    if(event.pointerType==='touch'||staticMotion())return;
    const rect=canvas.getBoundingClientRect();
    actor.pointer={x:(event.clientX-rect.left)/rect.width*2-1,y:(event.clientY-rect.top)/rect.height*2-1};if(!frame)paint(canvas);
  };
  const rest=()=>{actor.pointer=null;paint(canvas);};
  const focus=()=>{actor.pointer={x:0,y:0};paint(canvas);};
  input.addEventListener('pointerenter',look);input.addEventListener('pointermove',look);
  input.addEventListener('pointerleave',rest);input.addEventListener('pointercancel',rest);
  input.addEventListener('focus',focus);input.addEventListener('blur',rest);
  if(first){
    document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',visibility);
    appearance.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-motion','data-syka-motion']});
  }
  return ()=>{
    resize.disconnect();intersection.disconnect();canvases.delete(canvas);
    input.removeEventListener('pointerenter',look);input.removeEventListener('pointermove',look);
    input.removeEventListener('pointerleave',rest);input.removeEventListener('pointercancel',rest);
    input.removeEventListener('focus',focus);input.removeEventListener('blur',rest);
    if(!canvases.size){
      cancelAnimationFrame(frame);frame=0;last=0;appearance.disconnect();
      document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',visibility);
    }
  };
}
