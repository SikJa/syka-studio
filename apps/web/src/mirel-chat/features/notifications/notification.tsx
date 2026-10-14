/** @jsxImportSource react */
import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type CSSProperties } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { AgentComposer } from '../agents/agent-composer';
import { mainBridge } from '@/lib/ipc';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { attachOrb, wakeOrbs } from './orb';
import { noticeMascotActivity } from '@/agent-chat/mascot-activity';
import { NOTICE_ATTACHMENT_ACCEPT, NOTICE_ATTACHMENT_MAX_COUNT, NOTICE_ATTACHMENT_MAX_TOTAL_BYTES, noticeAttachmentLimit } from '../../../../../../packages/agent-chat/src/notifications';
import type { NoticeCommand, NoticeImage, NoticeSnapshot, StudioNotice } from '../../../../../../packages/agent-chat/src/notifications';
import { pulseOrb } from '@/lib/orb-motion';

const nativeNoticeCommand = (data: NoticeCommand) => mainBridge.call(MAIN_CHANNELS.SYKA_NOTIFICATIONS, data);

// eslint-disable-next-line solid/no-destructure -- This is a React island.
export function Notification({ notice, command = nativeNoticeCommand }: { notice: StudioNotice; command?: (data: NoticeCommand) => Promise<NoticeSnapshot> }) {
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
    const detach = canvas.current ? attachOrb(canvas.current, noticeMascotActivity(notice.kind)) : () => {};
    return () => { alive.current = false; clearTimeout(closeTimer.current); detach(); };
  }, [notice.kind]);
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
  function dropPhotos(event: DragEvent) {
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
    <div ref={bubble} className="quick-bubble t-resize" data-expanded={expanded} style={{ '--reply-width': width + 'px', '--reply-height': height + 'px' } as CSSProperties}
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

