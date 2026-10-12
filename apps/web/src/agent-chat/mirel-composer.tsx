import { createEffect, createSignal, onMount, onCleanup, createMemo } from 'solid-js';
import { createRoot, type Root } from '@/lib/react-root';
import { t } from '@/i18n';
import { createElement, Fragment } from 'react';
import { BookOpen, FolderOpen, Globe2, ImagePlus, ListTodo, MousePointer2, Palette, PencilLine, Plug, Puzzle, Scan, Video } from 'lucide-react';
import { toast } from 'somoto';
import { useLocation } from '@solidjs/router';
import { modelLogo, modelRouteDescription } from './provider-catalog';
import { AgentComposer, type AgentComposerProps } from '@/mirel-chat/features/agents/agent-composer';
import { mainBridge } from '@/lib/ipc';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import type { ContextUsage, ModelRef, MessageQueue } from '@diffusionstudio/agent-chat';
import { attachmentFromPath, createDropZone, mergeAttachments, type Attachment } from './attachments';
import { chatState, ensureConnected, refreshHarnesses, pickerHarnesses } from './store';
import { prepareChatFiles } from './local-attachments';
import './mirel-adapter.css';
import './chat-panel-motion.css';
import { VisualReviewTray } from './visual-review-tray';
import { openSettings } from '@/components/settings/state';
import { setVisualPickMode, VISUAL_SELECT_SHORTCUT, SCREEN_RECORDING_REQUEST } from './visual-target-state';
import { visualNotes } from './visual-review-state';
import { ScreenRecordingPanel } from '@/mirel-chat/features/agents/screen-recording-panel';
import type { CapturedRecording } from '@/lib/screen-recorder';

type ComposerProps = {
  projectDir: string;
  resolveProjectDir?: () => Promise<string | null>;
  placeholder?: string;
  answering?: boolean;
  submitLabel?: string;
  ariaLabel?: string;
  chatKey: string;
  text: string;
  contextUsage?: ContextUsage;
  attachments: Attachment[];
  onText(text: string): void;
  onAttachments(attachments: Attachment[]): void;
  onReferenceDrop?(transfer: DataTransfer | null): boolean;
  running: boolean;
  waiting: boolean;
  blocked: string | null;
  model: ModelRef | null;
  onModel(ref: ModelRef): void;
  onSend(): void;
  onStop(): void;
  queue?: MessageQueue;
  queueEnabled?: boolean;
  submitting?: boolean;
  supportsSteering?: boolean;
  redirectingQueueId?: string | null;
  onRedirectQueued?(id: string): void;
  onEditQueued?(id: string): void;
  onDeleteQueued?(id: string): void;
  onResumeQueue?(): void;
};

