import { PersonalizationSection } from '@/components/dashboard/personalization/personalization-section';
import { createEffect, createSignal, For } from 'solid-js';
import { COLOR_MODE_STORAGE_KEY, useColorMode } from '@kobalte/core';
import { toast } from 'somoto';
import { DashboardScrollView, DashboardSurfaceSection } from '@/components/dashboard/shared';
import { motionPreference, saveMotionPreference } from './state';
import { Select, SelectTrigger, SelectValue, SelectPortal, SelectContent, SelectItem } from '@/components/ui/select';
import { t } from '@/i18n';

type Theme = 'light' | 'dark' | 'system';
export function AppearanceSettings() {
  const { colorMode, setColorMode } = useColorMode();
  const [theme, setTheme] = createSignal<Theme>('dark');
  createEffect(() => {
    const resolved = colorMode();
    try {
      const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
      setTheme(stored === 'dark' || stored === 'light' || stored === 'system' ? stored : resolved);
    } catch { setTheme(resolved); }
  });
  const chooseTheme = (value: Theme) => { setColorMode(value); setTheme(value); };
  return <DashboardScrollView>
    <PersonalizationSection />
    <DashboardSurfaceSection title="Tema" description="El mismo diseño de Syka, con el contraste que prefieras.">
      <div class="syka-theme-options" role="group" aria-label="Tema de Syka">
        <For each={[['dark', 'Oscuro'], ['light', 'Claro'], ['system', 'Sistema']] as const}>{([value, label]) =>
          <button type="button" class="syka-theme-option" aria-pressed={theme() === value} onClick={() => chooseTheme(value)}>
            <span class={'syka-theme-preview syka-theme-preview-' + value}><i /><span><b /><b /><b /></span></span>
            <span>{t(label)}</span><span class="syka-option-check" aria-hidden="true">{theme() === value ? '✓' : ''}</span>
          </button>
        }</For>
      </div>
    </DashboardSurfaceSection>
    <DashboardSurfaceSection title="Movimiento">
      <div class="syka-settings-row">
        <div><p>Animaciones y transiciones</p><small>Siempre se respeta la preferencia de movimiento de tu sistema.</small></div>
        <Select modal options={['Seguir al sistema','Reducir movimiento']}
          value={motionPreference()==='reduced'?'Reducir movimiento':'Seguir al sistema'}
          onChange={value=>{if(!value)return;try{saveMotionPreference(value==='Reducir movimiento'?'reduced':'system')}catch{toast.error('No se pudo guardar la preferencia.')}}}
          itemComponent={item=><SelectItem item={item.item}>{t(item.item.rawValue)}</SelectItem>}>
          <SelectTrigger class="min-w-44" aria-label="Movimiento de la interfaz"><SelectValue<string>>{state=>t(state.selectedOption())}</SelectValue></SelectTrigger>
          <SelectPortal><SelectContent class="syka-motion-select"/></SelectPortal>
        </Select>
      </div>
    </DashboardSurfaceSection>
  </DashboardScrollView>;
}
