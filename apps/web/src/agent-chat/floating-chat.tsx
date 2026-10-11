import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { chatDockReady, setChatDockReady, chatFloating, fullscreenChatMount, setChatFloating, setFloatingChatMount } from './chat-presentation';
import './floating-chat.css';

type Geometry={x:number;y:number;width:number;height:number};
const KEY='syka:chat-window-geometry:v1';
function bounded(value:Geometry):Geometry{
  const width=Math.min(Math.max(320,value.width),Math.max(200,innerWidth-24));
  const height=Math.min(Math.max(320,value.height),Math.max(200,innerHeight-72));
  return {width,height,x:Math.min(Math.max(12,value.x),Math.max(12,innerWidth-width-12)),y:Math.min(Math.max(44,value.y),Math.max(44,innerHeight-height-12))};
}
function initial():Geometry{
  try{const value=JSON.parse(localStorage.getItem(KEY)??'null');if(value&&['x','y','width','height'].every(key=>Number.isFinite(value[key])))return bounded(value);}catch{}
  return bounded({x:Math.max(320,innerWidth*.31),y:64,width:390,height:Math.min(590,innerHeight-96)});
}

export function FloatingChat(){
  let mount!:HTMLDivElement;
  const [geometry,setGeometry]=createSignal(initial());
  const [dragging,setDragging]=createSignal(false);
  let gesture:{id:number;x:number;y:number;initial:Geometry;resize:boolean}|null=null;
  const save=()=>localStorage.setItem(KEY,JSON.stringify(geometry()));
  const start=(event:PointerEvent)=>{
    if(event.button!==0)return;
    const target=event.target as HTMLElement;
    const resize=!!target.closest('[data-chat-resize]');
    if(!resize&&(!target.closest('[data-chat-drag-handle]')||target.closest('button,a,input,textarea,[role="button"]')))return;
    event.preventDefault();gesture={id:event.pointerId,x:event.clientX,y:event.clientY,initial:geometry(),resize};
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);setDragging(true);
  };
  const move=(event:PointerEvent)=>{
    if(!gesture||event.pointerId!==gesture.id)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y,g=gesture.initial;
    setGeometry(bounded(gesture.resize?{...g,width:g.width+dx,height:g.height+dy}:{...g,x:g.x+dx,y:g.y+dy}));
    setChatDockReady(!gesture.resize&&Math.hypot(dx,dy)>6&&event.clientX<80);
  };
  const end=(event:PointerEvent)=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    const dock=event.type==='pointerup'&&chatDockReady();gesture=null;setDragging(false);setChatDockReady(false);save();
    if(dock)setChatFloating(false);
  };
  createEffect(()=>{if(!chatFloating()||fullscreenChatMount()){gesture=null;setDragging(false);setChatDockReady(false);}});
  onMount(()=>{
    setFloatingChatMount(mount);
    const resized=()=>{setGeometry(bounded(geometry()));save();};window.addEventListener('resize',resized);
    onCleanup(()=>{window.removeEventListener('resize',resized);setChatDockReady(false);setFloatingChatMount(null);});
  });
  return <Portal><div class="syka-floating-chat t-resize" role="region" aria-label="Chat flotante de Syka" hidden={!chatFloating()||!!fullscreenChatMount()} data-dragging={dragging()}
    style={{left:geometry().x+'px',top:geometry().y+'px',width:geometry().width+'px',height:geometry().height+'px'}}
    on:pointerdown={start} on:pointermove={move} on:pointerup={end} on:pointercancel={end} on:lostpointercapture={end}>
    <div ref={mount} class="syka-floating-chat-mount"/>
    <button class="syka-chat-resize" data-chat-resize aria-label="Cambiar tamaño del chat" title="Arrastrá para cambiar el tamaño" onKeyDown={event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();
      const g=geometry();setGeometry(bounded({...g,width:g.width+(event.key==='ArrowRight'?20:event.key==='ArrowLeft'?-20:0),height:g.height+(event.key==='ArrowDown'?20:event.key==='ArrowUp'?-20:0)}));save();
    }}><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round"><path d="m5 12 7-7m-3 7 3-3"/></svg></button>
  </div></Portal>;
}