/** Current Mirel React composer mounted explicitly inside Solid. */
export function Composer(props: ComposerProps) {
  const location = useLocation();
  ensureConnected();
  let element!: HTMLDivElement;
  let root: Root;
  let alive = true;
  const previews = new Set<string>();
  const [pendingFiles, setPendingFiles] = createSignal(0);
  const preparing = () => pendingFiles() > 0;
  const [attachmentError, setAttachmentError] = createSignal<string | null>(null);
  type RecordingSession = { key: string; dir: string; id: string; region: boolean; video?: Attachment; voice?: Attachment; transcript?: Attachment };
  const [recordingSession, setRecordingSession] = createSignal<RecordingSession | null>(null);
  const recordingContextValid = (session: RecordingSession) => alive && props.chatKey === session.key && (props.projectDir === session.dir || !!props.resolveProjectDir);
  const openRecording = async (region=false) => {
    try {
      const key = props.chatKey;
      const dir = props.projectDir || await props.resolveProjectDir?.();
      if (dir && alive && key === props.chatKey) setRecordingSession({ key, dir, region, id: crypto.randomUUID().slice(0, 8) });
    } catch (error) { toast.error('No se pudo preparar la grabación', { description: String(error) }); }
  };
  const saveRecording = async (session: RecordingSession, recording: CapturedRecording) => {
    if (!recordingContextValid(session)) throw new Error('El chat cambió. La grabación pertenece al proyecto anterior.');
    setPendingFiles(n => n + 1);
    try {
      // Retain each successful file on retry, including the isolated speech track.
      if (!session.video) session.video = { ...attachmentFromPath(recording.path), mimeType: 'video/mp4', size: recording.size };
      if (!recordingContextValid(session)) throw new Error(`El video quedó guardado en ${session.dir}. Volvé al chat original para adjuntarlo.`);
      props.onAttachments(mergeAttachments(props.attachments, [session.video]));
      if (recording.microphonePath && !session.voice) session.voice = { ...attachmentFromPath(recording.microphonePath), mimeType: 'audio/wav' };
    } finally { if (alive) setPendingFiles(n => n - 1); }
  };
  const saveRecordingTranscript = async (session: RecordingSession, text: string) => {
    if (!recordingContextValid(session)) throw new Error('Volvé al chat original para insertar la transcripción.');
    if (!session.transcript) [session.transcript] = await prepareChatFiles([new File([text], `pantalla-${session.id}.transcript.txt`, { type: 'text/plain' })], session.dir);
    if (!recordingContextValid(session)) throw new Error(`La transcripción quedó guardada en ${session.dir}.`);
    props.onAttachments(mergeAttachments(props.attachments, [session.transcript]));
    props.onText([props.text.trimEnd(), text].filter(Boolean).join('\n\n'));
  };
  const drop = createDropZone(entries => props.onAttachments(mergeAttachments(props.attachments, entries)), transfer => props.onReferenceDrop?.(transfer) ?? false, files => void onFiles(files));
  const modelOptions = createMemo(() => pickerHarnesses().filter(h => h.status === 'ready').flatMap(h => h.models.map(m => ({
    id: `${h.id}:${m.id}`, label: m.label, description: t(modelRouteDescription(h.id,m.id)), routeLabel:h.id==='antigravity'?t('vía Antigravity'):undefined, logoSvg: modelLogo(h.id, m.id), supportsFast: m.supportsFast === true,
  }))));
  const selected = createMemo(() => chatState.harnesses.find(h => h.id === props.model?.harness)?.models.find(m => m.id === props.model?.model));
  const onFiles = async (files: File[]) => {
    const chatKey = props.chatKey;
    setPendingFiles(n => n + 1); setAttachmentError(null);
    try {
      const dir = props.projectDir || await props.resolveProjectDir?.();
      if (!dir) return;
      const entries = await prepareChatFiles(files, dir);
      for (const entry of entries) if (entry.previewUrl) previews.add(entry.previewUrl);
      if (alive && props.chatKey === chatKey && (props.projectDir === dir || props.resolveProjectDir)) props.onAttachments(mergeAttachments(props.attachments, entries));
    } catch (error) {
      if (alive) { setAttachmentError(String(error)); toast.error('No se pudo adjuntar', { description: String(error) }); }
    } finally { if (alive) setPendingFiles(n => n - 1); }
  };
  onMount(() => {
    const requested=(event:Event)=>{
      const detail=(event as CustomEvent<{region?:boolean;chatKey?:string}>).detail;
      if(event.defaultPrevented||!detail||detail.chatKey!==props.chatKey||props.answering||!element.getClientRects().length)return;
      event.preventDefault();void openRecording(detail.region===true);
    };
    window.addEventListener(SCREEN_RECORDING_REQUEST,requested);
    onCleanup(()=>window.removeEventListener(SCREEN_RECORDING_REQUEST,requested));
    root = createRoot(element);
    void refreshHarnesses();
    createEffect(() => {
      const capture = recordingSession();
      if (capture && capture.key !== props.chatKey) setRecordingSession(null);
      const ref = props.model;
      const model = selected();
      const adapted: AgentComposerProps = {
        value: props.text, onChange: props.onText, onSubmit: props.onSend,
        hasContext: !props.answering && visualNotes(props.chatKey).length > 0,
        placeholder: t(props.placeholder ?? props.blocked ?? '¿Qué querés cambiar en este video?'), ariaLabel: t(props.ariaLabel ?? 'Mensaje al editor'), submitLabel:t(props.submitLabel),
        disabled: !!props.blocked || (!props.answering && props.waiting) || !!props.submitting || preparing(), working: props.running && !props.answering, onStop: props.onStop,
        allowWhileWorking: true, queueEnabled: props.answering ? false : props.queueEnabled ?? true,
        queuedMessages: (props.queue?.messages ?? []).map(message => ({ id: message.id, content: message.text, attachments: message.attachments.map(path => { const a = attachmentFromPath(path); return { id: a.key, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', size: a.size ?? 0, state: 'available' as const }; }) })),
        redirectingQueueId: props.redirectingQueueId,
        onRedirectQueued: props.running && !props.waiting && props.supportsSteering ? props.onRedirectQueued : undefined,
        onEditQueued: props.onEditQueued, onDeleteQueued: props.onDeleteQueued,
        attachments: props.attachments.map(a => ({
          id:a.key, name:a.name, mimeType:a.mimeType ?? 'application/octet-stream', size:a.size ?? 0, previewUrl:a.previewUrl,
          detail: a.reference || !a.mimeType?.startsWith('image/') ? {
            instruction:a.reference?.instruction, context:a.reference?.context, path:a.path ?? undefined,
            kind:t(a.reference ? 'Referencia para el agente' : a.kind === 'folder' ? 'Carpeta adjunta' : 'Archivo adjunto'),
            onReveal:a.path ? () => { void mainBridge.call(MAIN_CHANNELS.APP_SHOW_IN_FOLDER, {path:a.path!}).catch(error => toast.error('No se pudo mostrar el archivo', {description:String(error)})); } : undefined,
          } : undefined,
          hidden:a.purpose==='visual-review-context'||(a.mimeType==='application/json'&&/^(?:.*-)?revision-visual\.json$/iu.test(a.name)&&props.text.includes('Correcciones visuales (')), state:'available',
        })),
        maxRows: 3,
        onFiles: files => void onFiles(files), onRemoveAttachment: id => props.onAttachments(props.attachments.filter(a => a.key !== id)),
        models: modelOptions(), selectedModelId: ref ? `${ref.harness}:${ref.model}` : undefined,
        selectedModelOption: ref && model ? { id: `${ref.harness}:${ref.model}`, label: model.label, description:t(modelRouteDescription(ref.harness,ref.model)), routeLabel:ref.harness==='antigravity'?t('vía Antigravity'):undefined, logoSvg: modelLogo(ref.harness, ref.model) } : undefined,
        onConfigureProviders: () => openSettings('codex'),
        onModelChange: props.answering ? undefined : id => {
          const separator = id.indexOf(':');
          const harness = chatState.harnesses.find(h => h.id === id.slice(0, separator));
          if (harness) props.onModel({harness:harness.id,model:id.slice(separator + 1)});
        },
        efforts: (model?.efforts ?? []).map(id => {
          const label = ({none:'Sin esfuerzo',minimal:'Mínimo',low:'Bajo',medium:'Medio',high:'Alto',xhigh:'Extra alto',max:'Máximo',ultra:'Ultra'} as Record<string,string>)[id];
          return {id,label:label === undefined ? id : t(label)};
        }),
        selectedEffortId: ref?.effort ?? model?.defaultEffort,
        onEffortChange: props.answering ? undefined : effort => { if (ref) props.onModel({...ref,effort}); },
        modelFallbackLabel: t(props.blocked ?? 'Cargando modelos…'), fastAvailable: model?.supportsFast === true,
        fast: ref?.fast === true && model?.supportsFast === true,
        onFastChange: props.answering ? undefined : fast => {if(ref) props.onModel({...ref,fast});},
        fastUnavailableReason: t(!model ? 'Elegí un modelo conectado.' : ref?.harness !== 'codex' ? 'Este proveedor no ofrece modo rápido.' : 'Codex no ofrece modo rápido para este modelo en tu cuenta.'),
        dictationContext: props.chatKey, contextUsage:props.contextUsage,
        notice: attachmentError() ?? (preparing() ? t('Guardando adjuntos en el proyecto…') : null), accept: '*',
        menuActions: [
          {id:'select',label:'Señalar componentes',icon:createElement(MousePointer2,{size:16}),hint:VISUAL_SELECT_SHORTCUT,description:'Ctrl + clic suma componentes. Soltá Ctrl para escribir una corrección conjunta.',disabled:!location.pathname.startsWith('/projects/'),onSelect:()=>setVisualPickMode('element')},
          {id:'folder',label:'Adjuntar carpeta',icon:createElement(FolderOpen,{size:16}),description:'Elegí una carpeta local para darle contexto al agente.',onSelect:async()=>{try{const key=props.chatKey,path=await mainBridge.call(MAIN_CHANNELS.PROJECTS_PICK_FOLDER,undefined);if(path&&alive&&key===props.chatKey)props.onAttachments(mergeAttachments(props.attachments,[{...attachmentFromPath(path),kind:'folder'}]));}catch(error){toast.error('No se pudo adjuntar la carpeta',{description:String(error)});}}},
          {id:'capture',label:'Capturar una zona del video',icon:createElement(Scan,{size:16}),description:location.pathname.startsWith('/projects/')?'Marcá una zona de la preview y agregala como referencia.':'Abrí un proyecto para marcar su preview.',disabled:!location.pathname.startsWith('/projects/'),onSelect:()=>setVisualPickMode('region')},
          {id:'record',label:'Grabar pantalla',icon:createElement(Video,{size:16}),description:'Pantalla, micrófono y audio del sistema. Tu voz se transcribe al chat.',onSelect:()=>{void openRecording();}},
          {id:'plan',label:'Modo plan',section:'Crear',icon:createElement(ListTodo,{size:16}),description:'Prepará un pedido de planificación para revisar antes de editar.',onSelect:()=>props.onText('Primero armá un plan y esperá mi aprobación antes de editar. '+props.text)},
          {id:'draw',label:'Dibujar sobre el video',icon:createElement(PencilLine,{size:16}),accent:true,description:location.pathname.startsWith('/projects/')?'Dibujá una marca sobre la preview para explicar un cambio.':'Abrí un proyecto para dibujar sobre su preview.',disabled:!location.pathname.startsWith('/projects/'),onSelect:()=>setVisualPickMode('draw')},
          {id:'web',label:'Buscar referencias en la web',icon:createElement(Globe2,{size:16}),description:'Prepará un pedido de búsqueda para el modelo del chat.',onSelect:()=>props.onText('Buscá en la web referencias para '+props.text)},
          {id:'image',label:'Generar una imagen',icon:createElement(ImagePlus,{size:16}),description:'Prepará un pedido de imagen con el contexto de este video.',onSelect:()=>props.onText('Generá una imagen para este video: '+props.text)},
          {id:'skills',label:'Skills',section:'Herramientas',icon:createElement(BookOpen,{size:16}),description:'Revisá y administrá las skills disponibles para los agentes.',onSelect:()=>openSettings('skills')},
          {id:'connectors',label:'Conectar un proveedor',icon:createElement(Plug,{size:16}),description:'Conectá cuentas, modelos y herramientas del agente.',onSelect:()=>openSettings('codex')},
          {id:'brand',label:'Identidad de marca',icon:createElement(Palette,{size:16}),description:'Configurá la marca, la tipografía y los colores del proyecto.',onSelect:()=>openSettings('brand-kit')},
          {id:'plugins',label:'Plugins y complementos',icon:createElement(Puzzle,{size:16}),accent:true,description:'Administrá los complementos de Syka y sus capacidades.',onSelect:()=>openSettings('plugins')},
        ].map(action => ({...action,label:t(action.label),description:t(action.description),section:t(action.section)})),

      };
      root.render(createElement(Fragment, null, createElement(AgentComposer, adapted), capture && capture.key === props.chatKey ? createElement(ScreenRecordingPanel, {
        key: capture.id, contextKey: capture.key, projectDir: capture.dir, initialRegion:capture.region, onDismiss: () => setRecordingSession(null),
        onSave: (recording: CapturedRecording) => saveRecording(capture, recording),
        onTranscript: (text: string) => saveRecordingTranscript(capture, text), onConfigure: () => openSettings('groq'),
      }) : null));
    });
  });
  onCleanup(() => {
    alive = false;
    root?.unmount();
    // Drafts outlive this view (tab switches, floating/docked chat). Never
    // remove their previews just because the composer is being remounted.
    for (const url of previews) if (!props.attachments.some(entry => entry.previewUrl === url)) URL.revokeObjectURL(url);
  });
  return <div class="syka-mirel-composer" classList={{'is-dragging':drop.dragging()}}
    onDragEnter={drop.onDragEnter} onDragLeave={drop.onDragLeave} onDragOver={drop.onDragOver} onDrop={drop.onDrop}
    onKeyDown={e=>e.stopPropagation()} onKeyUp={e=>e.stopPropagation()}
    onPaste={event=>{const files=Array.from(event.clipboardData?.files ?? []);if(files.length){event.preventDefault();void onFiles(files);}}}>
    {props.queue?.paused && props.queue.messages.length ? <div class="syka-composer-queue-control">
      <span>Cola pausada</span>
      <button type="button" onClick={() => props.onResumeQueue?.()}>Reanudar</button>
    </div> : null}
    <VisualReviewTray chatKey={props.chatKey} disabled={!!props.blocked || !!props.answering || props.waiting || !!props.submitting || preparing()} submitting={!!props.submitting} onSend={props.onSend}/>
    <div ref={element} class="syka-composer-react-root"/>
    {drop.dragging() ? <div class="syka-composer-drop-hint" role="status">Soltá archivos o referencias para el agente</div> : null}
  </div>;
}
