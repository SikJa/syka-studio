/** @jsxImportSource react */
import {mainBridge} from "@/lib/ipc";
import {MAIN_CHANNELS} from "@desktop/main-channels";
import {requireGroqTranscription,transcribeWithGroq} from "@/lib/syka-transcription";
import { createPortal } from "react-dom";
import { DictationWaveform } from "./dictation-waveform.js";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Mic, Play, Check, X, Copy, History, Keyboard, Trash2, LoaderCircle } from "lucide-react";
import "./dictation-control.css";

type Entry = { id: string; text: string; at: string };
type Status = "idle" | "recording" | "paused" | "transcribing" | "retry";
export function DictationControl({ onText, disabled = false }: { onText: (text: string) => void; disabled?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<Element | null>(null);
  useLayoutEffect(() => { setSlot(root.current?.closest(".agent-composer-surface")?.querySelector(".dictation-slot") ?? null); }, []);
  const [user, setUser] = useState(""); const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false); const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState(""); const [seconds, setSeconds] = useState(0);
  const [history, setHistory] = useState<Entry[]>([]); const [showHistory, setShowHistory] = useState(false);
  const [shortcut, setShortcut] = useState("Alt+Shift+V"); const [capturingKey, setCapturingKey] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const audio = useRef<Blob | null>(null), chunks = useRef<Blob[]>([]), abort = useRef<AbortController | null>(null);
  const generation = useRef(0), starting = useRef(false), statusRef = useRef(status), onTextRef = useRef(onText);
  statusRef.current = status; onTextRef.current = onText;
  const storageKey = `syka:dictation:v1:${user}`;
  useEffect(() => {
    let disposed = false;
    void mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_STATUS,undefined).then(data=>{
      if(!disposed){setUser('local');setEnabled(data.configured);}
    }).catch(()=>{});    return () => { disposed = true; generation.current++; abort.current?.abort(); if (recorder.current) recorder.current.onstop = null; if (recorder.current?.state !== "inactive") recorder.current?.stop(); stream.current?.getTracks().forEach(track => track.stop()); };
  }, []);
  useEffect(() => {
    if (!user) return;
    try { const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); setHistory(Array.isArray(saved) ? saved.filter(entry => typeof entry.text === "string" && typeof entry.at === "string").slice(0, 30) : []); setShortcut(localStorage.getItem(`${storageKey}:shortcut`) || "Alt+Shift+V"); } catch { setHistory([]); }
  }, [user, storageKey]);
  const saveHistory = (entries: Entry[]) => { setHistory(entries); try { localStorage.setItem(storageKey, JSON.stringify(entries)); } catch { setError("El historial no pudo guardarse en este navegador."); } };
  const transcribe = async (blob: Blob) => {
    const current = ++generation.current; setStatus("transcribing"); setError("");
    const controller = new AbortController(); abort.current = controller;
    try {
      const segments=await transcribeWithGroq(blob,controller.signal);
      if(current!==generation.current)return;
      const text=segments.map(segment=>segment.text).join(' ').trim();
      if(!text)throw new Error('No se detectó voz. Podés volver a intentar.');      saveHistory([{ id: crypto.randomUUID(), text, at: new Date().toISOString() }, ...history].slice(0, 30));
      onTextRef.current(text); audio.current = null; chunks.current = []; setStatus("idle"); setOpen(false);
    } catch (reason) { if (current === generation.current) { setStatus("retry"); setError(reason instanceof Error ? reason.message : "No se pudo transcribir."); } }
  };
  const stop = () => { if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop(); };
  const cancel = () => { generation.current++; abort.current?.abort(); if (recorder.current) recorder.current.onstop = null; stop(); stream.current?.getTracks().forEach(track => track.stop()); audio.current = null; chunks.current = []; setStatus("idle"); setError(""); };
  const start = async () => {
    if (disabled || !enabled || starting.current) return;
    starting.current = true; setOpen(false); setError(""); const current = ++generation.current;
    try {
      await requireGroqTranscription();
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Este navegador no permite grabar. Habilitá el micrófono de Syka.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (current !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) { media.getTracks().forEach(track => track.stop()); throw new Error("Este navegador no ofrece un formato compatible."); }
      const next = new MediaRecorder(media, { mimeType, audioBitsPerSecond: 64000 }); recorder.current = next; chunks.current = []; setSeconds(0);
      let size = 0;
      next.ondataavailable = event => { if (event.data.size) { chunks.current.push(event.data); size += event.data.size; if (size >= 11 * 1024 * 1024 && next.state !== "inactive") next.stop(); } };
      next.onerror = () => { cancel(); setError("Se interrumpió la grabación. Revisá el micrófono."); };
      next.onstop = () => { media.getTracks().forEach(track => track.stop()); audio.current = new Blob(chunks.current, { type: mimeType }); void transcribe(audio.current); };
      next.start(1000); setStatus("recording");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir el micrófono."); } finally { starting.current = false; }
  };
  useEffect(() => { if (status !== "recording") return; const timer = setInterval(() => setSeconds(value => value + 1), 1000); return () => clearInterval(timer); }, [status]);
  useEffect(() => { if (seconds >= 300 && status === "recording") stop(); }, [seconds, status]);
  const toggleRef = useRef(() => {}); toggleRef.current = () => { if (statusRef.current === "recording" || statusRef.current === "paused") stop(); else if (statusRef.current === "idle") void start(); };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const composer = root.current?.closest('.agent-composer');
      const focusedComposer = document.activeElement?.closest('.agent-composer');
      // A reference note and the main chat can coexist. Dictate into only one.
      const target = focusedComposer ?? [...document.querySelectorAll('.agent-composer')].filter(node => (node as HTMLElement).offsetParent !== null).at(-1);
      if (composer !== target || event.defaultPrevented) return;
      if (!capturingKey && enabled && !disabled && !event.repeat && shortcutFor(event) === shortcut) {
        event.preventDefault(); toggleRef.current();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [shortcut, enabled, disabled, capturingKey]);
  return <div className="dictation-control" ref={root} onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); root.current?.querySelector<HTMLButtonElement>(".dictation-settings-trigger")?.focus(); } }}>
    <button type="button" data-tour-target="dictation" className="agent-composer-icon-button agent-composer-voice" aria-label="Dictar mensaje" title={enabled ? `Dictar · ${shortcut}` : "Dictado sin conexión"} disabled={disabled || !enabled} aria-pressed={status !== "idle"} onClick={() => toggleRef.current()}><Mic size={18}/></button>
    {slot && (status !== "idle" || error) ? createPortal(<div className="dictation-inline" aria-label="Grabación de voz">
      <button type="button" aria-label="Cancelar dictado" title="Cancelar" onClick={cancel}><X size={17}/></button>
      <div className="dictation-wave-area">{status === "recording" || status === "paused" ? <DictationWaveform stream={stream.current} active={status === "recording"}/> : <span role="status">{status === "transcribing" ? <><LoaderCircle size={15}/>Transcribiendo…</> : error}</span>}</div>
      <time>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</time>
      {status === "recording" || status === "paused" ? <><button type="button" aria-label={status === "paused" ? "Reanudar" : "Pausar"} title={status === "paused" ? "Reanudar" : "Pausar"} onClick={() => { if (status === "recording") { recorder.current?.pause(); setStatus("paused"); } else { recorder.current?.resume(); setStatus("recording"); } }}>{status === "paused" ? <Play size={15} fill="currentColor" strokeWidth={0}/> : <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4" y="3" width="2.5" height="10" rx=".8"/><rect x="9.5" y="3" width="2.5" height="10" rx=".8"/></svg>}</button><button className="dictation-confirm" type="button" aria-label="Transcribir" title="Transcribir" onClick={stop}><Check size={18} strokeWidth={2.3}/></button></> : status === "transcribing" ? <button type="button" aria-label="Detener transcripción" title="Detener transcripción" onClick={() => { generation.current++; abort.current?.abort(); setStatus("retry"); setError("Transcripción detenida."); }}><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4" y="3" width="2.5" height="10" rx=".8"/><rect x="9.5" y="3" width="2.5" height="10" rx=".8"/></svg></button> : status === "retry" ? <button type="button" onClick={() => { if (audio.current) void transcribe(audio.current); }}>Reintentar</button> : null}
    </div>, slot) : null}
    {open ? <section className="dictation-panel" aria-label="Opciones de dictado" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } }}>
      <header><strong>Dictado</strong><button type="button" aria-label="Cerrar opciones de dictado" onClick={() => setOpen(false)}><X size={16}/></button></header>
      <footer><button type="button" onClick={() => setShowHistory(!showHistory)}><History size={15}/>Historial</button><button type="button" onClick={() => setCapturingKey(!capturingKey)}><Keyboard size={15}/>{shortcut}</button></footer>
      {capturingKey ? <input autoFocus aria-label="Nuevo atajo de dictado" placeholder="Ctrl o Alt + tecla" readOnly onKeyDown={event => { event.preventDefault(); event.stopPropagation(); if (event.key === "Escape") { setCapturingKey(false); return; } if ((!event.ctrlKey && !event.altKey) || ["Control", "Alt", "Shift", "Meta"].includes(event.key)) return; const value = shortcutFor(event.nativeEvent); setShortcut(value); try { localStorage.setItem(`${storageKey}:shortcut`, value); } catch {} setCapturingKey(false); }}/> : null}
      {showHistory ? <div className="dictation-history"><header><span>En este navegador · últimas 30</span><button type="button" aria-label="Borrar historial de dictado" onClick={() => saveHistory([])}><Trash2 size={14}/></button></header>{history.length ? history.map(entry => <article key={entry.id}><time>{new Date(entry.at).toLocaleString("es-AR")}</time><p>{entry.text}</p><button type="button" onClick={() => { onTextRef.current(entry.text); setOpen(false); }}>Insertar</button><button type="button" aria-label="Copiar transcripción" onClick={() => void navigator.clipboard.writeText(entry.text).catch(() => setError("No se pudo copiar."))}><Copy size={14}/></button></article>) : <p>Todavía no hay transcripciones.</p>}</div> : null}
    </section> : null}
  </div>;
}
export function shortcutFor(event: Pick<KeyboardEvent, "ctrlKey" | "altKey" | "shiftKey" | "metaKey" | "key">) { return [event.ctrlKey ? "Ctrl" : "", event.altKey ? "Alt" : "", event.shiftKey ? "Shift" : "", event.metaKey ? "Meta" : "", event.key.toUpperCase()].filter(Boolean).join("+"); }
