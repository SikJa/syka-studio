/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The chat for the open project: header (tabs and actions), transcript,
// the question card when one is pending, and the composer at the bottom.
// The panel is a view over the module-level store; it can be unmounted
// (tab switch, page change) without touching a running turn.

import { Show, createEffect, createMemo, createSignal, onCleanup, onMount, on } from "solid-js";
import { toast } from "somoto";
import { useWorld } from "@diffusionstudio/koota-solid";

import { Button } from "@/components/ui/button";
import { useProject } from "@/context/project";
import { useLibrary } from "@/engine/library";
import { insertAssetAtPlayhead } from "@/engine/asset-actions";
import { downloadDesktopApp } from "@/lib/desktop-app";

import type { ModelRef, PendingRequest } from "@diffusionstudio/agent-chat";

import { attachmentPaths, attachmentFromPath, mergeAttachments } from "./attachments";
import { prepareDroppedChatFiles } from './local-attachments';
import { loadVisualNotes, flushVisualNotes, visualNotes, removeVisualNote, addVisualNote } from './visual-review-state';
import { prepareVisualReview } from './prepare-visual-review';
import { prepareReferences } from './prepare-references';
import { Composer } from "./mirel-composer";
import { ChatIdentityHeader } from './chat-identity-header';
import {mascotActivity,mascotTimelineTool} from './mascot-activity';
import {emitMascotCue} from './mascot-journey';
import { ChatPlacementControl } from './chat-placement-control';
import { QuestionCard } from "./question-card";
import {QuestionNotice} from './question-notice';
import {questionResponse} from './question-response';
import {installQuestionAudio,playQuestionNotice} from './question-notice-audio';
import type {QuestionNoticePhase} from '@/mirel-chat/features/agents/agent-question-notice';
import { RecentChats } from "./recent-chats";
import { SidebarTabs } from "./sidebar-tabs";
import {
  activeChatId,
  blockedReason,
  chatState,
  clearDraft,
  currentModel,
  createChat,
  draft,
  draftKey,
  ensureConnected,
  interrupt,
  openChat,
  refreshChats,
  respond,
  send,
  enqueue,
  removeQueued,
  redirectQueued,
  resumeQueue,
  steer,
  setActiveChat,
  setDraftAttachments,
  setDraftText,
  setStoredModel,
  storedModel,
  summaryOf,
  transcriptOf,
} from "./store";
import {SessionRail} from './session-rail';
import {ScheduledTasks} from './scheduled-tasks';
import {setScheduleContext} from './local-schedules';
import { ChatActionsContext } from "./mirel-messages";
import { Transcript } from "./transcript";
import { generatedImageOutput, registerGeneratedImage } from "./generated-assets";
import { GeneratedImagesContext, type GeneratedImageRegistration } from './image-generation-item';
import { imagePathsForMessage } from './image-message-presentation';
import { fullscreenChatMount, chatFloating } from './chat-presentation';
import { LINKED_RESOURCE_DRAG_TYPE, readLinkedResourceDrop } from '@/engine/linked-resource-drag';
import { RESOURCE_DRAG_TYPE, RESOURCE_PREVIEW_DRAG_TYPE } from '@/components/sidebar-right/library-model';
import { getEditorResources } from '@/components/sidebar-right/resources';
import { linkedReferenceInstruction, referenceInChat, selectionContext } from './visual-context';

