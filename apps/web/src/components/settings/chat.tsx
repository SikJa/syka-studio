import { createSignal, onCleanup, onMount } from 'solid-js';
import { toast } from 'somoto';
import { DashboardScrollView, DashboardSurfaceSection } from '@/components/dashboard/shared';
import { Select, SelectTrigger, SelectValue, SelectPortal, SelectContent, SelectItem } from '@/components/ui/select';
import { applyModelPickerMaterial, readModelPickerPreferences, saveModelPickerPreferences, subscribeModelPickerPreferences } from '@/mirel-chat/features/agents/model-picker-preferences';

export function ChatSettings() {
  const [preferences, setPreferences] = createSignal(readModelPickerPreferences());
  onMount(() => {
    applyModelPickerMaterial();
    onCleanup(subscribeModelPickerPreferences(() => setPreferences(readModelPickerPreferences())));
  });
  const save = (patch: Parameters<typeof saveModelPickerPreferences>[0]) => {
    try { saveModelPickerPreferences(patch); setPreferences(readModelPickerPreferences()); }
    catch { toast.error('No se pudo guardar la configuración del chat.'); }
  };
  return <DashboardScrollView>
    <DashboardSurfaceSection title="Selector de modelos" description="La presentación se comparte entre chats. El modelo y su esfuerzo siguen siendo propios de cada conversación.">
      <div class="syka-settings-row"><div><p>Orientación del esfuerzo</p><small>La misma barra, al costado de los modelos o debajo de la lista.</small></div>
        <Select modal options={['Vertical','Horizontal']} value={preferences().orientation === 'vertical' ? 'Vertical' : 'Horizontal'}
          onChange={value => { if (value) save({ orientation: value === 'Horizontal' ? 'horizontal' : 'vertical' }); }}
          itemComponent={item => <SelectItem item={item.item}>{item.item.rawValue}</SelectItem>}>
          <SelectTrigger class="min-w-36" aria-label="Orientación del esfuerzo"><SelectValue<string>>{state => state.selectedOption()}</SelectValue></SelectTrigger>
          <SelectPortal><SelectContent/></SelectPortal>
        </Select>
      </div>
    </DashboardSurfaceSection>
    <DashboardSurfaceSection title="Material del chat" description="El selector usa el mismo fondo, borde y desenfoque del cuadro de mensaje.">
      <div class="syka-settings-row"><div><p>Superficie del composer</p><small>Conserva el tema y el color de acento que elegiste en Apariencia.</small></div>
        <Select modal options={['Sólido','Cristal']} value={preferences().material === 'glass' ? 'Cristal' : 'Sólido'}
          onChange={value => { if (value) save({ material: value === 'Cristal' ? 'glass' : 'solid' }); }}
          itemComponent={item => <SelectItem item={item.item}>{item.item.rawValue}</SelectItem>}>
          <SelectTrigger class="min-w-36" aria-label="Material del chat"><SelectValue<string>>{state => state.selectedOption()}</SelectValue></SelectTrigger>
          <SelectPortal><SelectContent/></SelectPortal>
        </Select>
      </div>
    </DashboardSurfaceSection>
  </DashboardScrollView>;
}
