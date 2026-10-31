import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { boundChat, resizeChat, isChatDockPoint, type ChatGeometry, type ResizeEdge } from './chat-window-geometry';
import { Portal } from 'solid-js/web';
import { chatDockReady, setChatDockReady, chatFloating, fullscreenChatMount, setChatFloating, setFloatingChatMount } from './chat-presentation';
import './floating-chat.css';

type Geometry=ChatGeometry;
const KEY='syka:chat-window-geometry:v1';
function bounded(value:Geometry):Geometry{
  return boundChat(value,{width:innerWidth,height:innerHeight});
}
function initial():Geometry{
  try{const value=JSON.parse(localStorage.getItem(KEY)??'null');if(value&&['x','y','width','height'].every(key=>Number.isFinite(value[key])))return bounded(value);}catch{}
  return bounded({x:Math.max(320,innerWidth*.31),y:64,width:390,height:Math.min(590,innerHeight-96)});
}

export function FloatingChat(){
  let mount!:HTMLDivElement;
  const [geometry,setGeometry]=createSignal(initial());
  const [dragging,setDragging]=createSignal(false);
  let gesture:{id:number;x:number;y:number;initial:Geometry;resize:ResizeEdge|undefined}|null=null;
  const save=()=>localStorage.setItem(KEY,JSON.stringify(geometry()));
  const start=(event:PointerEvent)=>{
    if(event.button!==0)return;
    const target=event.target as HTMLElement;
    const resize=target.closest<HTMLElement>('[data-chat-resize]')?.dataset.chatResize as ResizeEdge|undefined;
    if(!resize&&(!target.closest('[data-chat-drag-handle]')||target.closest('button,a,input,textarea,[role="button"]')))return;
    event.preventDefault();gesture={id:event.pointerId,x:event.clientX,y:event.clientY,initial:geometry(),resize};
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);setDragging(true);
  };
  const move=(event:PointerEvent)=>{
    if(!gesture||event.pointerId!==gesture.id)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y,g=gesture.initial;
    setGeometry(gesture.resize?resizeChat(g,gesture.resize,dx,dy,{width:innerWidth,height:innerHeight}):bounded({...g,x:g.x+dx,y:g.y+dy}));
    setChatDockReady(!gesture.resize&&Math.hypot(dx,dy)>6&&isChatDockPoint(event.clientX,event.clientY,document.querySelector('[data-chat-dock]')?.getBoundingClientRect()));
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
    <For each={['n','s','e','w','ne','nw','se','sw'] as ResizeEdge[]}>{edge=><button class="syka-chat-resize" data-chat-resize={edge} aria-label={'Cambiar tamaño del chat · '+({n:'arriba',s:'abajo',e:'derecha',w:'izquierda',ne:'arriba derecha',nw:'arriba izquierda',se:'abajo derecha',sw:'abajo izquierda'})[edge]} onKeyDown={event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();
      setGeometry(resizeChat(geometry(),edge,event.key==='ArrowRight'?20:event.key==='ArrowLeft'?-20:0,event.key==='ArrowDown'?20:event.key==='ArrowUp'?-20:0,{width:innerWidth,height:innerHeight}));save();
    }}><Show when={edge==='se'}><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round"><path d="m5 12 7-7m-3 7 3-3"/></svg></Show></button>}</For>
  </div></Portal>;
}
