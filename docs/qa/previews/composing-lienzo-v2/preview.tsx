/** @jsxImportSource react */
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowRight,Check,Plus,RotateCcw,Volume2,VolumeX} from 'lucide-react';
import {AgentIdentityOrb} from '../../../../apps/web/src/mirel-chat/features/agents/agent-identity-orb';
import {AgentComposer,type AgentComposerAttachment} from '../../../../apps/web/src/mirel-chat/features/agents/agent-composer';
import {SYKA_ORB_STATE} from '../../../../apps/web/src/lib/syka-brand';
import {unlockNoticeAudio,playNotice,noticeAudioStatus} from './notice-audio';
import '../../../../apps/web/src/agent-chat/mirel-adapter.css';
import './preview.css';

const agent={key:'syka',name:'Syka',orbState:SYKA_ORB_STATE,accent:'#a6b4c2'};
const directions=[{id:'poetic',label:'Poético',prompt:'Poético y abstracto.'},{id:'visual',label:'Explicativo',prompt:'Explicativo y visual.'},{id:'delegate',label:'Elegí vos',prompt:'Elegí vos la dirección creativa.'}];
const clipMode=new URLSearchParams(location.search).get('mode')==='clip';

function App(){
 const [phase,setPhase]=useState<'thinking'|'question'|'leaving'|'chat'>('thinking');
 const [cycle,setCycle]=useState(0),[draft,setDraft]=useState(''),[choice,setChoice]=useState(''),[sent,setSent]=useState('');
 const [attachments,setAttachments]=useState<AgentComposerAttachment[]>([]);
 const [sentAttachments,setSentAttachments]=useState<AgentComposerAttachment[]>([]);
 const [general,setGeneral]=useState(''),[dragging,setDragging]=useState(false);
 const [soundOn,setSoundOn]=useState(true);
 const [audioCues,setAudioCues]=useState(0);
 const [reduced,setReduced]=useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
 const dialog=useRef<HTMLDivElement>(null),chat=useRef<HTMLDivElement>(null);
 const urls=useRef(new Set<string>()),previousSuggestion=useRef('');
 const pending=phase!=='chat',open=phase==='question';
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>{
  for(const url of urls.current)URL.revokeObjectURL(url);urls.current.clear();
  setPhase('thinking');setDraft('');setChoice('');setSent('');setAttachments([]);setSentAttachments([]);previousSuggestion.current='';
  const timer=setTimeout(()=>setPhase('question'),reduced?100:1100);return()=>clearTimeout(timer);
 },[cycle,reduced]);
 useEffect(()=>{if(open){dialog.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({preventScroll:true});if(soundOn&&playNotice())setAudioCues(count=>count+1);}},[open]);
 useEffect(()=>{
  if(phase!=='leaving')return;const duration=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--modal-close-dur'))||220;const timer=setTimeout(()=>setPhase('chat'),reduced?0:duration);return()=>clearTimeout(timer);
 },[phase,reduced]);
 useEffect(()=>{if(phase==='chat')chat.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({preventScroll:true});},[phase]);
 useEffect(()=>{
  const trap=(event:KeyboardEvent)=>{
   if(!open||event.key!=='Tab'||event.defaultPrevented)return;
   // The shared image lightbox owns its own focus trap and Escape handler.
   if(document.activeElement?.closest('.agent-image-lightbox-backdrop'))return;
   const nodes=[...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),a[href]')??[])].filter(node=>node.tabIndex>=0&&node.getClientRects().length);
   const first=nodes[0],last=nodes.at(-1);if(!first||!last)return;
   if(event.shiftKey&&(document.activeElement===first||!dialog.current?.contains(document.activeElement))){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!dialog.current?.contains(document.activeElement))){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',trap);return()=>document.removeEventListener('keydown',trap);
 },[open]);
 useEffect(()=>()=>{for(const url of urls.current)URL.revokeObjectURL(url);},[]);
 useEffect(()=>{(window as any).sykaLienzo={phase,pending,draft,choice,attachmentCount:attachments.length,sent,sentAttachmentCount:sentAttachments.length,reduced,soundOn,audio:noticeAudioStatus(),composer:'AgentComposer shared source',dictation:'Native DictationControl; desktop connection required'};},[phase,pending,draft,choice,attachments,sent,sentAttachments,reduced,soundOn]);
 const replay=()=>{void unlockNoticeAudio();setCycle(value=>value+1);};
 const toggleSound=()=>{if(!soundOn)void unlockNoticeAudio().then(ready=>{if(ready&&playNotice())setAudioCues(count=>count+1);});setSoundOn(value=>!value);};
 const addFiles=(files:File[])=>{
  const entries=files.map(file=>{const url=URL.createObjectURL(file);urls.current.add(url);return{id:crypto.randomUUID(),name:file.name,mimeType:file.type||'application/octet-stream',size:file.size,previewUrl:file.type.startsWith('image/')?url:undefined,state:'available' as const};});
  setAttachments(existing=>[...existing,...entries]);
 };
 const choose=(item:typeof directions[number])=>{
  const previous=previousSuggestion.current;setChoice(item.id);
  setDraft(existing=>!existing.trim()||existing===previous?item.prompt:previous&&existing.startsWith(previous)?item.prompt+existing.slice(previous.length):item.prompt+'\n'+existing);
  previousSuggestion.current=item.prompt;requestAnimationFrame(()=>dialog.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus());
 };
 const submit=(value:string)=>{if(!open||(!value.trim()&&!attachments.length))return;setSent(value.trim());setSentAttachments(attachments);setPhase('leaving');};
 const paste=(event:React.ClipboardEvent)=>{if(!open)return;const files=Array.from(event.clipboardData.files);if(files.length){event.preventDefault();addFiles(files);}};
 return <div className={`preview-app ${clipMode?'clip-mode':''}`} data-audio-cues={audioCues} data-audio-state={noticeAudioStatus().state}>
  <header className="lab-header"><span className="brand">syka.</span><span>LIENZO · REVISIÓN 03</span><a href="http://127.0.0.1:5331/?v=4">Ver anterior <ArrowRight size={12}/></a></header>
  <main className="lab-main">
   <div className="demo-column"><div className="demo-toolbar"><span>04 / Lienzo <small>v3</small></span><div className="preview-controls"><button type="button" aria-label="Sonido del aviso" aria-pressed={soundOn} onClick={toggleSound}>{soundOn?<Volume2 size={13}/>:<VolumeX size={13}/>} Sonido</button><button type="button" onClick={replay}><RotateCcw size={13}/> Repetir</button></div></div>
    <section className="chat" data-phase={phase} aria-label="Chat Syka · Lienzo">
     <div ref={chat} className="chat-background" inert={pending} aria-hidden={pending?true:undefined}>
      <div className="chat-header"><AgentIdentityOrb agent={agent} variant="header" paused={reduced}/><strong>Syka</strong><span>Una idea, una pieza</span><button type="button" disabled={pending} aria-label="Nueva conversación"><Plus size={16}/></button></div>
      <div className="chat-history"><div className="user-message">Haceme una animación sobre el alma y el Big Bang. Que la música tenga mucho peso.</div>{!pending&&<><div className="user-message">{sent||'Referencia visual adjunta'}{sentAttachments.length>0&&<div className="sent-reference">{sentAttachments.map(item=>item.previewUrl?<img key={item.id} src={item.previewUrl} alt={item.name}/>:<span key={item.id}>{item.name}</span>)}</div>}</div><div className="assistant-message">Tomo esa dirección y las referencias para armar el prompt completo.<small>Continuación simulada · sin llamada a un modelo</small></div></>}</div>
      <div className="general-composer syka-mirel-composer"><AgentComposer value={general} onChange={setGeneral} onSubmit={()=>{}} placeholder="Pedile algo a Syka…" ariaLabel="Mensaje general" disabled={pending} dictationContext="lienzo-preview-general" maxRows={3} modelFallbackLabel="Modelo del chat"/></div>
     </div>
     {pending&&<div className={`question-layer ${dragging?'is-dragging':''}`} onPaste={paste} onDragOver={event=>{if(open&&event.dataTransfer.types.includes('Files')){event.preventDefault();setDragging(true);}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDragging(false);}} onDrop={event=>{event.preventDefault();setDragging(false);if(open)addFiles(Array.from(event.dataTransfer.files));}}>
      <div ref={dialog} className="question-dialog" role="dialog" aria-modal="true" aria-labelledby="question-title" aria-hidden={!open} inert={!open}>
       <div className="question-focus"><div className="question-hero"><div className="orb-mover"><AgentIdentityOrb agent={agent} variant="hero" working={phase==='thinking'} paused={reduced}/><span className="t-badge" data-open={open?'true':'false'}><span className="t-badge-dot">1</span></span></div></div>
       <div className={`question-body t-stagger ${open?'is-shown':''} ${phase==='leaving'?'is-hiding':''}`}><h2 className="t-stagger-line t-stagger-line--1" id="question-title">¿Cómo querés<br/>contar esta idea?</h2><div className="quick-replies t-stagger-line t-stagger-line--2" role="group" aria-label="Respuestas rápidas">{directions.map(item=><button key={item.id} className="quick-reply" data-direction={item.id} type="button" aria-pressed={choice===item.id} onClick={()=>choose(item)}><span className="reply-name">{item.label}</span>{choice===item.id?<span className="reply-selected" aria-hidden="true"><Check size={11}/></span>:null}</button>)}</div></div></div>
       <div className={`question-composer syka-mirel-composer t-modal ${open?'is-open':''} ${phase==='leaving'?'is-closing':''}`}><AgentComposer value={draft} onChange={setDraft} onSubmit={submit} placeholder="Escribí tu respuesta o sumá una referencia…" ariaLabel="Tu respuesta" submitLabel="Enviar respuesta" disabled={!open} attachments={attachments} onFiles={addFiles} onRemoveAttachment={id=>setAttachments(existing=>existing.filter(item=>item.id!==id))} dictationContext="lienzo-preview-answer" maxRows={3} accept="*" modelFallbackLabel="Modelo del chat"/></div>
      </div>
      {dragging&&<div className="drop-hint">Soltá tu referencia</div>}
     </div>}
    </section><div className="demo-caption">Elegir prepara la respuesta. Enviar continúa el chat.</div>
   </div>
  </main><footer className="lab-footer">SYKA STUDIO · PREVIEW INTERACTIVA · 08.10.2026</footer>
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
