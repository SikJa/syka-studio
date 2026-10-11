/** @jsxImportSource react */
import SelectionActions from '../../components/selection-actions';
import {useEffect,useRef,useState} from 'react';
import {Check,Copy,ThumbsUp,ThumbsDown,MessageSquare,GitBranch,X,LoaderCircle,FileText} from 'lucide-react';
import type {AgentThreadMessage,AgentFeedbackVerdict} from './syka-contracts';
import type {MirelAgentProfile} from './agent-catalog';
import {AgentResponseOrb} from './agent-identity-orb';
import {ParticleStreamingText} from './agent-particle-stream';
import {AgentRichText} from './agent-rich-text';
import {AgentTextDocumentButton} from './agent-local-artifact';
import {AgentAttachmentCoverFlow} from './agent-attachment-cover-flow';
import './agent-workspace.css';
const copyText=(text:string)=>navigator.clipboard.writeText(text);
const formatTime=(value:string)=>new Date(value).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
const formatFileSize=(bytes:number)=>`${Math.round(bytes/1024)} KB`;
const attachmentStateLabel=(state:string|undefined)=>state??'available';
const AttachmentIcon=(_: {mimeType:string})=><FileText size={18}/>;
export function MessageBubble({ sectionId, agent, message, renderBody, sending, reducedMotion, onCommand, onFeedback, onBranch, hideIdentityOrb = false }: {
  sectionId: string;
  agent: MirelAgentProfile;
  message: AgentThreadMessage;
  renderBody?: string;
  previousMessage: AgentThreadMessage | undefined;
  sending: boolean;
  reducedMotion: boolean;
  hideIdentityOrb?: boolean;
  onCommand: (command: string) => void;
  onFeedback?: (messageId:string,verdict:AgentFeedbackVerdict|null,comment:string|null)=>Promise<void>;
  onBranch?: (body: string) => void | Promise<void>;
}) {
  const assistant = message.role === "assistant";
  const skillReview = null;
  const responseBody = renderBody ?? message.content;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [comment, setComment] = useState(message.feedback?.comment ?? "");
  const [feedbackVerdict, setFeedbackVerdict] = useState<AgentFeedbackVerdict>(message.feedback?.verdict ?? "useful");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const feedbackTextareaRef = useRef<HTMLTextAreaElement>(null);
  const copyResetRef = useRef<number | null>(null);
  const feedbackTitleId = `${sectionId}-feedback-title`;
  const negativeFeedback = message.feedback?.verdict === "needs_correction" || message.feedback?.verdict === "missing_context";
  const imageAttachments = message.attachments?.filter((attachment) => attachment.mimeType.startsWith("image/")) ?? [];
  const fileAttachments = message.attachments?.filter((attachment) => !attachment.mimeType.startsWith("image/")) ?? [];

  useEffect(() => {
    if (!feedbackOpen) return;
    feedbackTextareaRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFeedbackOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [feedbackOpen]);

  useEffect(() => () => {
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
  }, []);

  const saveQuickFeedback = async (verdict: "useful" | "needs_correction") => {
    if (!onFeedback || savingFeedback) return;
    const active = verdict === "useful" ? message.feedback?.verdict === "useful" : negativeFeedback;
    setSavingFeedback(true);
    setFeedbackError(null);
    try {
      await onFeedback(message.id, active ? null : verdict, null);
    } catch {
      setFeedbackError("No pudimos guardar el feedback. Probá de nuevo.");
    } finally {
      setSavingFeedback(false);
    }
  };

  const openFeedback = () => {
    setComment(message.feedback?.comment ?? "");
    setFeedbackVerdict(message.feedback?.verdict ?? "useful");
    setFeedbackError(null);
    setFeedbackOpen(true);
  };

  const saveDetailedFeedback = async () => {
    if (!onFeedback || savingFeedback || comment.trim().length < 3) return;
    setSavingFeedback(true);
    setFeedbackError(null);
    try {
      await onFeedback(message.id, feedbackVerdict, comment.trim());
      setFeedbackOpen(false);
    } catch {
      setFeedbackError("No pudimos guardar el feedback. Probá de nuevo.");
    } finally {
      setSavingFeedback(false);
    }
  };

  const copyResponse = async () => {
    await copyText(responseBody);
    setCopied(true);
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    copyResetRef.current = window.setTimeout(() => setCopied(false), 1_800);
  };

  return (
    <SelectionActions onDescribe={context=>onCommand('Explicá este texto: '+context.text)} onChange={context=>onCommand((context.instruction??'Mejorá el texto seleccionado')+'\n\n'+context.text)}><article id={sectionId} className={`agent-chat-message ${assistant ? "assistant" : "user"}`}>
      <header className="agent-message-header">
        {assistant ? hideIdentityOrb ? <span className="syka-orb-anchor" data-chat-orb-anchor="response" aria-hidden="true" /> : <><AgentResponseOrb agent={agent} reducedMotion={reducedMotion}/><strong>{agent.name}</strong></> : <strong>Vos</strong>}
        <time>{formatTime(message.createdAt)}</time>
      </header>
      {assistant ? <div className="agent-message-surface"><>{sending?<ParticleStreamingText body={responseBody}/>:<AgentRichText body={responseBody}/>}</></div> : <AgentRichText body={message.content}/>}
      {!sending && responseBody.length > 600 ? <AgentTextDocumentButton body={responseBody}/> : null}
      {imageAttachments.length ? <AgentAttachmentCoverFlow images={imageAttachments}/> : null}
      {fileAttachments.length ? <div className="agent-message-attachments">{fileAttachments.map((attachment) => <a key={attachment.assetRef} href={attachment.contentUrl} target="_blank" rel="noreferrer"><AttachmentIcon mimeType={attachment.mimeType} /><span>{attachment.name}<small>{formatFileSize(attachment.size)} · {attachmentStateLabel(attachment.processingState)}</small></span></a>)}</div> : null}
      {assistant && !sending && !skillReview ? <footer className="agent-message-actions" aria-label="Acciones de la respuesta">
        <button type="button" onClick={() => void copyResponse()} data-copied={copied} aria-label={copied ? "Respuesta copiada" : "Copiar respuesta"} title={copied ? "Copiada" : "Copiar respuesta"}>{copied ? <Check size={14}/> : <Copy size={14}/>}</button>
        {onFeedback ? <button type="button" className={message.feedback?.verdict === "useful" ? "active" : ""} disabled={savingFeedback} aria-pressed={message.feedback?.verdict === "useful"} aria-label="Marcar respuesta como útil" title="Útil" onClick={() => void saveQuickFeedback("useful")}><ThumbsUp size={14}/></button> : null}
        {onFeedback ? <button type="button" className={negativeFeedback ? "active" : ""} disabled={savingFeedback} aria-pressed={negativeFeedback} aria-label="Marcar respuesta como no útil" title="No fue útil" onClick={() => void saveQuickFeedback("needs_correction")}><ThumbsDown size={14}/></button> : null}
        {onFeedback ? <button type="button" className={message.feedback?.comment ? "active" : ""} disabled={savingFeedback} aria-pressed={Boolean(message.feedback?.comment)} aria-label="Escribir feedback sobre esta respuesta" title="Dar feedback" onClick={openFeedback}><MessageSquare size={14}/></button> : null}
        {onBranch ? <button type="button" aria-label="Continuar desde esta respuesta en un chat nuevo" title="Continuar en un chat nuevo" onClick={() => void onBranch(responseBody)}><GitBranch size={14}/></button> : null}
      </footer> : null}
      {feedbackError && !feedbackOpen ? <p className="agent-message-feedback-error" role="alert">{feedbackError}</p> : null}
      {feedbackOpen ? <div className="agent-feedback-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFeedbackOpen(false); }}>
        <section className="agent-feedback-modal" role="dialog" aria-modal="true" aria-labelledby={feedbackTitleId}>
          <header><span><MessageSquare size={15}/></span><div><strong id={feedbackTitleId}>Dar feedback</strong><small>Contanos por qué esta respuesta sirvió o qué habría que mejorar.</small></div><button type="button" aria-label="Cerrar feedback" title="Cerrar" onClick={() => setFeedbackOpen(false)}><X size={15}/></button></header>
          <div className="agent-feedback-verdicts" role="radiogroup" aria-label="Resultado de la respuesta">
            {([
              ["useful", "Sirvió"],
              ["needs_correction", "Necesita corrección"],
              ["missing_context", "Faltó contexto"],
            ] as const).map(([verdict, label]) => <button key={verdict} type="button" role="radio" aria-checked={feedbackVerdict === verdict} onClick={() => setFeedbackVerdict(verdict)}><span>{feedbackVerdict === verdict ? <Check size={12}/> : null}</span>{label}</button>)}
          </div>
          <label htmlFor={`${sectionId}-feedback-comment`}>¿Por qué?</label>
          <textarea ref={feedbackTextareaRef} id={`${sectionId}-feedback-comment`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={5} placeholder="Escribí qué funcionó, qué estuvo mal o qué contexto faltó…"/>
          <div className="agent-feedback-meta"><span>{comment.trim().length < 3 ? "Escribí al menos 3 caracteres" : "Listo para guardar"}</span><span>{comment.length} / 2000</span></div>
          {feedbackError ? <p role="alert">{feedbackError}</p> : null}
          <footer><button type="button" onClick={() => setFeedbackOpen(false)}>Cancelar</button><button type="button" className="primary" disabled={savingFeedback || comment.trim().length < 3} onClick={() => void saveDetailedFeedback()}>{savingFeedback ? <><LoaderCircle size={13}/>Guardando</> : "Guardar feedback"}</button></footer>
        </section>
      </div> : null}
    </article></SelectionActions>
  );
}
