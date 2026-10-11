import { createEffect, createSignal, onMount, onCleanup } from 'solid-js';
import { createRoot } from '@/lib/react-root';
import { createElement } from 'react';
import {AgentIdentityOrb} from '@/mirel-chat/features/agents/agent-identity-orb';
import { MessageBubble } from '@/mirel-chat/features/agents/syka-message-bubble';
import { AgentThinkingTrace, AgentToolChipsTrace } from '@/mirel-chat/features/agents/agent-thinking-trace';
import type { AgentFeedbackVerdict,AgentThreadMessage } from '@/mirel-chat/features/agents/syka-contracts';
import type { Item } from '@diffusionstudio/agent-chat';
import {createContext,useContext} from 'solid-js';
import { SYKA_ORB_STATE } from '@/lib/syka-brand';
import {AgentUserText} from '@/mirel-chat/features/agents/agent-rich-text';
import {withoutDuplicateImageLinks} from './image-message-presentation';

let messageView = MessageBubble;
const messageUpdates: Set<(view: typeof MessageBubble) => void> | undefined = import.meta.hot
 ? (import.meta.hot.data.messageUpdates ??= new Set()) : undefined;
if (import.meta.hot) import.meta.hot.accept('../mirel-chat/features/agents/syka-message-bubble.tsx', module => {
 if (!module) return;
 messageView = module.MessageBubble;
 messageUpdates?.forEach(update => update(messageView));
});

export function MirelUserText(props:{text:string}) {
 let element!:HTMLDivElement;let root:ReturnType<typeof createRoot>;
 onMount(()=>{root=createRoot(element);createEffect(()=>root.render(createElement(AgentUserText,{body:props.text})));});
 onCleanup(()=>root?.unmount());return <div ref={element} class="syka-mirel-visuals syka-user-text"/>;
}

export const ChatActionsContext=createContext<{chatKey:()=>string;running:()=>boolean;lastAssistantId:()=>string|undefined;isActiveItem:(id:string)=>boolean;imageDownloadPaths?:(id:string)=>string[];onBranch:(itemId:string)=>void;onDraft:(text:string)=>void}>();
const agent={key:'codex',name:'Syka',orbState:SYKA_ORB_STATE,accent:'#a6b4c2'};
export function MirelMessage(props:{item:Extract<Item,{kind:'assistant'}>}){
 const actions=useContext(ChatActionsContext);let el!:HTMLDivElement;let root:ReturnType<typeof createRoot>;
 const [view,setView]=createSignal(messageView);
 const updateView=(next:typeof MessageBubble)=>setView(()=>next);
 messageUpdates?.add(updateView);onCleanup(()=>messageUpdates?.delete(updateView));
 const storageKey=()=>`syka:feedback:v1:${actions?.chatKey()??'unknown'}:${props.item.id}`;
 const [feedback,setFeedback]=createSignal<AgentThreadMessage['feedback']>();
 createEffect(()=>{const key=storageKey();try{setFeedback(JSON.parse(localStorage.getItem(key)??'null')??undefined);}catch{setFeedback(undefined);}});
 onMount(()=>{root=createRoot(el);createEffect(()=>{
   const message:AgentThreadMessage={id:props.item.id,role:'assistant',content:props.item.text,createdAt:new Date(0).toISOString(),feedback:feedback()};
   root.render(createElement(view(),{sectionId:'syka-message-'+props.item.id,agent,message,renderBody:withoutDuplicateImageLinks(props.item.text,actions?.imageDownloadPaths?.(props.item.id)??[]),previousMessage:undefined,hideIdentityOrb:true,sending:!!actions?.running()&&actions.lastAssistantId()===props.item.id&&actions.isActiveItem(props.item.id),reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches,onCommand:(text:string)=>actions?.onDraft(text),
   onBranch:()=>actions?.onBranch(props.item.id),onFeedback:async(_:string,verdict:AgentFeedbackVerdict|null,comment:string|null)=>{const next=verdict?{verdict,comment}:undefined;localStorage.setItem(storageKey(),JSON.stringify(next??null));setFeedback(next);}}));
 });});onCleanup(()=>root?.unmount());
 return <div ref={el} class="syka-mirel-visuals" data-chat-message="assistant"/>;
}
export function MirelTrace(props:{item:Extract<Item,{kind:'tool'|'reasoning'}>}){
 const actions=useContext(ChatActionsContext);let el!:HTMLDivElement;let root:ReturnType<typeof createRoot>;
 onMount(()=>{root=createRoot(el);createEffect(()=>{const item=props.item;const activity={id:item.id,kind:item.kind==='tool'?'tool' as const:'status' as const,state:item.kind==='tool'?(item.status==='running'?'started' as const:item.status==='failed'?'failed' as const:'completed' as const):(actions?.running()&&(item.id==='current-thinking'||actions.isActiveItem(item.id))?'progress' as const:'completed' as const),label:item.kind==='tool'?item.title:'Pensando',summary:item.kind==='tool'?item.detail:item.text};root.render(item.kind==='tool'?createElement(AgentToolChipsTrace,{activities:[activity]}):createElement(AgentThinkingTrace,{activities:[activity],variant:'reasoning'}));});});onCleanup(()=>root?.unmount());return <div class="syka-mirel-visuals" ref={el}/>;
}
export function SykaChatOrb(props:{working:boolean;variant?:'header'|'hero';paused?:boolean}) {
 let element!:HTMLSpanElement;let root:ReturnType<typeof createRoot>;
 onMount(()=>{root=createRoot(element);createEffect(()=>root.render(createElement(AgentIdentityOrb,{agent,variant:props.variant??'header',working:props.working,paused:props.paused})));});
 onCleanup(()=>root?.unmount());return <span class="syka-header-orb" ref={element}/>;
}
