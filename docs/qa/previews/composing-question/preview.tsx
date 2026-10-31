/** @jsxImportSource react */
import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUp, ArrowRight, Check, Plus, RotateCcw, ChevronDown, MessageSquare, SlidersHorizontal, Film, Layers, Sparkles, Pause, Play, LockKeyhole} from 'lucide-react';
import {AgentIdentityOrb} from '../../../../apps/web/src/mirel-chat/features/agents/agent-identity-orb';
import {SYKA_ORB_STATE} from '../../../../apps/web/src/lib/syka-brand';
import './preview.css';

const variants = [
  {name:'Foco',hint:'El orbe reúne la atención y abre la pregunta.',motion:'Orbe central · aviso suave · modal'},
  {name:'Órbita',hint:'La pregunta llega como una señal alrededor del orbe.',motion:'Trayectoria circular · badge · encuentro'},
  {name:'Acople',hint:'El composer se convierte en el espacio para responder.',motion:'Sube desde abajo · se acopla · abre el panel'},
  {name:'Lienzo',hint:'El chat entero se convierte en una decisión clara.',motion:'Una pantalla · una pregunta · una respuesta'},
];
const agent={key:'syka',name:'Syka',orbState:SYKA_ORB_STATE,accent:'#a6b4c2'};
const choices=[{title:'Poético y abstracto',note:'Emoción, metáforas y música.',icon:Sparkles},{title:'Explicativo y visual',note:'Una idea que se entiende paso a paso.',icon:Layers}];
const query=new URLSearchParams(location.search);
const clipMode=query.get('mode')==='clip';
const initial=Math.max(0,Math.min(3,Number(query.get('v')??1)-1));

