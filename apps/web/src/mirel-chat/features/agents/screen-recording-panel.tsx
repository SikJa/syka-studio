/** @jsxImportSource react */
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { Check, Crop, LoaderCircle, Mic, Monitor, Pause, Play, Square, Volume2, X } from 'lucide-react';
import { mainBridge } from '@/lib/ipc';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import type { ScreenAudioMode, ScreenCaptureSources, ScreenRegion } from '@desktop/screen-capture';
import { readRecordingMicrophone, startScreenRecorder, type CapturedRecording, type ScreenRecorder } from '@/lib/screen-recorder';
import { requireGroqTranscription, transcribeWithGroq } from '@/lib/syka-transcription';
import './screen-recording-panel.css';
import { readRecordingPreferences, saveRecordingPreferences } from '@/lib/recording-preferences';

type Props = { contextKey: string; projectDir: string; initialRegion?:boolean; onDismiss(): void; onSave(recording: CapturedRecording): Promise<void>; onTranscript(text: string, recording: CapturedRecording): Promise<void>; onConfigure(): void };
type Stage = 'setup' | 'selecting' | 'starting' | 'recording' | 'paused' | 'saving' | 'transcribing' | 'review';
const AUDIO = [
  { id: 'both', label: 'Micrófono + sistema', Icon: Volume2 },
  { id: 'microphone', label: 'Sólo micrófono', Icon: Mic },
  { id: 'system', label: 'Sólo sistema', Icon: Volume2 },
  { id: 'none', label: 'Sin audio', Icon: Monitor },
] as const;
const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export function ScreenRecordingPanel(props: Props) {
  const [sources, setSources] = useState<ScreenCaptureSources | null>(null);
  const [sourceId, setSourceId] = useState(''); const [audio, setAudio] = useState<ScreenAudioMode>(() => readRecordingPreferences().audio);
  const [stage, setStage] = useState<Stage>('setup'); const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(''); const [configured, setConfigured] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [transcribe, setTranscribe] = useState(() => readRecordingPreferences().transcribe); const [cropping, setCropping] = useState(props.initialRegion===true);
  const [previewUrl, setPreviewUrl] = useState(''); const [transcript, setTranscript] = useState('');
  const controller = useRef<ScreenRecorder | null>(null), captured = useRef<CapturedRecording | null>(null);
  const saved = useRef(false), inserted = useRef(false), generation = useRef(0), abort = useRef<AbortController | null>(null);
  const latest = useRef(props); latest.current = props;
  const panel = useRef<HTMLDivElement>(null); const status = useRef(stage); status.current = stage;
  const hasMicrophone = ['microphone', 'both'].includes(audio);
  const currentSource = sources?.sources.find(source => source.id === sourceId);
  const active = ['recording', 'paused'].includes(stage);
  const busy = ['selecting', 'starting', 'saving', 'transcribing'].includes(stage);
  const loadSources = async () => {
    setError('');
    try {
      const result = await mainBridge.call(MAIN_CHANNELS.SYKA_SCREEN_CAPTURE, { action: 'list' });
      if (status.current !== 'setup') return;
      setSources(result); setSourceId(id => result.sources.some(source => source.id === id) ? id : result.sources[0]?.id ?? '');
      if (!result.systemAudio) setAudio('microphone');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron consultar las pantallas.'); }
  };
  useEffect(() => {
    const priorFocus = document.activeElement as HTMLElement | null;
    void loadSources(); void mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_STATUS, undefined).then(result => setConfigured(result.configured)).catch(() => {});
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { generation.current++; abort.current?.abort(); controller.current?.cancel(); if (status.current === 'selecting') void mainBridge.call(MAIN_CHANNELS.SYKA_SCREEN_CAPTURE, { action: 'cancel-selection' }).catch(() => {}); if (priorFocus?.isConnected) priorFocus.focus(); };
  }, [props.contextKey]);
  const stopRef = useRef<() => void>(() => {});
  useEffect(() => { if (seconds >= 600 && stage === 'recording') stopRef.current(); }, [seconds, stage]);

  const finish = async (recording: CapturedRecording, token: number) => {
    try {
      if (!saved.current) { setStage('saving'); await latest.current.onSave(recording); if (token !== generation.current) return; saved.current = true; }
      if (transcribe && hasMicrophone && recording.microphonePath && !inserted.current) {
        setStage('transcribing'); const signal = new AbortController(); abort.current = signal;
        const microphone = await readRecordingMicrophone(recording);
        signal.signal.throwIfAborted();
        const segments = await transcribeWithGroq(microphone, signal.signal, { dir: latest.current.projectDir });
        if (token !== generation.current) return;
        const text = segments.map(segment => segment.text).join(' ').trim();
        await latest.current.onTranscript(text, recording);
        if (token !== generation.current) return;
        inserted.current = true; setTranscript(text);
      }
      setError(''); setStage('review');
    } catch (reason) {
      if (token !== generation.current) return;
      setStage('review'); setError(reason instanceof Error ? reason.message : 'No se pudo completar la grabación.');
    }
  };
  const stop = async () => {
    if (!controller.current || !['recording', 'paused'].includes(status.current)) return;
    setStage('saving'); status.current = 'saving'; const token = generation.current;
    try {
      const recording = await controller.current.stop(); controller.current = null;
      if (token !== generation.current) return;
      captured.current = recording; setPreviewUrl(recording.previewUrl);
      await finish(recording, token);
    } catch (reason) { if (token === generation.current) { setStage('setup'); setError(reason instanceof Error ? reason.message : 'No se pudo detener la grabación.'); } }
  };
  stopRef.current = () => { void stop(); };
  const start = async () => {
    if (!sourceId || busy) return;
    const token = ++generation.current; status.current = cropping ? 'selecting' : 'starting'; setStage(status.current); setError('');
    try {
      if (transcribe && hasMicrophone) await requireGroqTranscription();
      try { saveRecordingPreferences({ audio, transcribe }); } catch { /* Recording works even if local preferences cannot be saved. */ }
      if (token !== generation.current) return;
      // Remove the setup modal before selecting or beginning a desktop capture.
      await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
      if (token !== generation.current) return;
      let region: ScreenRegion | undefined;
      if (cropping) {
        const selected = await mainBridge.call(MAIN_CHANNELS.SYKA_SCREEN_CAPTURE, { action: 'select-region', sourceId });
        if (token !== generation.current) return;
        if (!selected.selectedRegion) { setStage('setup'); return; }
        region = selected.selectedRegion;
        setStage('starting');
      }
      const next = await startScreenRecorder({ audio, sourceId, projectDir: props.projectDir, region,
        onLimit: () => { stopRef.current(); }, onTime: setSeconds,
      });
      if (token !== generation.current) { next.cancel(); return; }
      controller.current = next; setSeconds(0); setStage('recording');
    } catch (reason) {
      if (token === generation.current) { setStage('setup'); setError(reason instanceof Error ? reason.message : 'No se pudo iniciar la grabación.'); }
    }
  };
  const dismiss = () => { generation.current++; abort.current?.abort(); controller.current?.cancel(); controller.current = null; latest.current.onDismiss(); };
  const togglePause = async () => {
    if (switching || !controller.current) return;
    const token = generation.current; setSwitching(true); setError('');
    try { if (status.current === 'paused') { await controller.current.resume(); if (token === generation.current) setStage('recording'); }
      else { await controller.current.pause(); if (token === generation.current) setStage('paused'); } }
    catch (reason) { if (token === generation.current) setError(reason instanceof Error ? reason.message : 'No se pudo cambiar la pausa.'); }
    finally { if (token === generation.current) setSwitching(false); }
  };

  if (stage === 'selecting' || stage === 'starting') return null;
  return createPortal(<div className={`syka-recording-layer ${active ? 'is-recording' : ''}`}>
    <div ref={panel} className={`syka-recording-panel ${stage === 'setup' ? 'is-setup' : ''}`} role="dialog" aria-modal={!active} aria-label="Grabar pantalla" tabIndex={-1} onKeyDown={event => {
      if (event.key === 'Escape' && !active && !busy) { event.preventDefault(); dismiss(); }
      if (event.key === 'Tab' && !active) {
        const focusable = Array.from(panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),video[controls]')).filter(node => node.getClientRects().length);
        if (!focusable.length) { event.preventDefault(); return; }
        const first = focusable[0], last = focusable.at(-1)!;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
      }
      event.stopPropagation();
    }}>
      <header><span className="syka-recording-title"><Monitor size={17}/><strong>{active ? 'Grabando pantalla' : 'Grabar pantalla'}</strong></span><button type="button" className="syka-recording-icon" aria-label={active ? 'Descartar grabación' : 'Cerrar grabación'} disabled={busy} onClick={dismiss}><X size={17}/></button></header>
      {stage === 'setup' ? <>
        <div className="syka-recording-setup">
        <div className="syka-recording-sources" aria-label="Pantallas disponibles">
          {sources?.sources.map(source => <button type="button" key={source.id} disabled={busy} aria-pressed={source.id === sourceId} onClick={() => setSourceId(source.id)}>
            <img src={source.thumbnail} alt=""/><span>{source.name}</span>{source.id === sourceId ? <Check size={14}/> : null}
          </button>)}
          {!sources && !error ? <p><LoaderCircle size={16} className="is-spinning"/> Buscando pantallas…</p> : null}
          {sources && !sources.sources.length ? <p>No hay pantallas disponibles.</p> : null}
        </div>
        <fieldset className="syka-recording-area"><legend>Qué querés grabar</legend><div role="group" aria-label="Área de grabación"><button type="button" aria-pressed={!cropping} disabled={busy} onClick={()=>setCropping(false)}><Monitor size={16}/><span>Pantalla completa</span></button><button type="button" aria-pressed={cropping} disabled={busy||!currentSource} onClick={()=>setCropping(true)}><Crop size={16}/><span>Elegir una zona</span></button></div></fieldset>
        <p className="syka-recording-caption">{cropping ? 'Al empezar, marcá el rectángulo sobre la pantalla real. La grabación arranca cuando lo soltás. Esc cancela.' : 'Se graba toda la pantalla elegida.'}</p>
        <div className="syka-recording-controls"><label className="syka-recording-audio-label">Audio<select aria-label="Audio de la grabación" value={audio} disabled={busy} onChange={event => setAudio(event.target.value as ScreenAudioMode)}>{AUDIO.map(option => <option value={option.id} key={option.id} disabled={!sources?.systemAudio && ['system', 'both'].includes(option.id)}>{option.label}</option>)}</select></label></div>
        <label className="syka-recording-transcribe"><input type="checkbox" checked={transcribe && hasMicrophone} disabled={busy || !hasMicrophone} onChange={event => setTranscribe(event.target.checked)}/>Transcribir mi voz y agregarla al chat</label>
        {transcribe && hasMicrophone && !configured ? <p className="syka-recording-caption">La transcripción usa tu conexión de Groq. <button type="button" onClick={() => { dismiss(); props.onConfigure(); }}>Configurar</button></p> : <p className="syka-recording-caption">El audio del sistema queda en el video. La transcripción usa sólo tu micrófono.</p>}
        </div>
        <footer><button type="button" className="syka-recording-secondary" disabled={busy} onClick={() => void loadSources()}>Actualizar pantallas</button><button type="button" className="syka-recording-primary" disabled={busy || !sourceId} onClick={() => void start()}><span className="syka-recording-dot"/>Empezar a grabar</button></footer>
      </> : active ? <div className="syka-recording-active"><span className={`syka-recording-dot ${stage === 'paused' ? 'is-paused' : ''}`}/><time>{clock(seconds)}</time><span>{stage === 'paused' ? 'En pausa' : AUDIO.find(item => item.id === audio)?.label}</span><button type="button" className="syka-recording-icon" disabled={switching} aria-label={stage === 'paused' ? 'Continuar grabación' : 'Pausar grabación'} onClick={() => void togglePause()}>{switching ? <LoaderCircle size={17} className="is-spinning"/> : stage === 'paused' ? <Play size={17}/> : <Pause size={17}/>}</button><button type="button" className="syka-recording-primary" disabled={switching} onClick={() => void stop()}><Square size={12} fill="currentColor"/>Terminar</button></div> : <>
        {previewUrl ? <video className="syka-recording-preview" src={previewUrl} controls preload="metadata"/> : null}
        {busy ? <p className="syka-recording-progress" role="status"><LoaderCircle size={16} className="is-spinning"/>{stage === 'saving' ? 'Guardando el video…' : 'Transcribiendo tu voz…'}</p> : <p className="syka-recording-caption">{saved.current ? 'Video adjunto al borrador. Revisalo y enviá cuando quieras.' : 'La grabación sigue disponible para volver a guardar.'}</p>}
        {transcript ? <p className="syka-recording-transcript">{transcript}</p> : null}
        <footer>{error && captured.current ? <button type="button" className="syka-recording-secondary" onClick={() => { setError(''); void finish(captured.current!, generation.current); }}>Reintentar {saved.current ? 'transcripción' : 'guardado'}</button> : <span/>}<button type="button" className="syka-recording-primary" disabled={stage === 'saving'} onClick={dismiss}>{stage === 'transcribing' ? 'Seguir con el video' : 'Listo'}</button></footer>
      </>}
      {error ? <p className="syka-recording-error" role="alert">{error}</p> : null}
    </div>
  </div>, document.fullscreenElement ?? document.body);
}
