/** @jsxImportSource react */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, X } from 'lucide-react';
import { AgentComposer } from '../agents/agent-composer';
import { mainBridge } from '@/lib/ipc';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { accentTokens } from '@/lib/appearance/color';
import { attachOrb, wakeOrbs } from './orb';
import { NOTICE_ATTACHMENT_ACCEPT, NOTICE_ATTACHMENT_MAX_COUNT, NOTICE_ATTACHMENT_MAX_TOTAL_BYTES, noticeAttachmentLimit } from '../../../../../../packages/agent-chat/src/notifications';
import type { NoticeCommand, NoticeImage, NoticeRegion, NoticeSnapshot, StudioNotice } from '../../../../../../packages/agent-chat/src/notifications';
import './notifications.css';
import { pulseOrb } from '@/lib/orb-motion';

const command = (data: NoticeCommand) => mainBridge.call(MAIN_CHANNELS.SYKA_NOTIFICATIONS, data);
const sound = new Audio(new URL(location.protocol === 'file:' ? 'syka-notice.wav' : '/syka-notice.wav', window.location.href).href);
sound.preload = 'auto';
// The packaged page sits next to the shipped public asset (no machine paths).
if (location.protocol === 'file:') sound.src = new URL('syka-notice.wav', location.href).href;

