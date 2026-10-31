import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import type { Item } from '@diffusionstudio/agent-chat';
import { Transcript } from '@/agent-chat/transcript';
import { ChatActionsContext } from '@/agent-chat/mirel-messages';
import { ChatIdentityHeader } from '@/agent-chat/chat-identity-header';
import '@/index.css';
import '@/agent-chat/mirel-adapter.css';

// Actual transcript + message components. Fixed test events only, no provider,
// IPC, project filesystem or writes to the user's chat history.
const user:Item={id:'u',kind:'user',text:'Creá una skill reutilizable con subtítulos abajo y centrados.'};
const comment:Item={id:'c',kind:'assistant',phase:'commentary',text:'Voy a revisar las referencias y guardar el borrador de la skill.'};
const thought:Item={id:'r',kind:'reasoning',text:'RAW_PRIVATE_REASONING_MUST_NOT_RENDER'};
const tools:Item[]=[{id:'t1',kind:'tool',name:'mcp',title:'syka_read_reference',status:'done',output:'RAW_TOOL_OUTPUT_MUST_NOT_RENDER'},
  {id:'t2',kind:'tool',name:'mcp',title:'syka_skills',status:'running'}];
const answer:Item={id:'a',kind:'assistant',phase:'final',text:'Queda fijado: subtítulos abajo y centrados, con la estética de la foto y sin emojis. Guardé el borrador para que lo revises antes de aplicarlo.\n\n## Borrador listo\n\nEl video sigue sin cambios.'};
function QA(){
  const [items,setItems]=createSignal<Item[]>([user,comment,thought]);
  const [running,setRunning]=createSignal(true);
  const [waiting,setWaiting]=createSignal(false);
  const [width,setWidth]=createSignal(334);
  const [sessionsOpen,setSessionsOpen]=createSignal(false);
  function stage(next:Item[],active:boolean,paused=false){setItems(next);setRunning(active);setWaiting(paused);}
  return <main style={{padding:'24px',background:'#151515',color:'#eee','min-height':'100vh'}}>
    <h1>Prueba local del chat real</h1>
    <div style={{display:'flex',gap:'10px','flex-wrap':'wrap','margin-bottom':'16px'}}>
      <button onClick={()=>stage([user,comment,thought],true)}>Pensando</button>
      <button onClick={()=>stage([user,comment,thought,...tools],true)}>Herramientas</button>
      <button onClick={()=>stage([user,comment,thought,...tools,answer],true)}>Respondiendo</button>
      <button onClick={()=>stage([user,comment,thought,...tools,answer],false)}>Terminar</button>
      <button onClick={()=>stage([user,comment,thought,...tools],false)}>Interrumpir</button>
      <button onClick={()=>stage([user,comment,thought,...tools],true,true)}>Esperando</button>
      <button onClick={()=>stage([user,comment,thought,...tools,answer,{id:'u2',kind:'user',text:'Seguimos'}],true)}>Nuevo turno</button>
      <button onClick={()=>setWidth(width()===334?300:334)}>Cambiar ancho</button>
      <button onClick={()=>stage([user,{...answer,text:'Las tres lecturas devolvieron documentación.\n\n- `syka_skills read` con ruta al directorio: `dynamic tool request failed`.\n- `syka_read_reference` → `reference/jsx/elements.md`: `dynamic tool request failed`.\n- `syka_read_reference` → `reference/jsx/rect.md`: `dynamic tool request failed`.\n\nRuta larga: `F:/Coding Proyects/Syka Clips/.runtime/diffusion/codex-runtime/profile/skills/syka-subtitulos-serif-abajo/SKILL.md`.'}],false)}>Lecturas largas</button>
    </div>
    <section class="syka-agent-chat" style={{display:'flex','flex-direction':'column',width:width()+'px',height:'470px',background:'#111',border:'1px solid #333','border-radius':'16px',overflow:'hidden'}}>
      <ChatIdentityHeader working={running()} sessionsOpen={sessionsOpen()} onToggleSessions={()=>setSessionsOpen(open=>!open)} />
      <ChatActionsContext.Provider value={{chatKey:()=> 'qa-transient-chat',running,lastAssistantId:()=>items().findLast(i=>i.kind==='assistant')?.id,isActiveItem:id=>{const all=items();return all.slice(all.findLastIndex(i=>i.kind==='user')+1).some(item=>item.id===id);},onBranch:()=>{},onDraft:()=>{}}}>
        <Transcript items={items()} sendCount={0} chatKey="qa" running={running()} waiting={waiting()}/>
      </ChatActionsContext.Provider>
      <div style={{padding:'10px 12px',color:'#777','font-size':'12px'}}>Composer · prueba aislada sin envío</div>
    </section>
  </main>;
}
render(()=> <QA/>,document.getElementById('root')!);
