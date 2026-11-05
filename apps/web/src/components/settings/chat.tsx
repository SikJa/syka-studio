import { createSignal, onCleanup, onMount } from 'solid-js';
import { toast } from 'somoto';
import { applyModelPickerMaterial, readModelPickerPreferences, saveModelPickerPreferences, subscribeModelPickerPreferences } from '@/mirel-chat/features/agents/model-picker-preferences';
import { SettingsGroup, SettingsRow, SettingsSelect } from './kit';

/** Settings › Chat: how the model picker looks. The model and its effort stay per conversation. */
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
  return <>
    <SettingsGroup title="Selector de modelos" description="Se comparte entre chats. El modelo y su esfuerzo siguen siendo de cada conversación.">
      <SettingsRow title="Orientación del esfuerzo" description="La misma barra, al costado de los modelos o debajo de la lista.">
        <SettingsSelect label="Orientación del esfuerzo" value={preferences().orientation === 'horizontal' ? 'horizontal' : 'vertical'}
          options={[{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }]}
          onChange={orientation => save({ orientation })} />
      </SettingsRow>
      <SettingsRow title="Superficie del composer" description="El fondo del cuadro de mensaje y del selector. Conserva tu tema y tu acento.">
        <SettingsSelect label="Material del chat" value={preferences().material === 'glass' ? 'glass' : 'solid'}
          options={[{ value: 'solid', label: 'Sólido' }, { value: 'glass', label: 'Cristal' }]}
          onChange={material => save({ material })} />
      </SettingsRow>
    </SettingsGroup>
  </>;
}
