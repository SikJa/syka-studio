/** @jsxImportSource react */
import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Check, Feather, Frame, Plus, RotateCcw, Sparkles, Volume2, VolumeX} from 'lucide-react';
import {Button as LabButton} from 'F:/Coding Proyects/Recursos frontend para sistemas/labs/component-lab/src/components/base/buttons/button';
import {AgentIdentityOrb} from '../../../../apps/web/src/mirel-chat/features/agents/agent-identity-orb';
import {AgentComposer, type AgentComposerAttachment} from '../../../../apps/web/src/mirel-chat/features/agents/agent-composer';
import {SYKA_ORB_STATE} from '../../../../apps/web/src/lib/syka-brand';
import {unlockNoticeAudio, playNotice, noticeAudioStatus} from '../composing-lienzo-v2/notice-audio';
import '../../../../apps/web/src/agent-chat/mirel-adapter.css';
import './preview.css';

const agent = {key:'syka', name:'Syka', orbState:SYKA_ORB_STATE, accent:'#a6b4c2'};
const directions = [
  {id:'poetic', label:'Poético', prompt:'Poético y abstracto.', icon:Feather},
  {id:'visual', label:'Explicativo', prompt:'Explicativo y visual.', icon:Frame},
  {id:'delegate', label:'Elegí vos', prompt:'Elegí vos la dirección creativa.', icon:Sparkles},
];
type Phase = 'idle' | 'arriving' | 'question' | 'leaving' | 'chat';

// Bundled CSS can normalize 340ms to .34s. Read either unit correctly.
function motionMs(token:string,fallback:number) {
  const value=getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const number=parseFloat(value);
  return Number.isFinite(number)?number*(value.endsWith('ms')?1:value.endsWith('s')?1000:1):fallback;
}

