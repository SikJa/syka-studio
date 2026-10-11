// Standalone QA entry: no projects, agent, IPC, accounts, DAPI or Electron.
import { render } from 'solid-js/web';
import { ColorModeProvider, useColorMode } from '@kobalte/core';
import { Button } from '@/components/ui/button';
import { Checkbox, CheckboxControl, CheckboxInput, CheckboxLabel } from '@/components/ui/checkbox';
import { Slider, SliderTrack, SliderFill, SliderThumb } from '@/components/ui/slider';
import { PersonalizationSection } from './personalization-section';
import { initializeAppearance } from '@/lib/appearance/controller';
import '@/index.css';
import '@/agent-chat/mirel-adapter.css';
initializeAppearance();
function Preview() {
  const mode = useColorMode();
  return <main style={{ width: 'min(800px, 100%)', margin: '0 auto', padding: '36px 18px' }}>
    <header style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '12px', 'margin-bottom': '30px' }}><div><p class="text-muted-foreground text-xs">SYKA CLIPS · PREVIEW LOCAL AISLADA</p><h1 class="text-xl mt-2">Configuración general</h1></div><Button variant="secondary" onClick={() => mode.toggleColorMode()}>Cambiar tema</Button></header>
    <PersonalizationSection />
    <div style={{ padding: '24px 8px', display: 'flex', gap: '24px', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
      <Checkbox defaultChecked><CheckboxInput /><CheckboxControl /><CheckboxLabel>Control activo</CheckboxLabel></Checkbox>
      <Slider defaultValue={[65]} class="w-36" aria-label="Nivel de prueba"><SliderTrack><SliderFill /></SliderTrack><SliderThumb /></Slider>
      <Button variant="destructive">Error semántico</Button>
    </div>
    <p class="text-muted-foreground text-xs px-2">Componentes reales de Syka. Esta preview usa almacenamiento propio y no abre proyectos ni conexiones.</p>
  </main>;
}
render(() => <ColorModeProvider initialColorMode="dark"><Preview /></ColorModeProvider>, document.getElementById('root')!);