function App(){
 const [variant,setVariant]=useState(initial);
 const [cycle,setCycle]=useState(0);
 const [phase,setPhase]=useState<'thinking'|'notice'|'question'|'leaving'|'building'|'done'>('thinking');
 const [choice,setChoice]=useState('');
 const [answer,setAnswer]=useState('');
 const [sent,setSent]=useState('');
 const [reduced,setReduced]=useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
 const dialog=useRef<HTMLDivElement>(null);
 const input=useRef<HTMLTextAreaElement>(null);
 const pending=phase==='thinking'||phase==='notice'||phase==='question'||phase==='leaving';
 const waiting=phase==='question'||phase==='leaving';
 const isOpen=phase==='question';
 const ready=Boolean(choice||answer.trim());
 const v=variants[variant];

 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(media.matches);
  media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
 },[]);
 useEffect(()=>{
  setPhase('thinking');setChoice('');setAnswer('');setSent('');
  const a=setTimeout(()=>setPhase('notice'),reduced?60:1000);
  const b=setTimeout(()=>setPhase('question'),reduced?120:1850);
  return()=>{clearTimeout(a);clearTimeout(b)};
 },[variant,cycle,reduced]);
 useEffect(()=>{if(isOpen)dialog.current?.querySelector<HTMLButtonElement>('.option')?.focus({preventScroll:true});},[isOpen]);
 useEffect(()=>{
  const trap=(e:KeyboardEvent)=>{
   if(!pending)return;
   if(e.key==='Escape'){e.preventDefault();return;}
   if(e.key!=='Tab'||!isOpen)return;
   const nodes=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, input')??[]);
   if(!nodes.length)return;
   const first=nodes[0],last=nodes.at(-1)!;
   if(e.shiftKey&&(document.activeElement===first||!dialog.current?.contains(document.activeElement))){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&(document.activeElement===last||!dialog.current?.contains(document.activeElement))){e.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',trap);return()=>document.removeEventListener('keydown',trap);
 },[pending,isOpen]);
 useEffect(()=>{
  // Observable demo state for UI validation; no provider calls or project writes.
  (window as any).sykaPreview={variant:variant+1,phase,choice,answer,sent,pending,reduced};
 },[variant,phase,choice,answer,sent,pending,reduced]);
 useEffect(()=>{
  if(phase!=='leaving')return;
  const timer=setTimeout(()=>setPhase('building'),reduced?0:340);return()=>clearTimeout(timer);
 },[phase,reduced]);
 useEffect(()=>{
  if(phase!=='building')return;
  document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus({preventScroll:true});
  const timer=setTimeout(()=>setPhase('done'),2200);return()=>clearTimeout(timer);
 },[phase]);
 const replay=()=>setCycle(x=>x+1);
 const submit=()=>{
  if(!ready||!isOpen)return;
  setSent([choice,answer.trim()].filter(Boolean).join(' · '));setPhase('leaving');
 };
 return <div className={`preview-app ${clipMode?'clip-mode':''}`} data-kb-theme="dark" data-phase={phase}>
  <header className="lab-header"><span className="brand-mark">s<span>y</span>ka.</span><span className="lab-label">ESTUDIO DE INTERACCIÓN</span><span className="prototype">Preview interactiva</span></header>
  <main>
   <aside className="presentation">
    <div className="eyebrow">CHAT · DIRECCIÓN CREATIVA</div>
    <h1>Antes de animar,<br/><span>una buena pregunta.</span></h1>
    <p>El orbe avisa. El chat hace lugar.<br/>La respuesta pone en marcha la pieza.</p>
    <nav aria-label="Variantes de preview">{variants.map((item,i)=><button key={item.name} className={`variant-pick ${variant===i?'active':''}`} onClick={()=>setVariant(i)} aria-pressed={variant===i}><span className="variant-number">0{i+1}</span><span><strong>{item.name}</strong><small>{item.hint}</small></span><ArrowRight size={18}/></button>)}</nav>
    <div className="presentation-bottom"><span className="sample-dot"/>Orbe composing de Syka · cuatro movimientos</div>
   </aside>
   <div className="demo-column">
    <div className="demo-toolbar"><span><b>0{variant+1}</b> / {v.name}</span><button onClick={replay} aria-label="Repetir animación"><RotateCcw size={14}/> Repetir</button></div>
    <section className={`chat variant-${variant+1}`} data-phase={phase} aria-label={`Chat Syka · ${v.name}`}>
     <div className="chat-background" inert={pending} aria-hidden={pending?true:undefined}>
      <div className="chat-header"><span className="mini-orb"><AgentIdentityOrb agent={agent} variant="header" working={!pending} paused={reduced}/></span><strong>Syka</strong><span className="session-name">Una idea, una pieza</span><button aria-label="Nueva conversación" disabled={pending}><Plus size={17}/></button><button aria-label="Opciones del chat" disabled={pending}><SlidersHorizontal size={16}/></button></div>
      <div className="chat-history"><div className="history-label">HOY</div><div className="user-message">Haceme una animación sobre el alma y el Big Bang. Quiero que la música tenga mucho peso.</div><div className="assistant-message"><span>SYKA</span><p>Estoy buscando una dirección para la pieza.</p></div>{sent&&<div className="user-message reply-message">{sent}</div>}{!pending&&<div className="assistant-message resumed"><span>SYKA</span><p>{phase==='done'?'Ya tengo la dirección. Sigo con el prompt y la animación.':'Armo el prompt con tus decisiones y las referencias elegidas.'}</p><small>Preview del flujo · no se está generando un video</small></div>}</div>
      <div className="composer"><textarea aria-label="Mensaje general" disabled={pending} placeholder="Pedile algo a Syka…"/><div className="composer-bottom"><button aria-label="Adjuntar" disabled={pending}><Plus size={17}/></button><span>Modelo del chat <ChevronDown size={12}/></span><button className="send-general" aria-label="Enviar mensaje general" disabled={pending}><ArrowUp size={17}/></button></div></div>
     </div>
     {pending&&<div className={`question-layer ${waiting?'is-waiting':''}`}>
      <div className="wash"/>
      <div className={`orb-stage ${phase==='thinking'?'is-thinking':''} ${variant===2?'is-docking':''}`}>
       <div className="orb-trail"/><div className="orb-aura"/><div className="orb-path"/>
       <div className="orb-mover"><AgentIdentityOrb agent={agent} variant="hero" working={phase==='thinking'} paused={reduced}/><span className="t-badge" data-open={phase==='notice'||waiting?'true':'false'}><span className="t-badge-dot">1</span></span></div>
      </div>
      <div className="orb-state" role="status" aria-live="polite">{phase==='thinking'?<><span className="thinking-shimmer">Buscando una dirección</span><span className="ellipses">···</span></>:phase==='notice'?<span className="notice-pill"><MessageSquare size={13}/> Tengo una pregunta</span>:<span className="waiting-caption"><span/> Una decisión antes de empezar</span>}</div>
      <div ref={dialog} className={`question-card t-modal ${isOpen?'is-open':''} ${phase==='leaving'?'is-closing':''}`} role="dialog" aria-modal="true" aria-hidden={!isOpen} aria-labelledby="question-title" aria-describedby="question-note" inert={!isOpen}>
       <div className="question-meta"><span>DIRECCIÓN CREATIVA</span><span className="question-count">01 / 01</span></div>
       <h2 id="question-title">¿Cómo querés<br className="question-break"/> contar esta idea?</h2>
       <p id="question-note">Elegí el enfoque. La música va a tener un lugar central en los dos.</p>
       <div className="options" role="group" aria-label="Enfoques de la animación">{choices.map(item=><button key={item.title} className={`option ${choice===item.title?'selected':''}`} aria-pressed={choice===item.title} onClick={()=>setChoice(item.title)}><span className="option-icon"><item.icon size={19} strokeWidth={1.5}/></span><span><strong>{item.title}</strong><small>{item.note}</small></span><span className="option-check">{choice===item.title?<Check size={13}/>:null}</span></button>)}</div>
       <button className={`delegate ${choice==='Elegí vos'?'selected':''}`} aria-pressed={choice==='Elegí vos'} onClick={()=>setChoice('Elegí vos')}>O elegí vos la dirección <ArrowRight size={13}/></button>
       <label className="answer-label" htmlFor="creative-answer">Tu respuesta <span>Podés sumar algo o escribir otra dirección</span></label>
       <textarea ref={input} id="creative-answer" value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Por ejemplo: poético, íntimo y con un cierre potente…" onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();submit();}}}/>
       <button className="continue" disabled={!ready||!isOpen} onClick={submit}>Continuar con mi respuesta <ArrowRight size={16}/></button>
       <div className="waiting-foot"><LockKeyhole size={11}/><span>El chat continúa cuando respondas.</span></div>
      </div>
     </div>}
     {!pending&&<div className="resume-signal"><Check size={13}/><span>Dirección recibida</span></div>}
    </section>
    <div className="demo-caption"><span>{v.motion}</span><span>Elegí una opción o escribí tu respuesta</span></div>
   </div>
  </main>
  <footer className="lab-footer"><span>SYKA STUDIO</span><span>Propuestas de interacción · 08.10.2026</span><span>El comportamiento del chat actual sigue igual.</span></footer>
 </div>
}

createRoot(document.getElementById('root')!).render(<App/>);