export function ChatPanel() {
  const project = useProject();
  const world = useWorld();
  const [sessionsOpen,setSessionsOpen]=createSignal(false),[scheduledOpen,setScheduledOpen]=createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [redirectingQueueId, setRedirectingQueueId] = createSignal<string | null>(null);
  const [fullscreenHistory, setFullscreenHistory] = createSignal(false);
  createEffect(() => { if (!fullscreenChatMount()) setFullscreenHistory(false); });
  const linkedChat=new URLSearchParams(window.location.hash.split('?')[1]??'').get('chat');
  if(linkedChat)setActiveChat(project.id(),linkedChat);

  const library = useLibrary();
  ensureConnected();

  createEffect(() => void refreshChats(project.id()));

  const chatId = createMemo(() => activeChatId(project.id()));
  createEffect(() => {
    const id = chatId();
    if (id) openChat(id);
  });

  const transcript = createMemo(() => transcriptOf(chatId()));
  const summary = createMemo(() => summaryOf(project.id(), chatId()));
  const key = createMemo(() => draftKey(project.id(), chatId()));
  const current = createMemo(() => draft(key()));
  let chatElement!:HTMLDivElement;
  const [questionView,setQuestionView]=createSignal<PendingRequest|null>(null);
  const [questionPhase,setQuestionPhase]=createSignal<QuestionNoticePhase>('source');
  const [questionIndex,setQuestionIndex]=createSignal(0),[questionSelected,setQuestionSelected]=createSignal<string[]>([]);
  const [questionAnswers,setQuestionAnswers]=createSignal<Record<string,string[]>>({}),[answering,setAnswering]=createSignal(false);
  const questionDraftKey=(index=questionIndex())=>`${key()}:question:${questionView()?.id}:${index}`;
  const composerKey=()=>questionView()?questionDraftKey():key();
  const composerDraft=()=>draft(composerKey());
  const noticeTimers=new Set<ReturnType<typeof setTimeout>>();
  const later=(fn:()=>void,ms:number)=>{const timer=setTimeout(()=>{noticeTimers.delete(timer);fn();},ms);noticeTimers.add(timer);};
  const clearNoticeTimers=()=>{noticeTimers.forEach(clearTimeout);noticeTimers.clear();};
  onMount(()=>onCleanup(installQuestionAudio()));
  onMount(()=>{
    const trapQuestionFocus=(event:KeyboardEvent)=>{
      if(!questionView()||event.key!=='Tab'||event.defaultPrevented||document.activeElement?.closest('.agent-image-lightbox-backdrop'))return;
      const nodes=[...chatElement.querySelectorAll<HTMLElement>('.syka-question-options button,.syka-question-cancel,.syka-mirel-composer button:not(:disabled),.syka-mirel-composer textarea:not(:disabled)')].filter(node=>node.tabIndex>=0&&node.getClientRects().length);
      const first=nodes[0],last=nodes.at(-1);if(!first||!last)return;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    chatElement.addEventListener('keydown',trapQuestionFocus,true);
    onCleanup(()=>chatElement.removeEventListener('keydown',trapQuestionFocus,true));
  });
  onCleanup(clearNoticeTimers);
  createEffect(on(()=>transcript().pending,request=>{
    // Reconnecting replaces the snapshot object, not the user's question.
    // Preserve choices and the current step while that request is still open.
    if(request?.id===questionView()?.id && request && questionPhase()!=='closing') {
      setQuestionView(request);
      return;
    }
    clearNoticeTimers();
    if(request&&!request.questions.some(question=>question.secret)){
      setQuestionView(request);setQuestionIndex(0);setQuestionSelected([]);setQuestionAnswers({});
      if(fullscreenChatMount())setFullscreenHistory(true);
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      setQuestionPhase(reduced?'question':'source');
      if(reduced)playQuestionNotice();
      else{later(()=>setQuestionPhase('arriving'),120);later(()=>{setQuestionPhase('question');playQuestionNotice();},200);}
    }else if(questionView()){
      setQuestionPhase('closing');later(()=>setQuestionView(null),matchMedia('(prefers-reduced-motion: reduce)').matches?0:200);
    }
  }));
  const optimistic = () => chatState.sending[key()] ?? null;
  const items = createMemo(() => {
    const pending = optimistic();
    return pending ? [...transcript().items, pending] : transcript().items;
  });

  const [generatedAssets, setGeneratedAssets] = createSignal(new Map<string, GeneratedImageRegistration>());
  const completedImages = createMemo(() => items().filter(item => generatedImageOutput(item)), [], {
    equals: (previous, next) => previous.length === next.length && previous.every((item, index) => item.id === next[index].id && 'output' in item && 'output' in next[index] && item.output === next[index].output),
  });
  let registrations = 0;
  let disposed = false;
  onCleanup(() => { disposed = true; registrations++; });
  createEffect(() => {
    const attached = library();
    const dir = project.dir();
    const candidates = completedImages();
    const current = ++registrations;
    if (!attached || !candidates.length) setGeneratedAssets(new Map());
    if (!attached || !candidates.length) return;
    void Promise.allSettled(candidates.map(item => registerGeneratedImage(attached, dir, item))).then(results => {
      if (disposed || registrations !== current) return;
      const assets = new Map<string, GeneratedImageRegistration>();
      for (const [index, result] of results.entries()) {
        if (result.status === "fulfilled" && result.value) assets.set(candidates[index].id, {asset: result.value});
        else if (result.status === "rejected") {
          const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
          assets.set(candidates[index].id, {error});
          toast.error("No se pudo agregar la imagen a la biblioteca", { description: error });
        }
      }
      setGeneratedAssets(assets);
    });
  });

  const running = () => summary()?.status === "running" || summary()?.status === "waiting" || optimistic() !== null;
  const waiting = () => transcript().pending !== null;
  const mascot = createMemo(()=>mascotActivity(items(),running(),waiting()));
  const mascotToolsSeen = new Set<string>();
  createEffect(()=>{
    const tool=mascotTimelineTool(items(),running());
    if(!tool||waiting())return;
    const id=key()+':'+tool.id;
    if(mascotToolsSeen.has(id))return;
    mascotToolsSeen.add(id);
    if(mascotToolsSeen.size>100)mascotToolsSeen.delete(mascotToolsSeen.values().next().value!);
    emitMascotCue(project.id(),{kind:'timeline'});
  });
  const empty = () => items().length === 0;

  // The composer's model: in a chat, one of that chat's harness; in a draft,
  // whatever is remembered and ready.
  const model = createMemo<ModelRef | null>(() => {
    const chat = summary();
    const remembered = storedModel();
    if (chat) return remembered && remembered.harness === chat.harness ? remembered : { harness: chat.harness, model: chat.model };
    return currentModel();
  });

  createEffect(()=>setScheduleContext({projectId:project.id(),cwd:project.dir(),model:model(),busy:running()}));
  const supportsSteering = createMemo(() => chatState.harnesses.find(h => h.id === model()?.harness)?.supportsSteering === true);

  const [sendCount, setSendCount] = createSignal(0);

  const handleModel = (ref: ModelRef) => {
    setStoredModel(ref);
    const chat = summary();
    // A chat keeps its harness: another harness means a new draft, with the
    // typed text carried over.
    if (chat && chat.harness !== ref.harness && !empty()) {
      const carried = current();
      setActiveChat(project.id(), null);
      const next = draftKey(project.id(), null);
      setDraftText(next, carried.text);
      setDraftAttachments(next, carried.attachments);
      clearDraft(key());
    }
  };

  const handleSend = () => {
    if (questionView() || waiting()) return;
    const ref = model();
    const { text, attachments } = current();
    if (submitting() || !ref || (!text.trim() && attachments.length === 0 && !visualNotes(key()).length)) return;
    if (text.trim() === '/stop') { clearDraft(key()); handleStop(); return; }
    const command = /^\/steer(?:\s+|$)/.exec(text.trimStart());
    const instruction = command ? text.trimStart().slice(command[0].length).trim() : text;
    if (command && (!running() || !supportsSteering() || !instruction)) { toast.error('La instrucción /steer necesita un turno activo compatible y un mensaje.'); return; }
    if (/^\/(?:background|bg|btw)(?:\s|$)/.test(text.trim())) { toast.error('Este asistente no ofrece una tarea paralela desde el composer. Dejá el mensaje en cola o abrí otro chat.'); return; }
    const sendKey = key();
    const id = chatId();
    const dir = project.dir();
    const options = { projectId: project.id(), cwd: dir, chatId: id, text, attachments: attachmentPaths(attachments), model: ref };
    clearDraft(sendKey);
    setSubmitting(true);
    const queue = running() || !!transcript().queue?.messages.length;
    const action = (async () => {
      await loadVisualNotes(sendKey);
      const notes = JSON.parse(JSON.stringify(visualNotes(sendKey))) as ReturnType<typeof visualNotes>;
      const referenced = await prepareReferences(command ? instruction : text, attachments, dir);
      const prepared = await prepareVisualReview(referenced.text, referenced.attachments, notes, dir);
      const payload = {...options, text:prepared.text, attachments:attachmentPaths(prepared.attachments)};
      let destination = id;
      if (command) {
        if (!id) throw Error('El chat todavía se está abriendo.');
        await steer(id, dir, payload.text, payload.attachments);
      } else if (queue) await enqueue(payload);
      else destination = await send(payload);
      // A prepared draft is not a sent message. Consume only the unchanged
      // notes accepted by the host; edits made during sending remain pending.
      for (const note of notes) {
        const currentNote = visualNotes(sendKey).find(entry => entry.id === note.id);
        if (currentNote && JSON.stringify(currentNote) === JSON.stringify(note)) removeVisualNote(sendKey, note.id);
      }
      if (destination && !id) {
        const nextKey = draftKey(options.projectId, destination);
        await loadVisualNotes(nextKey);
        for (const note of [...visualNotes(sendKey)]) { await addVisualNote(nextKey, note); removeVisualNote(sendKey, note.id); }
      }
      await flushVisualNotes(sendKey);
    })();
    void action.then(() => setSendCount(count => count + 1)).catch((error: Error) => {
      const fresh = draft(sendKey);
      setDraftText(sendKey, fresh.text === text ? text : [text, fresh.text].filter(Boolean).join('\n\n'));
      setDraftAttachments(sendKey, mergeAttachments(attachments, fresh.attachments));
      toast.error('No se pudo enviar', { description: error.message });
    }).finally(() => setSubmitting(false));
  };

  const handleQueued = async (messageId: string, action: 'edit' | 'delete' | 'redirect') => {
    const id = chatId(), sendKey = key();
    const message = transcript().queue?.messages.find(entry => entry.id === messageId);
    if (!id || !message || redirectingQueueId()) return;
    setRedirectingQueueId(messageId);
    try {
      if (action === 'redirect') await redirectQueued(id, project.dir(), messageId);
      else {
        await removeQueued(id, messageId);
        if (action === 'edit') {
          const fresh = draft(sendKey);
          setDraftText(sendKey, [message.text, fresh.text].filter(Boolean).join('\n\n'));
          setDraftAttachments(sendKey, mergeAttachments(message.attachments.map(attachmentFromPath), fresh.attachments));
        }
      }
    } catch (error) { toast.error('No se pudo actualizar la cola', { description: (error as Error).message }); }
    finally { setRedirectingQueueId(null); }
  };

  const handleNew=async(title='Nuevo chat')=>{const ref=model();if(!ref)return null;const id=await createChat(project.id(),project.dir(),ref,title);setSessionsOpen(false);return id;};
  const handleGuide=async()=>{const name='syka:guide:'+project.id();const id=localStorage.getItem(name);if(id&&chatState.lists[project.id()]?.some(c=>c.id===id)){setActiveChat(project.id(),id);}else{const fresh=await handleNew('Guía y feedback');if(fresh){localStorage.setItem(name,fresh);setDraftText(fresh,'Actuá como guía de Syka Studio. Explicá las capacidades reales del editor y ayudame a registrar feedback. No edites sin que lo pida.');}}setSessionsOpen(false);};

  const handleStop = () => {
    const id = chatId();
    if (!id) return;
    interrupt(id).catch((error: Error) => toast.error("Could not stop", { description: error.message }));
  };

  const answer = (answers: Record<string, string[]> | "skip") => {
    const id = chatId();
    const request = transcript().pending;
    if (!id || !request) return;
    respond(id, request.id, answers === "skip" ? "skip" : { answers }).catch((error: Error) =>
      toast.error("Could not answer", { description: error.message }),
    );
  };

  const selectQuestion=(label:string)=>{
    const question=questionView()?.questions[questionIndex()];if(!question||questionPhase()!=='question')return;
    const selected=question.multiSelect?(questionSelected().includes(label)?questionSelected().filter(value=>value!==label):[...questionSelected(),label]):[label];
    setQuestionSelected(selected);setDraftText(questionDraftKey(),selected.join(', '));
    queueMicrotask(()=>chatElement.querySelector<HTMLTextAreaElement>('.syka-mirel-composer textarea')?.focus());
  };
  const handleQuestionSend=async()=>{
    const id=chatId(),request=questionView(),index=questionIndex();
    if(!id||!request||transcript().pending?.id!==request.id||questionPhase()!=='question'||answering())return;
    const entry=request.questions[index],responseDraft=draft(questionDraftKey());
    const selected=[...questionSelected()],responseKeys=request.questions.map((_,i)=>questionDraftKey(i));
    try{
      setAnswering(true);
      const prepared=await prepareReferences(responseDraft.text,responseDraft.attachments,project.dir());
      if(transcript().pending?.id!==request.id)return;
      const answers={...questionAnswers(),[entry.id]:questionResponse(entry,prepared.text,selected,attachmentPaths(prepared.attachments))};
      if(index<request.questions.length-1){setQuestionAnswers(answers);setQuestionIndex(index+1);setQuestionSelected([]);return;}
      await respond(id,request.id,{answers});
      responseKeys.forEach(clearDraft);
    }catch(error){toast.error('No se pudo responder',{description:(error as Error).message});}
    finally{setAnswering(false);}
  };

  const referenceDrop = (transfer: DataTransfer | null): boolean => {
    const linked = readLinkedResourceDrop(transfer);
    if (linked) {
      referenceInChat(project.id(), linkedReferenceInstruction(linked.kind), {kind:linked.kind,path:linked.path,name:linked.title,brand:linked.brand,audioType:linked.audioType,componentPath:linked.componentPath,componentFiles:linked.componentFiles,usage:linked.usage,...selectionContext(world)}, linked.previewUrl, composerKey());
      return true;
    }
    const presetId = transfer?.getData(RESOURCE_DRAG_TYPE);
    const preset = presetId && getEditorResources().find(resource => resource.id === presetId);
    if (!preset) return false;
    referenceInChat(project.id(), 'Usá este preset como referencia visual para mi edición. Revisá la selección y proponé cómo adaptarlo.', {preset:{id:preset.id,label:preset.label,kind:preset.kind,value:preset.value,textStyle:preset.textStyle},...selectionContext(world)}, transfer?.getData(RESOURCE_PREVIEW_DRAG_TYPE), composerKey());
    return true;
  };
  const isReferenceDrag = (transfer: DataTransfer | null) => Array.from(transfer?.types ?? []).some(type => type === LINKED_RESOURCE_DRAG_TYPE || type === RESOURCE_DRAG_TYPE);
  const isChatDrag = (transfer: DataTransfer | null) => isReferenceDrag(transfer) || Array.from(transfer?.types ?? []).includes('Files');
  const handleChatDrop = async (event: DragEvent) => {
    if (!isChatDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    if (referenceDrop(event.dataTransfer)) return;
    // Capture the destination before preparing files: switching chats must
    // never attach a pending drop to the newly opened conversation.
    const destination = composerKey();
    try {
      const entries = await prepareDroppedChatFiles(event, project.dir());
      setDraftAttachments(destination, mergeAttachments(draft(destination).attachments, entries));
    } catch (error) {
      toast.error('No se pudo adjuntar', { description: String(error) });
    }
  };

  return (
    <div ref={chatElement} class="syka-agent-chat relative flex flex-1 min-h-0 flex-col" data-question-open={!!questionView()} data-question-phase={questionView()?questionPhase():undefined} classList={{'is-compact': !!fullscreenChatMount(), 'show-history': fullscreenHistory(), 'is-floating':chatFloating()&&!fullscreenChatMount()}}
      onDragOver={event => {if(isChatDrag(event.dataTransfer)){event.preventDefault();event.stopPropagation();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';}}}
      onDrop={event => void handleChatDrop(event)}>
      <Show when={fullscreenChatMount()}><button type="button" class="syka-fullscreen-history-toggle" aria-expanded={fullscreenHistory()} onClick={() => setFullscreenHistory(v => !v)}>{fullscreenHistory() ? 'Ocultar conversación' : transcript().pending ? 'Responder al agente' : 'Ver conversación'}</button></Show>
      <div class="syka-chat-history contents">
      <div class="syka-sidebar-toolbar" data-chat-toolbar>
        <Show when={!chatFloating()}><SidebarTabs /></Show>
        <ChatIdentityHeader working={running()} activity={mascot()} projectId={project.id()} blocked={!!questionView()} sessionsOpen={sessionsOpen()} onToggleSessions={()=>setSessionsOpen(v=>!v)} />
      </div>
      <Show when={sessionsOpen()}><button class="syka-session-scrim" aria-label="Cerrar sesiones" onClick={()=>setSessionsOpen(false)}/></Show>
      <SessionRail projectId={project.id()} chatId={chatId()} open={sessionsOpen()} running={running()} onClose={()=>setSessionsOpen(false)} onNew={()=>handleNew()} onSelect={id=>{setActiveChat(project.id(),id);setSessionsOpen(false);}} onSkills={()=>{window.location.hash='/?dashboard=settings';}} onScheduled={()=>{setScheduledOpen(true);setSessionsOpen(false);}} onGuide={()=>void handleGuide()}/>
      <Show when={scheduledOpen()}><ScheduledTasks projectId={project.id()} onClose={()=>setScheduledOpen(false)}/></Show>
      <GeneratedImagesContext.Provider value={{registration: id => generatedAssets().get(id), insert: asset => insertAssetAtPlayhead(world, asset)}}>
      <ChatActionsContext.Provider value={{chatKey:key,running,imageDownloadPaths:id=>imagePathsForMessage(items(),id),lastAssistantId:()=>items().findLast(i=>i.kind==='assistant')?.id,isActiveItem:id=>{const list=items();return list.slice(list.findLastIndex(i=>i.kind==='user')+1).some(i=>i.id===id);},onDraft:text=>setDraftText(key(),text),onBranch:async itemId=>{const all=items();const index=all.findIndex(i=>i.id===itemId);const context=all.slice(0,index+1).filter(i=>i.kind==='user'||i.kind==='assistant').map(i=>`${i.kind==='user'?'Usuario':'Asistente'}: ${'text' in i?i.text:''}`).join('\n\n');const fresh=await handleNew('Continuación');if(fresh)setDraftText(fresh,'Continuación de la conversación anterior:\n\n'+context+'\n\nContinuemos desde acá: ');}}}><Transcript items={items()} sendCount={sendCount()} chatKey={chatId() ?? "draft"} running={running()} waiting={waiting()} /></ChatActionsContext.Provider>
      </GeneratedImagesContext.Provider>

      <Show when={questionView()?.questions[questionIndex()]}>{question=><QuestionNotice question={question()} index={questionIndex()} count={questionView()!.questions.length} phase={questionPhase()} selected={questionSelected()} onSelect={selectQuestion} onCancel={handleStop}/>}</Show>
      <Show when={transcript().pending?.questions.some(question=>question.secret) && transcript().pending}>
        {(request) => <QuestionCard request={request()} onSubmit={answer} onSkip={() => answer("skip")} />}
      </Show>

      <Show when={chatId() === null}>
        <RecentChats projectId={project.id()} onOpen={(id) => setActiveChat(project.id(), id)} />
      </Show>
      <Show when={chatState.connection === "unavailable"}>
        <div class="mx-4 mb-2 flex shrink-0 items-center justify-end">
          <Button variant="secondary" size="small" onClick={() => downloadDesktopApp("chat_panel")}>
            Get desktop app
          </Button>
        </div>
      </Show>
      </div>

      <ChatPlacementControl />
      <Composer
        projectDir={project.dir()}
        chatKey={composerKey()}
        contextUsage={transcript().contextUsage}
        text={composerDraft().text}
        attachments={composerDraft().attachments}
        onText={(text) => setDraftText(composerKey(), text)}
        onAttachments={(attachments) => setDraftAttachments(composerKey(), attachments)}
        answering={!!questionView()}
        placeholder={questionView()?'Respondé o sumá una referencia…':undefined}
        ariaLabel={questionView()?'Tu respuesta':'Mensaje al editor'}
        submitLabel={questionView()&&questionIndex()<questionView()!.questions.length-1?'Siguiente pregunta':questionView()?'Enviar respuesta':undefined}
        onReferenceDrop={referenceDrop}
        running={running()}
        waiting={waiting()}
        blocked={questionView()&&questionPhase()!=='question'?'Esperá la pregunta…':blockedReason()}
        model={model()}
        onModel={handleModel}
        onSend={()=>questionView()?void handleQuestionSend():handleSend()}
        onStop={handleStop}
        queue={questionView()?undefined:transcript().queue}
        submitting={submitting()||answering()}
        supportsSteering={supportsSteering()}
        redirectingQueueId={redirectingQueueId()}
        onRedirectQueued={id => void handleQueued(id, 'redirect')}
        onEditQueued={id => void handleQueued(id, 'edit')}
        onDeleteQueued={id => void handleQueued(id, 'delete')}
        onResumeQueue={() => { const id = chatId(); if (id) void resumeQueue(id).catch(error => toast.error('No se pudo reanudar', { description: error.message })); }}
      />
    </div>
  );
}
