import {render} from 'solid-js/web';
import {ColorModeProvider,useColorMode} from '@kobalte/core';
import {ProviderSettings} from '@/components/dashboard/provider-settings';
import {ProjectProvider} from '@/context/project';
import {EngineProvider} from '@/engine/context';
import {Toolbar} from '@/components/canvas/toolbar';
import {initializeAppearance,previewAccent} from '@/lib/appearance/controller';
import '@/index.css';
import '@/components/canvas/transport.css';
const project={id:'contrast-qa',name:'QA',displayName:'QA',dir:'',entry:'',modifiedAt:'',createdAt:''};
function QA(){const theme=useColorMode(); initializeAppearance();previewAccent('#FFFFFF');return <main style={{padding:'24px','max-width':'850px',margin:'0 auto'}}>
<p style={{'font-size':'12px','margin-bottom':'16px'}}>QA aislada · componentes reales · catálogo ficticio · sin cuentas ni proyectos del usuario</p>
<nav style={{display:'flex',gap:'16px','margin-bottom':'16px'}}><button onClick={()=>theme.setColorMode('dark')}>Tema oscuro QA</button><button onClick={()=>theme.setColorMode('light')}>Tema claro QA</button><button onClick={()=>previewAccent('#FFFFFF')}>Acento blanco QA</button><button onClick={()=>previewAccent('#000000')}>Acento negro QA</button><button onClick={()=>previewAccent('#008CFF')}>Acento azul QA</button></nav>
<ProjectProvider project={project}><EngineProvider projectId="contrast-qa"><div class="syka-canvas-preview" style={{position:'relative',height:'150px',border:'1px solid var(--border)','margin-bottom':'20px'}}><Toolbar fullscreen={false} onFullscreen={()=>{}} portalMount={document.body}/></div></EngineProvider></ProjectProvider>
<ProviderSettings/></main>}
render(()=><ColorModeProvider initialColorMode="dark"><QA/></ColorModeProvider>,document.getElementById('root')!);