function Notification({ notice }: { notice: StudioNotice }) {
  const [expanded, setExpanded] = useState(false), [draft, setDraft] = useState('');
  const [answers, setAnswers] = useState<Record<string, string[]>>({}), [step, setStep] = useState(0);
  const [choices, setChoices] = useState<Record<string, string[]>>({}), [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false), [error, setError] = useState('');
  const [photos, setPhotos] = useState<NoticeImage[]>([]), [preparing, setPreparing] = useState(false), [dragging, setDragging] = useState(false);
  const photoRef = useRef<NoticeImage[]>([]), uploads = useRef(0), uploadQueue = useRef(Promise.resolve()), dragDepth = useRef(0);
  const [height, setHeight] = useState(170);
  const row = useRef<HTMLElement>(null), bubble = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null), head = useRef<HTMLButtonElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const alive = useRef(true);
  const manualExpanded = useRef<boolean | null>(null);
  const question = notice.request?.questions[step];
  const selectedChoices = question ? choices[question.id] || [] : [];
  const longest = Math.max(0, ...draft.split('\n').map(line => line.length));
  const width = 244 + Math.min(40, Math.max(0, longest - 24) * 1.25);
  useEffect(() => {
    alive.current = true;
    const detach = canvas.current ? attachOrb(canvas.current) : () => {};
    return () => { alive.current = false; clearTimeout(closeTimer.current); detach(); };
  }, []);
  useEffect(() => {
    // Reading, replying and preparing attachments keep this alert alive;
    // dismissing the popup never resolves the question in the chat.
    const timer = setInterval(() => {
      if (row.current?.matches(':hover') || row.current?.contains(document.activeElement) || draft.trim() || photoRef.current.length || uploads.current || sending) {
        void command({ action: 'keep-alive', id: notice.id }).catch(console.error);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [notice.id, draft, sending]);
  useLayoutEffect(() => {
    const element = body.current;
    if (!element) return;
    const fit = () => setHeight(52 + element.offsetHeight);
    const observer = new ResizeObserver(fit); observer.observe(element); fit();
    return () => observer.disconnect();
  }, [step]);
  function show() { clearTimeout(closeTimer.current); if (manualExpanded.current !== false) setExpanded(true); wakeOrbs(); }
  function toggleOrb() {
    clearTimeout(closeTimer.current);
    manualExpanded.current = !expanded; setExpanded(!expanded); wakeOrbs();
    pulseOrb(row.current?.querySelector('.floating-orb'));
  }
  function leave() {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      if (!row.current?.matches(':hover') && !row.current?.contains(document.activeElement) && !draft.trim() && !photoRef.current.length && !uploads.current && !bubble.current?.querySelector('.dictation-inline')) { setExpanded(false); manualExpanded.current = null; }
    }, 280);
  }
  async function act(action: 'open' | 'artifact' | 'dismiss') {
    try { await command({ action, id: notice.id }); }
    catch (reason) { if (alive.current) { setError((reason as Error).message); show(); } }
  }
  async function submit(value: string) {
    if (!question || (!value.trim() && !selectedChoices.length && !photoRef.current.length) || sending || uploads.current) return;
    const text = value.trim();
    const reply = [...selectedChoices, ...(text && !selectedChoices.includes(text) ? [text] : [])];
    if (!reply.length) reply.push('Tomá los archivos adjuntos como referencia para esta respuesta.');
    const next = { ...answers, [question.id]: reply };
    setDrafts(previous => ({ ...previous, [question.id]: value }));
    if (step + 1 < notice.request!.questions.length) { setAnswers(next); setStep(step + 1); setDraft(drafts[notice.request!.questions[step + 1]!.id] || ''); return; }
    setSending(true); setError('');
    try { await command({ action: 'answer', id: notice.id, answers: next, attachments: photoRef.current.map(photo => photo.id) }); }
    catch (reason) { if (alive.current) { setError((reason as Error).message); setSending(false); } }
  }
  function toggleChoice(label: string) {
    if (!question || sending) return;
    setChoices(previous => {
      const current = previous[question.id] || [];
      const next = current.includes(label) ? current.filter(value => value !== label) : question.multiSelect ? [...current, label] : [label];
      return { ...previous, [question.id]: next };
    });
    setError(''); show();
  }
  function addPhotos(files: File[]) {
    if (sending || !question) return;
    show(); uploads.current++; setPreparing(true); setError('');
    uploadQueue.current = uploadQueue.current.catch(() => {}).then(async () => {
      const failures: string[] = [];
      try {
        for (const file of files) {
          if (!alive.current) break;
          try {
            const limit = noticeAttachmentLimit(file.name, file.type);
            if (file.size > limit) throw Error(`El archivo debe pesar hasta ${limit / (1024 * 1024)} MB.`);
            if (photoRef.current.length >= NOTICE_ATTACHMENT_MAX_COUNT || photoRef.current.reduce((n, photo) => n + photo.size, file.size) > NOTICE_ATTACHMENT_MAX_TOTAL_BYTES) throw Error('Podés adjuntar hasta 4 archivos y 150 MB por respuesta.');
            const response = await command({ action: 'attach-file', id: notice.id, name: file.name || 'foto.png', bytes: new Uint8Array(await file.arrayBuffer()) });
            if (!response.attachedFile) throw Error('No se pudo preparar el archivo.');
            if (!alive.current) { await command({ action: 'remove-file', id: notice.id, attachmentId: response.attachedFile.id }).catch(() => {}); break; }
            photoRef.current = [...photoRef.current, response.attachedFile]; setPhotos(photoRef.current);
          } catch (reason) { failures.push((reason as Error).message); }
        }
      } finally {
        uploads.current--; if (alive.current) { setPreparing(uploads.current > 0); if (failures.length) setError([...new Set(failures)].join(' ')); }
      }
    });
  }
  async function removePhoto(imageId: string) {
    if (sending || uploads.current) return;
    try {
      await command({ action: 'remove-file', id: notice.id, attachmentId: imageId });
      if (alive.current) { photoRef.current = photoRef.current.filter(photo => photo.id !== imageId); setPhotos(photoRef.current); setError(''); }
    } catch (reason) { if (alive.current) setError((reason as Error).message); }
  }
  function dropPhotos(event: React.DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault(); event.stopPropagation(); dragDepth.current = 0; setDragging(false);
    const files = Array.from(event.dataTransfer.files); if (files.length) addPhotos(files);
  }
  // Electron forwards mouse move messages while this unfocused window is
  // click-through. Do not depend only on PointerEvent enter notifications.
  // The orb and message are one hover region so crossing between them is safe.
  return <article ref={row} className="quick-notice is-entering" data-kind={notice.kind}
    onMouseEnter={show} onMouseMove={() => { if (!expanded) show(); }} onMouseLeave={leave}
    onDragEnter={event => { if (question && event.dataTransfer.types.includes('Files')) { event.preventDefault(); show(); } }}
    onDragOver={event => { if (question && event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }}
    onDrop={dropPhotos}>
    <div ref={bubble} className="quick-bubble t-resize" data-expanded={expanded} style={{ '--reply-width': width + 'px', '--reply-height': height + 'px' } as React.CSSProperties}
      onBlur={leave}
      onFocus={event => { if (body.current?.contains(event.target)) show(); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setExpanded(false); head.current?.focus(); } }}>
      <button ref={head} className="quick-head" aria-expanded={expanded} aria-controls={'body-' + notice.id} onClick={() => { manualExpanded.current = null; show(); }}>
        <span className="quick-title"><i aria-hidden="true"/><span className="quick-title-label">{notice.title}</span></span>
        <span className="quick-project">{notice.projectName} · Syka Studio</span>
      </button>
      <button className="quick-project-link" title="Ver en Syka" aria-label={'Ver en Syka: ' + notice.projectName} onClick={() => void act('open')}><ArrowUpRight/></button>
      <button className="quick-close" aria-label={'Ocultar aviso: ' + notice.projectName} onClick={() => void act('dismiss')}><X size={12}/></button>
      <div ref={body} className="quick-body t-panel-slide" id={'body-' + notice.id} data-open={expanded} inert={!expanded}>
        {question && notice.request!.questions.length > 1 && <span className="question-progress">Pregunta {step + 1} de {notice.request!.questions.length}</span>}
        <p className="quick-question">{question?.question || notice.message}</p>
        {question?.context && <p className="quick-context">{question.context.slice(0, 800)}</p>}
        {!!question?.options.length && <div className="quick-choices" role="group" aria-label={question.multiSelect ? 'Podés elegir varias opciones' : 'Elegí una opción'}>
          {question.options.map(option => <button key={option.label} type="button" aria-pressed={selectedChoices.includes(option.label)}
            title={option.description || option.label} disabled={sending || preparing} onClick={() => toggleChoice(option.label)}>{option.label}</button>)}
        </div>}
        {question && expanded ? <div className="notification-reply" data-dragging={dragging}
          onPasteCapture={event => { const files = Array.from(event.clipboardData.files); if (files.length) { event.preventDefault(); event.stopPropagation(); addPhotos(files); } }}
          onDragEnter={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth.current++; setDragging(true); show(); } }}
          onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }}
          onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
          onDrop={dropPhotos}>
          <AgentComposer key={question.id} value={draft} onChange={setDraft} onSubmit={submit}
          placeholder="Tu respuesta…" ariaLabel={'Respuesta para ' + notice.projectName}
          submitLabel={step + 1 < notice.request!.questions.length ? 'Siguiente pregunta' : 'Enviar respuesta a ' + notice.projectName}
          variant="reference" dictationContext={'notification-' + notice.request!.id + '-' + question.id}
          queueEnabled={false} maxRows={5} disabled={sending || preparing} hasContext={selectedChoices.length > 0} className="notification-native-composer"
          attachments={photos.map(photo => ({ ...photo, state: 'available' as const }))} attachmentPresentation="compact"
          onFiles={addPhotos} onRemoveAttachment={imageId => void removePhoto(imageId)} accept={NOTICE_ATTACHMENT_ACCEPT}/>
          {preparing ? <span className="notice-photo-status" role="status">Preparando archivo…</span> : null}
          </div>
          : !question ? <div className="quick-result-action"><button className="quick-open" onClick={() => void act(notice.kind === 'export' && notice.artifact ? 'artifact' : 'open')}>{notice.kind === 'export' ? 'Ver archivo' : notice.kind === 'auth' ? 'Conectar proveedor' : 'Ver en Syka'} <ArrowUpRight size={11}/></button></div> : null}
        {step > 0 && <button className="quick-back" disabled={sending || preparing} onClick={() => { setDrafts(previous => ({ ...previous, [question!.id]: draft })); setStep(step - 1); setDraft(drafts[notice.request!.questions[step - 1]!.id] || ''); }}>Pregunta anterior</button>}
        {!!error && <p role="alert" className="notice-error">{error}</p>}
      </div>
    </div>
    <button className="floating-orb" aria-label={(expanded ? 'Contraer aviso: ' : 'Expandir aviso: ') + notice.projectName} aria-expanded={expanded} aria-controls={'body-' + notice.id} data-expanded={expanded} onClick={toggleOrb}>
      <canvas ref={canvas}/><span className="notice-badge">{notice.kind === 'question' ? notice.request?.questions.length || '1' : ['blocked', 'auth'].includes(notice.kind) ? '!' : '✓'}</span>
    </button>
  </article>;
}

