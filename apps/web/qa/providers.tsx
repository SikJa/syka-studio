import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import { Composer } from '@/agent-chat/mirel-composer';
import { currentModel, setStoredModel } from '@/agent-chat/store';
import { ProviderSettings } from '@/components/dashboard/provider-settings';
import { DashboardHomeView } from '@/components/dashboard/home-view';
import type { Attachment } from '@/agent-chat/attachments';
import '@/index.css';

function QA() {
  const [tab, setTab] = createSignal('chat'), [text, setText] = createSignal(''), [files, setFiles] = createSignal<Attachment[]>([]);
  return <main style={{ padding: '20px', color: '#eee', background: '#101011', 'min-height': '100vh' }}>
    <p style={{'font-size':'11px',color:'#aaa','margin-bottom':'12px'}}>QA local · cuentas y catálogo simulados · sin inferencia</p>
    <nav style={{display:'flex',gap:'16px','margin-bottom':'16px'}}><button onClick={() => setTab('chat')}>Chat</button><button onClick={() => setTab('home')}>Inicio</button><button onClick={() => setTab('settings')}>Configuración</button></nav>
    <Show when={tab() === 'settings'}><div style={{'max-width':'800px'}}><ProviderSettings /></div></Show>
    <Show when={tab() === 'home'}><DashboardHomeView /></Show>
    <Show when={tab() === 'chat'}><section class="syka-agent-chat" style={{display:'flex','flex-direction':'column',height:'380px',width:'min(350px, 100%)',overflow:'hidden'}}>
      <div style={{flex:1,padding:'16px'}}>Conversación de prueba</div>
      <Composer projectDir="" chatKey="qa" text={text()} onText={setText} attachments={files()} onAttachments={setFiles} model={currentModel()} onModel={setStoredModel} running={false} waiting={false} blocked={null} onSend={() => {}} onStop={() => {}} />
    </section></Show>
  </main>;
}
render(() => <Router><Route path="*all" component={QA}/></Router>, document.getElementById('root')!);
