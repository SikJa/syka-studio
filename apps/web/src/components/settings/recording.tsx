import { createSignal } from 'solid-js';
import { toast } from 'somoto';
import { readRecordingPreferences, saveRecordingPreferences, type RecordingPreferences } from '@/lib/recording-preferences';
import { SettingsGroup, SettingsRow, SettingsSelect, SettingsSwitch } from './kit';

const audioOptions: { value: RecordingPreferences['audio']; label: string }[] = [
  { value: 'both', label: 'Micrófono + sistema' }, { value: 'microphone', label: 'Sólo micrófono' },
  { value: 'system', label: 'Sólo sistema' }, { value: 'none', label: 'Sin audio' },
];

/** Settings › Herramientas › Grabaciones: the starting values of the next screen recording. */
export function RecordingSettings() {
  const [preferences, setPreferences] = createSignal(readRecordingPreferences());
  const save = (patch: Partial<RecordingPreferences>) => {
    try { const next = { ...preferences(), ...patch }; saveRecordingPreferences(next); setPreferences(next); }
    catch { toast.error('No se pudo guardar la preferencia de grabación'); }
  };
  return <SettingsGroup title="Grabaciones" description="Valores iniciales de la próxima grabación de pantalla. Podés cambiarlos antes de grabar.">
    <SettingsRow title="Audio predeterminado" description="Las grabaciones terminadas quedan guardadas con el proyecto.">
      <SettingsSelect label="Audio predeterminado de grabación" value={preferences().audio} options={audioOptions} onChange={audio => save({ audio })} />
    </SettingsRow>
    <SettingsRow title="Transcribir mi voz al terminar" description="Si la grabación tiene micrófono, con el motor elegido en Voz y transcripción.">
      <SettingsSwitch label="Transcribir mi voz al terminar" checked={preferences().transcribe} onChange={transcribe => save({ transcribe })} />
    </SettingsRow>
  </SettingsGroup>;
}