function Notifications() {
  const [state, setState] = useState<NoticeSnapshot>({ notices: [], accent: '#008cff', sound: true });
  const stack = useRef<HTMLDivElement>(null), seen = useRef(new Set<string>()), lastSound = useRef(0);
  useLayoutEffect(() => {
    if (document.activeElement?.closest('.quick-body')) return;
    const frame = requestAnimationFrame(() => { if (stack.current) stack.current.scrollTop = stack.current.scrollHeight; });
    return () => cancelAnimationFrame(frame);
  }, [state.notices.length]);
  useEffect(() => {
    let disposed = false, current = 0;
    const apply = (data: NoticeSnapshot) => {
      if (disposed) return;
      current++;
      const fresh = data.notices.some(n => !seen.current.has(n.id));
      for (const notice of data.notices) seen.current.add(notice.id);
      while (seen.current.size > 1000) seen.current.delete(seen.current.values().next().value!);
      for (const [key, value] of Object.entries(accentTokens(data.accent, true))) document.documentElement.style.setProperty(key, value);
      setState(data);
      if (fresh && data.sound && Date.now() - lastSound.current >= 10_000 && localStorage.getItem('syka:chat-question-sound') !== 'off') { lastSound.current = Date.now(); sound.currentTime = 0; void sound.play().catch(console.error); }
    };
    const off = mainBridge.handle(MAIN_CHANNELS.SYKA_NOTICES_CHANGED, apply);
    const revision = current;
    void command({ action: 'list' }).then(data => { if (current === revision) apply(data); }).catch(console.error);
    let interactive = false;
    const pointer = (event: MouseEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const next = !!target?.closest('.quick-bubble, .floating-orb');
      if (next !== interactive) { interactive = next; void command({ action: 'interactive', value: next }).catch(console.error); }
    };
    const leave = () => { interactive = false; void command({ action: 'interactive', value: false }).catch(console.error); };
    document.addEventListener('mousemove', pointer); document.addEventListener('mousedown', pointer); document.addEventListener('mouseleave', leave);
    document.addEventListener('pointermove', pointer); document.addEventListener('pointerdown', pointer);
    // A reload/HMR can happen while the native window is still interactive.
    leave();
    return () => { disposed = true; off(); sound.pause(); document.removeEventListener('mousemove', pointer); document.removeEventListener('mousedown', pointer); document.removeEventListener('mouseleave', leave); document.removeEventListener('pointermove', pointer); document.removeEventListener('pointerdown', pointer); leave(); };
  }, []);
  useLayoutEffect(() => {
    const element = stack.current;
    if (!element) return;
    let previous = '', frame = 0, settleUntil = 0;
    const fit = () => {
      frame = 0;
      const regions: NoticeRegion[] = [];
      const clip = element.getBoundingClientRect();
      for (const node of element.querySelectorAll<HTMLElement>('.quick-bubble, .floating-orb, .notice-badge')) {
        const rect = node.getBoundingClientRect();
        if (rect.bottom <= clip.top || rect.top >= clip.bottom) continue;
        const padding = node.matches('.quick-bubble') ? 5 : 2;
        const x = Math.max(0, rect.left - padding), y = Math.max(clip.top, rect.top - padding);
        const right = Math.min(innerWidth, rect.right + padding), bottom = Math.min(clip.bottom, rect.bottom + padding);
        regions.push({ x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y),
          radius: node.matches('.floating-orb') ? 0 : (parseFloat(getComputedStyle(node).borderRadius) || 0) + padding });
      }
      if (element.scrollHeight > element.clientHeight + 1) regions.push({ x: clip.right - 9, y: clip.top, width: 9, height: clip.height, radius: 3 });
      const payload: NoticeCommand = { action: 'layout', width: 370, height: Math.ceil(element.scrollHeight) + 18, regions };
      const key = JSON.stringify(payload);
      if (key !== previous) { previous = key; void command(payload).catch(console.error); }
      // Sample only during arrival/resize transitions. No idle polling.
      if (performance.now() < settleUntil) frame = requestAnimationFrame(fit);
    };
    const schedule = () => { settleUntil = performance.now() + 500; if (!frame) frame = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    const observe = () => { for (const row of element.children) observer.observe(row); schedule(); };
    const changes = new MutationObserver(observe); changes.observe(element, { childList: true }); observe();
    element.addEventListener('scroll', schedule, { passive: true });
    element.addEventListener('transitionrun', schedule);
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); changes.disconnect(); element.removeEventListener('scroll', schedule); element.removeEventListener('transitionrun', schedule); window.removeEventListener('resize', schedule); };
  }, []);
  return <div className="notice-stack" ref={stack} role="region" aria-label="Avisos de Syka Studio">{state.notices.map(notice => <Notification key={notice.id} notice={notice}/>)}</div>;
}
createRoot(document.getElementById('syka-notices')!).render(<Notifications/>);
