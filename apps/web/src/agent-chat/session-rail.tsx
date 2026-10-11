import {createEffect,onMount,onCleanup} from 'solid-js';
import {createRoot} from '@/lib/react-root';import {createElement} from 'react';
import {SykaSessionRail} from '@/mirel-chat/features/agents/syka-session-rail';
import {chatState,openChat,transcriptOf} from './store';import {client} from './connection';
import type {Item} from '@diffusionstudio/agent-chat';
import {mainBridge} from '@/lib/ipc';
import {MAIN_CHANNELS} from '@desktop/main-channels';
export function SessionRail(props:{projectId:string;chatId:string|null;open:boolean;running:boolean;onClose:()=>void;onSelect:(id:string)=>void;onNew:()=>Promise<string|null>;onGuide:()=>void;onSkills:()=>void;onScheduled:()=>void}){
 let el!:HTMLDivElement;let root:ReturnType<typeof createRoot>;
 const chatWindowUrl=(id:string)=>{const url=new URL(window.location.href);url.hash=`${url.hash.split('?')[0]}?chat=${encodeURIComponent(id)}&chatWindow=1`;return url.href;};
 const messages=(items:Item[])=>items.filter((i):i is Extract<Item,{kind:'assistant'|'user'}>=>i.kind==='assistant'||i.kind==='user').map(i=>({id:i.id,role:i.kind,content:i.text,createdAt:new Date(0).toISOString()}));
 const exportChat=async(id:string)=>{const snapshot=await client.request('chats.open',{chatId:id});const text=messages(snapshot.items).map(m=>`${m.role==='user'?'Vos':'Codex'}\n${m.content}`).join('\n\n');const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`syka-chat-${id}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 onMount(()=>{root=createRoot(el);createEffect(()=>root.render(createElement(SykaSessionRail,{projectId:props.projectId,selectedId:props.chatId,open:props.open,running:props.running,threads:(chatState.lists[props.projectId]??[]).map(t=>({conversationId:t.id,title:t.title,updatedAt:new Date(t.updatedAt).toISOString(),status:'active' as const})),messages:messages(transcriptOf(props.chatId).items),onSelect:id=>{openChat(id);props.onSelect(id);},onClose:props.onClose,onNew:props.onNew,onGuide:props.onGuide,onSkills:props.onSkills,onScheduled:props.onScheduled,onExport:id=>void exportChat(id),onOpenWindow:id=>void mainBridge.call(MAIN_CHANNELS.APP_OPEN_CHAT_WINDOW,{url:chatWindowUrl(id)})})))});onCleanup(()=>root?.unmount());return <div class="syka-session-overlay t-panel-slide" data-open={props.open} inert={!props.open} ref={el}/>;
}
