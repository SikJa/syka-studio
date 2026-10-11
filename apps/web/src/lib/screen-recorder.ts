import { mainBridge } from './ipc';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import type { ScreenAudioMode, ScreenRecording, ScreenRegion } from '@desktop/screen-capture';
export type CaptureRegion = ScreenRegion;
export type CapturedRecording = ScreenRecording;
export type ScreenRecorder = { pause(): Promise<void>; resume(): Promise<void>; stop(): Promise<CapturedRecording>; cancel(): void };

export async function readRecordingMicrophone(recording: CapturedRecording): Promise<Blob> {
  const response = await mainBridge.call(MAIN_CHANNELS.SYKA_SCREEN_CAPTURE, { action: 'microphone', id: recording.id });
  if (!response.audio) throw new Error('La pista de voz no está disponible.');
  return new Blob([new Uint8Array(response.audio)], { type: 'audio/wav' });
}
/** Native GDI + WASAPI recorder adapted from Whispera; no getDisplayMedia. */
export async function startScreenRecorder(options: { sourceId: string; projectDir: string; audio: ScreenAudioMode; region?: CaptureRegion; onLimit(): void; onTime?(seconds: number): void }): Promise<ScreenRecorder> {
  const result = await mainBridge.call(MAIN_CHANNELS.SYKA_SCREEN_CAPTURE, { action: 'start', sourceId: options.sourceId, projectDir: options.projectDir, audio: options.audio, region: options.region });
  const id = result.recording?.id;
  if (!id) throw new Error('El motor de pantalla no devolvió una grabación.');
  let finished = false, polling = false, stopping: Promise<CapturedRecording> | null = null;
  const timer = setInterval(() => {
    if (finished || polling) return;
    polling = true;
    void mainBridge.call(MAIN_CHANNELS.SYKA_SCREEN_CAPTURE, { action: 'status', id }).then(state => {
      if (finished) return;
      options.onTime?.(Math.floor(state.status?.seconds ?? 0));
      if (state.status?.phase === 'complete' || (state.status?.seconds ?? 0) >= 600) options.onLimit();
      if (state.status?.phase === 'error') options.onLimit();
    }).catch(() => {}).finally(() => { polling = false; });
  }, 500);
  return {
    async pause() { await mainBridge.call(MAIN_CHANNELS.SYKA_SCREEN_CAPTURE, { action: 'pause', id }); },
    async resume() { await mainBridge.call(MAIN_CHANNELS.SYKA_SCREEN_CAPTURE, { action: 'resume', id }); },
    stop() {
      if (stopping) return stopping;
      finished = true; clearInterval(timer);
      stopping = mainBridge.call(MAIN_CHANNELS.SYKA_SCREEN_CAPTURE, { action: 'stop', id }).then(state => {
        if (!state.recording?.path) throw new Error('No se encontró el MP4 terminado.');
        return state.recording;
      });
      return stopping;
    },
    cancel() { if (finished) return; finished = true; clearInterval(timer); void mainBridge.call(MAIN_CHANNELS.SYKA_SCREEN_CAPTURE, { action: 'cancel', id }).catch(() => {}); },
  };
}
