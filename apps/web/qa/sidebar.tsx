import { render } from 'solid-js/web';
import { ColorModeProvider } from '@kobalte/core';
import { onMount, onCleanup, For, createSignal } from 'solid-js';
import { EngineProvider, useEngineContext } from '@/engine/context';
import { ProjectProvider } from '@/context/project';
import { RightSidebar } from '@/components/sidebar-right/right-sidebar';
import { Toaster } from '@/components/ui/sonner';
import { mount } from '@diffusionstudio/reconciler';
import { Name, Source, setActive } from '@diffusionstudio/runtime';
import { getDocumentEditor } from '@/engine/editor';
import { getEditHistory } from '@/engine/history';
import '@/index.css';
import './sidebar.css';
const project = {
  id: 'sidebar-qa',
  name: 'Verificación local',
  displayName: 'Verificación local',
  dir: '',
  entry: '',
  modifiedAt: '',
  createdAt: '',
};
function Fixture() {
  const engine = useEngineContext(),
    world = engine.world,
    editor = getDocumentEditor(world),
    history = getEditHistory(world);
  const [status, setStatus] = createSignal(
    'Seleccioná un elemento para revisar sus controles originales.',
  );
  let canvas!: HTMLCanvasElement;
  const document = mount(
    `const x=require('@diffusionstudio/jsx');module.exports.default=()=>x.Stage({frameRate:30,children:x.Scene({name:'Escena principal',active:true,width:1920,height:1080,end:16,__source:'scene',children:[x.Text({name:'Título principal',__source:'title',selected:true,x:140,y:620,width:800,height:150,fontFamily:'Inter',fontSize:64,end:16,children:['Una idea. Un impulso. Un nuevo ritmo.',x.SolidPaint({color:'#F3EFDF'})]}),x.Sequence({name:'Clips de prueba',__source:'sequence',children:[x.Rect({name:'Clip A',__source:'clip-a',width:480,height:270,end:4,children:x.SolidPaint({color:'#12516d'})}),x.Rect({name:'Clip B',__source:'clip-b',width:480,height:270,start:4,end:8,children:x.SolidPaint({color:'#ec7659'})})]})]})});`,
    world,
  );
  const nodes = () =>
    world.entities.filter(
      (e) => e.isAlive() && e.get(Source)?.value && e.get(Name)?.value,
    );
  const off = editor.onEdit(() =>
    setStatus(
      'Edición real en memoria · ' +
        world.entities.filter((e) => e.isAlive()).length +
        ' entidades · Deshacer disponible: ' +
        history.canUndo(),
    ),
  );
  onMount(() => {
    const scene = world.entities.find((e) => e.get(Source)?.value === 'scene');
    if (scene) setActive(world, scene);
    engine.mount(canvas);
    engine.start();
  });
  onCleanup(() => {
    off();
    document.dispose();
  });
  return (
    <main class="qa-editor">
      <section class="qa-main">
        <header>
          <strong>Syka Clips</strong>
          <span>Panel integrado · proyecto de prueba en memoria</span>
        </header>
        <div class="qa-stage">
          <canvas ref={canvas} />
        </div>
        <footer>
          <p>{status()}</p>
          <div class="qa-clips">
            <For each={nodes()}>
              {(node) => (
                <button onClick={() => editor.select(node)}>
                  {node.get(Name)?.value}
                </button>
              )}
            </For>
            <button onClick={() => history.undo()}>Deshacer</button>
            <button onClick={() => history.redo()}>Rehacer</button>
          </div>
        </footer>
      </section>
      <div class="qa-sidebar">
        <RightSidebar />
      </div>
      <Toaster />
    </main>
  );
}
render(
  () => (
    <ColorModeProvider initialColorMode="dark">
      <ProjectProvider project={project}>
        <EngineProvider projectId="sidebar-qa">
          <Fixture />
        </EngineProvider>
      </ProjectProvider>
    </ColorModeProvider>
  ),
  document.getElementById('root')!,
);
