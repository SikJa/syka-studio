import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { SkillScopeSelect } from '@/components/sidebar-right/skill-scope-select';
import '@/index.css';
import '@/components/sidebar-right/right-sidebar.css';
function QA(){
  const [scope,setScope]=createSignal('scene'),[selection,setSelection]=createSignal('Sin selección');
  return <main style={{padding:'24px',background:'#151515',color:'#eee','min-height':'100vh'}}>
    <h1>Prueba del alcance real de skills</h1>
    <button onClick={()=>setSelection(selection()==='Sin selección'?'Texto principal':'Sin selección')}>Cambiar selección</button>
    <section style={{width:'260px',padding:'14px',margin:'20px 0',background:'#111',border:'1px solid #333','border-radius':'10px'}}>
      <SkillScopeSelect value={scope()} selection={selection()} onChange={setScope}/>
      <p style={{'font-size':'11px',margin:'16px 0 0'}}>Alcance elegido: {scope()==='selection'?'Selección actual':'Video completo'}</p>
    </section>
  </main>;
}
render(QA,document.getElementById('root')!);
