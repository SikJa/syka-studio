/**
 * Settings › Voz: who transcribes dictation, its language and the microphone,
 * on this computer (desktop preference `dspro.ui.voice.v1`, localStorage in a
 * browser). Video captions are chosen apart, in the same page.
 */
export type DictationEngine = 'auto' | 'groq' | 'codex' | 'local' | 'parakeet';
export type VoicePrefs = {
  /** `auto`: Codex when its account is signed in, then this computer, then the caption provider. */
  engine: DictationEngine;
  /** ISO 639-1 code, or `auto` to let the service detect it. */
  language: string;
  /** A `MediaDeviceInfo.deviceId`, or empty for the system default. */
  microphone: string;
};

export const DEFAULT_VOICE_PREFS: VoicePrefs = { engine: 'auto', language: 'auto', microphone: '' };
export const VOICE_PREFS_KEY = 'dspro.ui.voice.v1';
const CHANGED = 'syka:voice-prefs';

function storage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try { return window.desktop?.preferences ?? window.localStorage; } catch { return undefined; }
}

export function voicePrefs(): VoicePrefs {
  try { return { ...DEFAULT_VOICE_PREFS, ...JSON.parse(storage()?.getItem(VOICE_PREFS_KEY) ?? '{}') }; }
  catch { return DEFAULT_VOICE_PREFS; }
}

export function updateVoicePrefs(patch: Partial<VoicePrefs>): VoicePrefs {
  const next = { ...voicePrefs(), ...patch };
  try { storage()?.setItem(VOICE_PREFS_KEY, JSON.stringify(next)); } catch { /* This session only. */ }
  window.dispatchEvent(new CustomEvent(CHANGED));
  return next;
}

export function onVoicePrefsChange(listener: () => void): () => void {
  window.addEventListener(CHANGED, listener);
  return () => window.removeEventListener(CHANGED, listener);
}

/** The microphone constraint for `getUserMedia`. */
export function microphoneConstraint(prefs: VoicePrefs = voicePrefs()): MediaTrackConstraints | true {
  return prefs.microphone ? { deviceId: { exact: prefs.microphone } } : true;
}