function App() {
  // Start in the resting layout: the user asked to judge the design first.
  const [phase,setPhase] = useState<Phase>('question');
  const [draft,setDraft] = useState(''), [choice,setChoice] = useState(''), [sent,setSent] = useState('');
  const [attachments,setAttachments] = useState<AgentComposerAttachment[]>([]);
  const [sound,setSound] = useState(true), [cues,setCues] = useState(0), [busy,setBusy] = useState(false);
  const [reduced,setReduced] = useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const responseArea = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]), urls = useRef(new Set<string>()), previous = useRef('');
  const pending = phase !== 'chat', revealed = phase === 'question';
  const later = (callback:()=>void,delay:number) => timers.current.push(setTimeout(callback,delay));
  const clearPlayback = () => {timers.current.forEach(clearTimeout);timers.current=[];};
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)'), change=()=>setReduced(media.matches);
    media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
  },[]);
  useEffect(()=>()=>{clearPlayback();urls.current.forEach(URL.revokeObjectURL);},[]);
  useEffect(()=>{
    if(!pending)return;
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=='Tab'||!revealed||document.activeElement?.closest('.agent-image-lightbox-backdrop'))return;
      const nodes=[...(responseArea.current?.querySelectorAll<HTMLElement>('.quick-options button, .composer-dock button:not(:disabled), .composer-dock textarea')??[])].filter(node=>node.tabIndex>=0&&node.getClientRects().length);
      const first=nodes[0],last=nodes.at(-1);if(!first||!last)return;
      if(event.shiftKey&&(document.activeElement===first||!responseArea.current?.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',trap);return()=>document.removeEventListener('keydown',trap);
  },[pending,revealed]);

  const replay=async()=>{
    const audioReady=sound?await unlockNoticeAudio():false;
    clearPlayback();setBusy(true);setPhase('idle');
    if(reduced){if(audioReady&&playNotice())setCues(count=>count+1);setPhase('question');setBusy(false);return;}
    later(()=>{
      setPhase('arriving');
      const textDelay=motionMs('--notice-text-delay',80);
      later(()=>{if(audioReady&&playNotice())setCues(count=>count+1);setPhase('question');},textDelay);
      const settle=Math.max(motionMs('--modal-open-dur',340),textDelay+motionMs('--stagger-dur',280)+motionMs('--stagger-stagger',45));
      later(()=>setBusy(false),settle+30);
    },motionMs('--notice-lead-in',90));
  };
  const choose=(item:typeof directions[number])=>{
    if(!revealed)return;
    setChoice(item.id);setDraft(value=>!value.trim()||value===previous.current?item.prompt:previous.current&&value.startsWith(previous.current)?item.prompt+value.slice(previous.current.length):item.prompt+'\n'+value);
    previous.current=item.prompt;requestAnimationFrame(()=>responseArea.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus());
  };
  const addFiles=(files:File[])=>{
    const entries=files.map(file=>{const url=URL.createObjectURL(file);urls.current.add(url);return{id:crypto.randomUUID(),name:file.name,mimeType:file.type||'application/octet-stream',size:file.size,previewUrl:file.type.startsWith('image/')?url:undefined,state:'available' as const};});
    setAttachments(items=>[...items,...entries]);
  };
  const submit=(value:string)=>{
    if(!revealed||(!value.trim()&&!attachments.length))return;
    clearPlayback();setSent(value.trim()||'Referencia visual adjunta');setPhase('leaving');setBusy(true);
    const exit=Math.max(motionMs('--modal-close-dur',180),motionMs('--notice-exit-dur',200));
    later(()=>{setPhase('chat');setBusy(false);setDraft('');setAttachments([]);},reduced?0:exit);
  };
  return <main className="mockup-page">
    <div className="mockup-toolbar"><span>Pregunta dentro del chat</span><div><button type="button" className="sound-control" aria-label="Sonido del aviso" aria-pressed={sound} onClick={()=>setSound(value=>!value)}>{sound?<Volume2 size={14}/>:<VolumeX size={14}/>}</button><button type="button" className="replay-control" onClick={replay} disabled={busy}><RotateCcw size={13}/>Probar entrada</button></div></div>
    <section ref={responseArea} className="chat-preview" aria-label="Chat Syka · pregunta integrada" data-phase={phase} data-motion={reduced?'reduced':'normal'} data-motion-style="in-place-depth" data-audio-cues={cues} data-audio-state={noticeAudioStatus().state}>
      <header className="chat-header"><span className="header-orb-slot"><AgentIdentityOrb agent={agent} variant="header" paused/></span><strong>Syka</strong><button type="button" aria-label="Nueva conversación" disabled={pending}><Plus size={16}/></button></header>
      <div className="chat-history" inert={pending}><div className="user-message">Haceme una animación sobre el alma y el Big Bang. Que la música tenga mucho peso.</div>{!pending&&<><div className="user-message answer-message">{sent}</div><p className="assistant-message">Tomo esa dirección para armar el prompt de la animación.</p></>}</div>
      <div className="inline-question" aria-labelledby="question-title" aria-hidden={!pending}>
        <div className="question-orb-slot"><div className={`question-orb t-modal ${phase==='arriving'||revealed?'is-open':''} ${phase==='leaving'?'is-closing':''}`}><AgentIdentityOrb agent={agent} variant="hero" working={busy} paused={!busy||reduced}/><span className="t-badge" data-open={revealed?'true':'false'}><span className="t-badge-dot">1</span></span></div></div>
        <div className={`question-content t-stagger ${revealed?'is-shown':''} ${phase==='leaving'?'is-hiding':''}`} inert={!revealed}>
          <h1 id="question-title" className="t-stagger-line">¿Cómo querés<br/>contar esta idea?</h1>
          <div className="quick-options t-stagger-line t-stagger-line--2" role="group" aria-label="Respuestas rápidas">{directions.map(item=><LabButton key={item.id} variant="secondary" size="small" className="lab-choice" data-direction={item.id} aria-pressed={choice===item.id} onClick={()=>choose(item)} leadingIcon={item.icon}>{item.label}{choice===item.id?<Check size={10} className="selected-check"/>:null}</LabButton>)}</div>
        </div>
      </div>
      <div className="composer-dock syka-mirel-composer" inert={phase==='idle'||phase==='arriving'||phase==='leaving'}><AgentComposer value={draft} onChange={setDraft} onSubmit={pending?submit:()=>{}} placeholder={pending?'Respondé o sumá una referencia…':'Pedile algo a Syka…'} ariaLabel={pending?'Tu respuesta':'Mensaje general'} submitLabel="Enviar respuesta" attachments={attachments} onFiles={addFiles} onRemoveAttachment={id=>setAttachments(items=>items.filter(item=>item.id!==id))} dictationContext="lienzo-inline-mockup" maxRows={3} accept="*" modelFallbackLabel="Modelo del chat"/></div>
    </section>
    <p className="mockup-footnote">Diseño en reposo · probá la entrada con sonido</p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
