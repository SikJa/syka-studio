import { render } from 'solid-js/web';
import { Show } from 'solid-js';
import { EditorTour } from '@/components/onboarding/editor-tour';
import { requestEditorTour } from '@/components/onboarding/editor-tour-model';
import { visualPickMode, setVisualPickMode } from '@/agent-chat/visual-target-state';
import '@/index.css';

function QA() {
  let anchor: HTMLButtonElement | undefined;
  return <main style={{ padding: '24px', color: '#eee', background: '#101011', 'min-height': '100vh' }}>
    <p>QA aislada: recorrido real, selección simulada. No abre proyectos.</p>
    <button ref={anchor} data-tour-target="project-menu" onClick={requestEditorTour}>Ver recorrido</button>
    <button data-tour-target="visual-select" onClick={() => setVisualPickMode('element')}>Seleccionar</button>
    <Show when={visualPickMode()}><section role="dialog" aria-label="Selección de prueba" style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '24px', background: '#292929' }}>
      <p>La selección ocupa la pantalla sin superponer el recorrido.</p>
      <button onClick={() => setVisualPickMode(null)}>Terminar selección</button>
    </section></Show>
    <EditorTour menuAnchor={() => anchor}/>
  </main>;
}
render(() => <QA/>, document.getElementById('root')!);
