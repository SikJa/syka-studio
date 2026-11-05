import {createSignal,Show} from 'solid-js';
import {render} from 'solid-js/web';
import {ProviderSettings} from '../src/components/dashboard/provider-settings';
import {AgentSettings} from '../src/components/dashboard/syka-agent-settings';
import {DependencySettings} from '../src/components/dashboard/syka-dependencies';
import {UpdateCardHost} from '../src/components/whats-new/UpdateCard';
import '../src/index.css';
import '../src/components/settings/settings.css';
(window as any).desktop={};
const style=document.createElement('style');style.textContent='body{margin:0;padding:24px;background:#111;color:#eee;font:12px Inter,Arial}main{max-width:850px;margin:auto}.qa-section{background:#191919;border:1px solid #333;border-radius:12px;padding:20px;margin-top:16px}.qa-section>h2{font-size:16px;margin-bottom:8px}.qa-section>p{color:#aaa;margin-bottom:12px}nav{display:flex;gap:12px;margin:16px 0}nav button{padding:8px;background:#292929;border-radius:6px}';document.head.append(style);
function App(){const [tab,setTab]=createSignal('models');return <main><h1>Verificación aislada · datos de prueba</h1><nav><button onClick={()=>setTab('models')}>Modelos</button><button onClick={()=>setTab('skills')}>Skills</button><button onClick={()=>setTab('tools')}>Tools</button></nav><Show when={tab()==='models'}><ProviderSettings/></Show><Show when={tab()==='skills'}><AgentSettings section="skills"/></Show><Show when={tab()==='tools'}><DependencySettings/></Show><UpdateCardHost/></main>;}
render(()=><App/>,document.getElementById('root')!);
