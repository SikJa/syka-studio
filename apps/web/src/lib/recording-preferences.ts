import type { ScreenAudioMode } from '@desktop/screen-capture';
export type RecordingPreferences = { audio: ScreenAudioMode; transcribe: boolean };
export const DEFAULT_RECORDING_PREFERENCES: Readonly<RecordingPreferences> = Object.freeze({ audio: 'both', transcribe: true });
const key = 'syka.recording.preferences.v1';
export function readRecordingPreferences(): RecordingPreferences {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null');
    return {
      audio: ['none', 'system', 'microphone', 'both'].includes(raw?.audio) ? raw.audio : DEFAULT_RECORDING_PREFERENCES.audio,
      transcribe: typeof raw?.transcribe === 'boolean' ? raw.transcribe : DEFAULT_RECORDING_PREFERENCES.transcribe,
    };
  } catch { return { ...DEFAULT_RECORDING_PREFERENCES }; }
}
export function saveRecordingPreferences(preferences: RecordingPreferences): void {
  localStorage.setItem(key, JSON.stringify(preferences));
}
