import { createSignal, onCleanup, onMount } from 'solid-js';
import { sidebarTab, chatSidebarWidth, setChatSidebarWidth, CHAT_SIDEBAR_WIDTH } from './store';
import './floating-chat.css';
export function ChatWidthHandle(){
  const [active,setActive]=createSignal(false);
  let gesture:{id:number;x:number;width:number}|undefined;
  onMount(()=>{const resize=()=>setChatSidebarWidth(chatSidebarWidth());resize();window.addEventListener('resize',resize);onCleanup(()=>window.removeEventListener('resize',resize));});
  const end=()=>{gesture=undefined;setActive(false);document.documentElement.removeAttribute('data-chat-resizing');};
  onCleanup(end);
  return <div class="bg-border-strong relative"><div class="syka-chat-width-handle" role="separator" aria-label="Ancho del chat" aria-orientation="vertical" aria-valuemin={280} aria-valuemax={Math.min(800,Math.max(280,innerWidth-550))} aria-valuenow={chatSidebarWidth()} tabIndex={sidebarTab()==='chat'?0:-1} hidden={sidebarTab()!=='chat'} data-active={active()}
    onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();gesture={id:event.pointerId,x:event.clientX,width:chatSidebarWidth()};event.currentTarget.setPointerCapture(event.pointerId);setActive(true);document.documentElement.dataset.chatResizing='true';}}
    onPointerMove={event=>{if(gesture?.id===event.pointerId)setChatSidebarWidth(gesture.width+event.clientX-gesture.x)}}
    onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
    onDblClick={()=>setChatSidebarWidth(CHAT_SIDEBAR_WIDTH)}
    onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();setChatSidebarWidth(event.key==='Home'?280:event.key==='End'?800:chatSidebarWidth()+(event.key==='ArrowRight'?20:-20));}}/>
  </div>;
}
