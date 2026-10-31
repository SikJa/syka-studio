/** @jsxImportSource react */
import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {SykaSessionRail} from '@/mirel-chat/features/agents/syka-session-rail';
import '@/index.css';
import '@/agent-chat/mirel-adapter.css';
import '@/agent-chat/chat-panel-motion.css';
// React fixture follows the mirel-chat Vite exclusion; only QA-prefixed metadata.
const key='qa-menus-stability';
function seed(){localStorage.setItem(`syka:chat-projects:v1:${key}`,JSON.stringify({projects:[{id:'alpha',name:'Proyecto Alpha',archived:false},{id:'beta',name:'Proyecto Beta',archived:false},{id:'old',name:'Archivado',archived:true}],assignments:{c1:'alpha',c2:'beta'}}));localStorage.setItem(`syka:thread-view:${key}`,JSON.stringify({status:'all'}));}
if(!localStorage.getItem(`syka:chat-projects:v1:${key}`))seed();
function QA(){
  const [open,setOpen]=useState(true),[selected,setSelected]=useState<string|null>('c1'),[short,setShort]=useState(false),[reset,setReset]=useState(0);
  return <main style={{padding:24,minHeight:'100vh',background:'#151515',color:'#eee'}}>
    <h1>Menús reales · datos aislados</h1><button onClick={()=>setOpen(value=>!value)}>Mostrar sidebar</button><button onClick={()=>setShort(value=>!value)}>Cambiar altura</button><button onClick={()=>{seed();setReset(value=>value+1);}}>Restablecer prueba</button><button>Fuera del menú</button>
    <div className="syka-agent-chat" style={{position:'relative',margin:'40px 0 0 88px',width:300,height:short?330:490,overflow:'hidden',border:'1px solid #333',borderRadius:12}}>
      <div className="syka-session-overlay t-panel-slide" data-open={open} style={{inset:0,width:'100%','maxWidth':'100%'}}><SykaSessionRail key={reset} projectId={key} selectedId={selected} open={open} running={false} threads={Array.from({length:15},(_,i)=>({conversationId:`c${i+1}`,title:`Chat ${i+1}`,updatedAt:new Date(2026,9,3,0,i).toISOString(),status:'active' as const}))} messages={[]} onClose={()=>setOpen(false)} onSelect={setSelected} onNew={async()=>{throw Error('QA: fallo de creación');}} onGuide={()=>{}} onSkills={()=>{}} onScheduled={()=>{}} onExport={()=>{}} onOpenWindow={()=>{}}/></div>
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<QA/>);
