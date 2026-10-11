import { createSignal } from 'solid-js';
import { toast } from 'somoto';
import { DashboardSurfaceSection } from '@/components/dashboard/shared';
import { Select, SelectContent, SelectItem, SelectPortal, SelectTrigger, SelectValue } from '@/components/ui/select';
import { readRecordingPreferences, saveRecordingPreferences, type RecordingPreferences } from '@/lib/recording-preferences';
const audioOptions: { value: RecordingPreferences['audio']; label: string }[] = [
  { value: 'both', label: 'Micrófono + sistema' }, { value: 'microphone', label: 'Sólo micrófono' },
  { value: 'system', label: 'Sólo sistema' }, { value: 'none', label: 'Sin audio' },
];
export function RecordingSettings() {
  const [preferences, setPreferences] = createSignal(readRecordingPreferences());
  const save = (patch: Partial<RecordingPreferences>) => {
    try { const next = { ...preferences(), ...patch }; saveRecordingPreferences(next); setPreferences(next); }
    catch { toast.error('No se pudo guardar la preferencia de grabación'); }
  };
  return <DashboardSurfaceSection title="Grabaciones" description="Valores iniciales para la próxima grabación de pantalla. Podés cambiarlos antes de grabar.">
    <div class="syka-settings-row"><div><p>Audio predeterminado</p><small>Las grabaciones terminadas quedan guardadas con el proyecto.</small></div><Select options={audioOptions} optionValue="value" optionTextValue="label" value={audioOptions.find(option => option.value === preferences().audio)} onChange={option => { if (option) save({ audio: option.value }); }} itemComponent={item => <SelectItem item={item.item}>{item.item.rawValue.label}</SelectItem>}><SelectTrigger class="syka-settings-select" aria-label="Audio predeterminado de grabación"><SelectValue<typeof audioOptions[number]>>{value => value.selectedOption()?.label}</SelectValue></SelectTrigger><SelectPortal><SelectContent class="syka-storage-select" /></SelectPortal></Select></div>
    <div class="syka-settings-row"><div><p>Transcribir mi voz al terminar</p><small>Se usa cuando la grabación incluye micrófono y tenés Groq configurado.</small></div><label class="syka-storage-toggle"><input type="checkbox" aria-label="Transcribir mi voz al terminar" checked={preferences().transcribe} onChange={event => save({ transcribe: event.currentTarget.checked })} /><span>{preferences().transcribe ? 'Activada' : 'Desactivada'}</span></label></div>
  </DashboardSurfaceSection>;
}
