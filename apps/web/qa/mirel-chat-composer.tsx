/** @jsxImportSource react */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { AgentComposer } from '@/mirel-chat/features/agents/agent-composer';
import '@/index.css';
import '@/agent-chat/mirel-adapter.css';

// Real composer, fixed test telemetry; no chat/provider requests or project writes.
function ComposerQA() {
  const [phase, setPhase] = useState('idle');
  const [text, setText] = useState('');
  const [narrow, setNarrow] = useState(false);
  const [fast,setFast]=useState(false),[fastAvailable,setFastAvailable]=useState(true),[effort,setEffort]=useState('medium');
  return <main style={{padding:24,color:'#eee',background:'#151515',minHeight:'100vh'}}>
    <h1>Verificación local · ventana de contexto</h1>
    <label>Estado <select aria-label="Estado del chat" value={phase} onChange={e=>setPhase(e.target.value)}><option value="idle">En reposo</option><option value="thinking">Pensando</option><option value="streaming">Respondiendo</option></select></label>
    <button onClick={()=>setNarrow(v=>!v)}>Cambiar ancho</button>
    <button onClick={()=>setFastAvailable(v=>!v)}>Cambiar disponibilidad rápida</button>
    <section className="syka-agent-chat" style={{display:'flex',flexDirection:'column',height:460,width:narrow?300:360,overflow:'hidden',marginTop:30,border:'1px solid #333',borderRadius:16}}>
      <div style={{flex:1,overflow:'auto',padding:16}}>{phase==='thinking'?'Pensando…':phase==='streaming'?'Respuesta en curso…':'Conversación de prueba'}</div>
      <div className="syka-mirel-composer"><AgentComposer value={text} onChange={setText} onSubmit={()=>{}} onStop={()=>setPhase('idle')} working={phase!=='idle'} contextUsage={{usedTokens:28424,maxTokens:258400}} models={[{id:'codex:test',label:'GPT-6.1-Sol'}]} selectedModelId="codex:test" onModelChange={()=>{}}
        efforts={[{id:'low',label:'Bajo'},{id:'medium',label:'Medio'},{id:'high',label:'Alto'}]} selectedEffortId={effort} onEffortChange={setEffort} fast={fast&&fastAvailable} fastAvailable={fastAvailable} onFastChange={setFast} fastUnavailableReason="Este modelo no ofrece modo rápido en tu cuenta." /></div>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<ComposerQA />);
