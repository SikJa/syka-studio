import { createSignal } from 'solid-js';
import { setSidebarTab } from './store';

// Move the existing chat view into the fullscreen subtree. The host, draft and
// React composer stay alive; fullscreen never creates a second conversation.
export const [fullscreenChatMount, setFullscreenChatMount] = createSignal<HTMLElement | null>(null);
export const [floatingChatMount, setFloatingChatMount] = createSignal<HTMLElement | null>(null);
export const [chatDockReady, setChatDockReady] = createSignal(false);
const FLOATING_KEY='syka:chat-floating:v1';
export const [chatFloating, updateFloating] = createSignal(localStorage.getItem(FLOATING_KEY)==='true');

let transition: Animation | undefined;
let transitionFrame: number | undefined;
let finishTransition: (()=>void) | undefined;

/** A noninteractive visual bridge escapes sidebar clipping during the FLIP.
 * The actual chat/composer remains mounted and keeps its draft and session. */
export function setChatFloating(next: boolean) {
  if(next===chatFloating()||fullscreenChatMount())return;
  setChatDockReady(false);
  if(transitionFrame!==undefined)cancelAnimationFrame(transitionFrame);
  transition?.cancel();finishTransition?.();
  const previous=document.querySelector<HTMLElement>('.syka-agent-chat:not([data-chat-transition-clone])');
  const before=previous?.getBoundingClientRect();
  const preview=previous&&before&&!matchMedia('(prefers-reduced-motion: reduce)').matches?previous.cloneNode(true) as HTMLElement:null;
  if(preview&&before){
    preview.dataset.chatTransitionClone='true';preview.inert=true;preview.setAttribute('aria-hidden','true');
    preview.removeAttribute('id');
    preview.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
    Object.assign(preview.style,{position:'fixed',left:before.x+'px',top:before.y+'px',width:before.width+'px',height:before.height+'px',margin:'0',zIndex:'120',pointerEvents:'none',transformOrigin:'top left',background:getComputedStyle(previous!).backgroundColor});
    document.body.append(preview);
  }
  if(next){updateFloating(true);setSidebarTab('assets');}else{setSidebarTab('chat');updateFloating(false);}
  localStorage.setItem(FLOATING_KEY,String(next));
  if(!preview||!before)return;
  let animatedChat:HTMLElement|undefined,visibility='',finished=false;
  const finish=()=>{
    if(finished)return;finished=true;
    preview.remove();if(animatedChat)animatedChat.style.visibility=visibility;
    if(finishTransition===finish){finishTransition=undefined;transition=undefined;transitionFrame=undefined;}
  };
  finishTransition=finish;
  transitionFrame=requestAnimationFrame(()=>{
    transitionFrame=undefined;
    const chat=document.querySelector<HTMLElement>('.syka-agent-chat:not([data-chat-transition-clone])');
    if(!chat){finish();return;}
    const after=chat.getBoundingClientRect();if(!after.width||!after.height){finish();return;}
    animatedChat=chat;visibility=chat.style.visibility;chat.style.visibility='hidden';
    transition=preview.animate([{transform:'none',borderRadius:'18px',boxShadow:'0 16px 56px #0005'},{transform:`translate(${after.left-before.left}px,${after.top-before.top}px) scale(${after.width/before.width},${after.height/before.height})`,borderRadius:next?'19px':'16px',boxShadow:next?'0 24px 72px #0008':'0 0 0 #0000'}],{
      duration:520,easing:'cubic-bezier(0.22,1,0.36,1)',fill:'forwards',
    });
    transition.onfinish=finish;transition.oncancel=finish;
  });
}
