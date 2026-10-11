/** @jsxImportSource react */
import { ModelMenuPortal } from './model-menu-portal';
import { ComposerAddMenu } from './composer-add-menu';
import {AgentExternalUrl} from './agent-rich-text';
import {composeWebDraft,splitWebDraft,mergeWebDraft} from '@/lib/web-links';
import { DictationControl } from "./dictation-control.js";
import { EffortSlider } from './effort-slider.js';
import { useComposerMetalAppearance } from "../../shared/use-metal-appearance.js";
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  FileText,
  Film,
  Globe2,
  LoaderCircle,
  MessageCircleQuestion,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Rows3,
  Square,
  Trash2,
  Zap,
  X,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { MetalFx } from "metal-fx";
import { AGENT_ATTACHMENT_ACCEPT } from "./agent-attachment-policy.js";
import { AgentMediaCarousel } from "./agent-media-carousel.js";
import { AgentImageLightbox, type AgentLightboxImage } from "./agent-image-lightbox.js";
import { attachmentCover } from '@/agent-chat/attachment-cover';
import { t } from '@/i18n';
import "./agent-composer.css";

export interface AgentComposerAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
  detail?: AgentLightboxImage['detail'];
  /** Context files remain attached for the agent without appearing as media tiles. */
  hidden?: boolean;
  assetRef?: string;
  state?: "uploading" | "stored" | "processing" | "available" | "failed" | "error";
}

export interface AgentComposerQueuedMessage {
  id: string;
  content: string;
  attachments: readonly AgentComposerAttachment[];
}

export interface AgentComposerModelOption {
  id: string;
  label: string;
  description?: string;
  supportsFast?: boolean;
  logoSvg?: string;
  routeLabel?: string;
}

export interface AgentComposerEffortOption {
  id: string;
  label: string;
}

export interface AgentComposerMenuAction {
  id: string;
  label: string;
  description?: string;
  section?: string;
  icon?: ReactNode;
  disabled?: boolean;
  accent?: boolean;
  hint?: string;
  onSelect: () => void;
}

export interface AgentComposerSuggestion {
  id: string;
  label: string;
  prompt: string;
  section: string;
  description?: string;
}

export interface AgentComposerContextUsage {
  usedTokens: number;
  maxTokens: number;
}

export interface AgentComposerVoiceControl {
  enabled: boolean;
  active?: boolean;
  onToggle?: () => void;
  unavailableReason?: string;
}

export interface AgentComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  variant?: "default" | "reference";
  submitLabel?: string;
  disabled?: boolean;
  /** Context held by the parent, such as visual notes or a selected capture. */
  hasContext?: boolean;
  working?: boolean;
  canceling?: boolean;
  onStop?: () => void;
  attachments?: readonly AgentComposerAttachment[];
  /** Small inline thumbnails for compact desktop replies. */
  attachmentPresentation?: 'carousel' | 'compact';
  onFiles?: (files: File[]) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  queuedMessages?: readonly AgentComposerQueuedMessage[];
  queueEnabled?: boolean;
  allowWhileWorking?: boolean;
  redirectingQueueId?: string | null;
  onRedirectQueued?: (messageId: string) => void;
  onEditQueued?: (messageId: string) => void;
  onDeleteQueued?: (messageId: string) => void;
  onDisableQueue?: () => void;
  models?: readonly AgentComposerModelOption[];
  selectedModelId?: string;
  /** Existing chats retain their model even when its catalog is hidden. */
  selectedModelOption?: AgentComposerModelOption;
  onModelChange?: (modelId: string) => void;
  onConfigureProviders?: () => void;
  unavailableProviders?: readonly { id: string; label: string; status: string; logoSvg?: string }[];
  efforts?: readonly AgentComposerEffortOption[];
  selectedEffortId?: string;
  onEffortChange?: (effortId: string) => void;
  fast?: boolean;
  fastAvailable?: boolean;
  fastUnavailableReason?: string;
  onFastChange?: (fast: boolean) => void;
  modelFallbackLabel?: string;
  menuActions?: readonly AgentComposerMenuAction[];
  suggestions?: readonly AgentComposerSuggestion[];
  voice?: AgentComposerVoiceControl;
  dictationContext?: string;
  contextUsage?: AgentComposerContextUsage;
  notice?: string | null;
  accept?: string;
  maxRows?: number;
  className?: string;
}

const EMPTY_ATTACHMENTS: readonly AgentComposerAttachment[] = [];
const EMPTY_QUEUED_MESSAGES: readonly AgentComposerQueuedMessage[] = [];
const EMPTY_MODELS: readonly AgentComposerModelOption[] = [];
const EMPTY_EFFORTS: readonly AgentComposerEffortOption[] = [];
const EMPTY_ACTIONS: readonly AgentComposerMenuAction[] = [];
const EMPTY_SUGGESTIONS: readonly AgentComposerSuggestion[] = [];
const DEFAULT_VOICE: AgentComposerVoiceControl = {
  enabled: false,
  unavailableReason: "La voz todavía no está conectada en este chat",
};

export function getAgentComposerContextPercent(usage: AgentComposerContextUsage | undefined): number | null {
  if (!usage || !Number.isFinite(usage.usedTokens) || !Number.isFinite(usage.maxTokens) || usage.maxTokens <= 0 || usage.usedTokens < 0) return null;
  return Math.min(100, Math.max(0, Math.round((usage.usedTokens / usage.maxTokens) * 100)));
}

export function isAgentComposerInstructionDraft(value: string): boolean {
  return /^\/(?:steer|background|bg|btw)(?:\s|$)/iu.test(value.trim());
}

export function isAgentComposerCrtWarpEffort(value: string | undefined): boolean {
  return value === "max" || value === "ultra";
}

export function getAgentComposerEffortIndex(efforts: readonly AgentComposerEffortOption[], selectedEffortId: string | undefined): number {
  const selected = efforts.findIndex((effort) => effort.id === selectedEffortId);
  if (selected >= 0) return selected;
  return Math.max(0, efforts.findIndex((effort) => effort.id === "medium"));
}

export function AgentComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel = "Mensaje",
  variant = "default",
  submitLabel,
  disabled = false,
  hasContext = false,
  working = false,
  canceling = false,
  onStop,
  attachments = EMPTY_ATTACHMENTS,
  attachmentPresentation = 'carousel',
  onFiles,
  onRemoveAttachment,
  queuedMessages = EMPTY_QUEUED_MESSAGES,
  queueEnabled = true,
  allowWhileWorking = false,
  redirectingQueueId = null,
  onRedirectQueued,
  onEditQueued,
  onDeleteQueued,
  models = EMPTY_MODELS,
  selectedModelId,
  selectedModelOption,
  onModelChange,
  onConfigureProviders,
  unavailableProviders = [],
  efforts = EMPTY_EFFORTS,
  selectedEffortId,
  onEffortChange,
  fast = false,
  fastAvailable = false,
  fastUnavailableReason = 'Este modelo no ofrece modo rápido.',
  onFastChange,
  modelFallbackLabel = "Catálogo sin conexión",
  menuActions = EMPTY_ACTIONS,
  suggestions = EMPTY_SUGGESTIONS,
  voice = DEFAULT_VOICE,
  dictationContext,
  contextUsage,
  notice = null,
  accept = AGENT_ATTACHMENT_ACCEPT,
  maxRows = 5,
  className,
}: AgentComposerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelTriggerRef = useRef<HTMLButtonElement>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const voiceButtonRef = useRef<HTMLButtonElement>(null);
  const attachmentPreviewTriggerRef = useRef<HTMLElement | null>(null);
  const addMenuId = `agent-composer-add-${useId().replace(/[^a-zA-Z0-9]/gu, "")}`;
  const modelMenuId = `agent-composer-model-${useId().replace(/[^a-zA-Z0-9]/gu, "")}`;
  const suggestionsMenuId = `agent-composer-suggestions-${useId().replace(/[^a-zA-Z0-9]/gu, "")}`;
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [suggestionsMenuOpen, setSuggestionsMenuOpen] = useState(false);
  const [attachmentLightboxIndex, setAttachmentLightboxIndex] = useState<number | null>(null);
  const selectedModel = models.find((model) => model.id === selectedModelId) ??
    (selectedModelOption?.id === selectedModelId ? selectedModelOption : undefined);
  const selectedEffortIndex = efforts.findIndex((effort) => effort.id === selectedEffortId);
  const safeEffortIndex = getAgentComposerEffortIndex(efforts, selectedEffortId);
  const selectedEffort = selectedEffortIndex >= 0 ? efforts[selectedEffortIndex] : undefined;
  const ultraMode = isAgentComposerCrtWarpEffort(selectedEffortId);
  const hasModelControl = models.length > 0 || efforts.length > 0 || Boolean(onConfigureProviders);
  const modelTriggerLabel = selectedModel?.label ?? (hasModelControl ? "Modelo" : modelFallbackLabel);
  const hasAvailableAddAction = Boolean(onFiles) || menuActions.some((action) => !action.disabled);
  const instructionDraft = working && isAgentComposerInstructionDraft(value);
  const readyAttachment = attachments.some((attachment) => attachment.state !== "uploading" && attachment.state !== "processing" && attachment.state !== "failed" && attachment.state !== "error");
  const hasContent = value.trim().length > 0 || readyAttachment || hasContext;
  const canSubmit = !disabled && hasContent && (!working || instructionDraft || allowWhileWorking);
  const canStop = working && !instructionDraft && !hasContent && Boolean(onStop) && !canceling;
  const [contextDetailsOpen,setContextDetailsOpen]=useState(false);
  const [contextDetailsDismissed,setContextDetailsDismissed]=useState(false);
  const contextPercent = getAgentComposerContextPercent(contextUsage);
  const classNames = ["agent-composer", className].filter(Boolean).join(" ");
  const appearance = useComposerMetalAppearance();
  const metalReflectionTargets = useMemo(() => [modelTriggerRef, voiceButtonRef], []);
  const [draftPresentation,setDraftPresentation]=useState(()=>splitWebDraft(value));
  const localDraftValue=useRef<string|null>(null);
  const {text:draftText,links:draftLinks}=draftPresentation;
  const updateDraft=(text:string,links:readonly string[],extractLinks=false)=>{
    const presentation=extractLinks?mergeWebDraft(text,links):{text,links:[...new Set(links)]};
    const next=composeWebDraft(presentation.text,presentation.links);localDraftValue.current=next;
    setDraftPresentation(presentation);onChange(next);
  };
  useLayoutEffect(()=>{
    if(value!==localDraftValue.current){localDraftValue.current=null;setDraftPresentation(splitWebDraft(value));}
  },[value]);
  const visibleAttachments = useMemo(() => attachments.filter(attachment => !attachment.hidden), [attachments]);
  const previewImages = useMemo(() => visibleAttachments.map(attachment => ({
    id: attachment.id, name: attachment.name,
    previewUrl: attachment.previewUrl ?? attachmentCover(attachment.name),
    detail: attachment.detail,
  })), [visibleAttachments]);

  const activeAttachmentLightboxIndex = attachmentLightboxIndex === null || previewImages.length === 0
    ? null
    : Math.min(attachmentLightboxIndex, previewImages.length - 1);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const computed = window.getComputedStyle(input);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 20;
    const verticalPadding = Number.parseFloat(computed.paddingTop) + Number.parseFloat(computed.paddingBottom);
    input.style.height = "0px";
    const contentHeight = input.scrollHeight;
    const maximum = (lineHeight * Math.max(1, maxRows)) + verticalPadding;
    const minimum = lineHeight + verticalPadding;
    const nextHeight = Math.min(contentHeight, maximum);
    input.style.height = `${Math.max(minimum, nextHeight)}px`;
    input.style.overflowY = contentHeight > maximum ? "auto" : "hidden";
  }, [maxRows, draftText]);

  useEffect(() => {
    if (!addMenuOpen && !modelMenuOpen && !suggestionsMenuOpen) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !modelMenuRef.current?.contains(event.target as Node) && !addMenuRef.current?.contains(event.target as Node)) {
        setAddMenuOpen(false);
        setModelMenuOpen(false);
        setSuggestionsMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [addMenuOpen, modelMenuOpen, suggestionsMenuOpen]);

  useEffect(() => {
    if (!disabled) return;
    setAddMenuOpen(false);
    setModelMenuOpen(false);
    setSuggestionsMenuOpen(false);
  }, [disabled]);

  const closeMenus = () => {
    setAddMenuOpen(false);
    setModelMenuOpen(false);
    setSuggestionsMenuOpen(false);
  };

  const submit = () => {
    if (!canSubmit) return;
    closeMenus();
    onSubmit(value.trim());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      closeMenus();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length > 0) onFiles?.(files);
    setAddMenuOpen(false);
    inputRef.current?.focus();
  };

  const primaryAction = working && !instructionDraft && !hasContent ? "stop" : "send";
  const primaryDisabled = primaryAction === "stop" ? !canStop : !canSubmit;
  const primaryLabel = submitLabel ?? t(primaryAction === "stop"
    ? canceling ? "Cancelando respuesta" : "Detener respuesta"
    : instructionDraft
      ? "Enviar instrucción"
      : working && allowWhileWorking
        ? queueEnabled ? "Agregar mensaje a la cola" : "Redirigir ahora"
        : "Enviar mensaje");

  return (
    <div
      ref={rootRef}
      className={classNames}
      data-working={working}
      data-variant={variant}
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape" || (!addMenuOpen && !modelMenuOpen && !suggestionsMenuOpen)) return;
        event.preventDefault();
        closeMenus();
        inputRef.current?.focus();
      }}
    >
      {onFiles ? <input ref={fileInputRef} hidden type="file" multiple accept={accept} onChange={handleFiles} /> : null}

      <ComposerAddMenu open={addMenuOpen} anchor={addTriggerRef} panelRef={addMenuRef} id={addMenuId} actions={menuActions} onFiles={onFiles ? () => fileInputRef.current?.click() : undefined} onClose={() => setAddMenuOpen(false)}/>

      {modelMenuOpen ? (
        <ModelMenuPortal anchor={modelTriggerRef}>
        <div ref={modelMenuRef} id={modelMenuId} className="agent-composer-popover agent-composer-model-menu" role="dialog" aria-label="Ajustes de modelo">
          <div className="agent-composer-model-catalog">
          {models.length > 0 ? (
            <>
              <small>Modelos</small>
              <div className="agent-composer-model-options" role="radiogroup" aria-label="Modelo" onKeyDown={event => {
                if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
                const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]'));
                const current = buttons.indexOf(event.target as HTMLButtonElement);
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
                if (buttons[next] && models[next]) { event.preventDefault(); buttons[next].focus(); onModelChange?.(models[next].id); }
              }}>
                {models.map((model) => {
                  const selected = model.id === selectedModelId;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!onModelChange}
                      data-selected={selected}
                      onClick={() => onModelChange?.(model.id)}
                    >
                      <span className="syka-provider-model-icon" data-provider={model.id.split(':')[0]} aria-hidden="true">{model.logoSvg ? <span dangerouslySetInnerHTML={{__html:model.logoSvg}}/> : model.description?.slice(0,1)}</span>
                      <span className="syka-model-label"><strong>{model.label}</strong>{model.description ? <em>{model.description}</em> : null}</span>
                      <span className="agent-composer-model-check" aria-hidden="true">
                        {selected ? <Check size={13} strokeWidth={2.7} /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
          {unavailableProviders.length ? <div className="agent-composer-provider-statuses">{unavailableProviders.map(provider => <button key={provider.id} type="button" onClick={() => { setModelMenuOpen(false); onConfigureProviders?.(); }}><span className="syka-provider-model-icon" aria-hidden="true">{provider.logoSvg ? <span dangerouslySetInnerHTML={{__html:provider.logoSvg}}/> : provider.label.slice(0,1)}</span><span><strong>{provider.label}</strong><small>{provider.status}</small></span><ChevronRight size={12}/></button>)}</div> : null}
          </div>
          {efforts.length > 0 ? (
            <div className="agent-composer-effort" data-ultra={ultraMode}>
              <div><span>Esfuerzo</span><strong>{selectedEffort?.label ?? "Automático"}</strong></div>
              <div className="agent-composer-effort-ends" aria-hidden="true"><span>Más rápido</span><span>Más profundo</span></div>
              <EffortSlider efforts={efforts} index={safeEffortIndex} label={selectedEffort?.label ?? 'Automático'} ultra={ultraMode} onChange={onEffortChange} />
            </div>
          ) : null}
          <div className="agent-composer-fast" data-active={fast && fastAvailable} data-available={fastAvailable}>
            <div className="agent-composer-fast-header">
              <span>Modo rápido</span>
              <MetalFx
                className="agent-composer-fast-metal"
                data-disabled={!onFastChange || !fastAvailable ? "true" : "false"}
                variant="button"
                preset="chromatic"
                strength={1}
                theme={appearance.theme}
                paused={appearance.reducedMotion}
                borderRadius={8}
                reflectionTargets={metalReflectionTargets}
              >
                <button
                  type="button"
                  aria-label="Modo rápido"
                  aria-pressed={fast && fastAvailable}
                  title={fastAvailable ? `${fast ? 'Desactivar' : 'Activar'} modo rápido. Consume 2,5× del cupo incluido o 2× de créditos; aplica al próximo envío.` : fastUnavailableReason}
                  disabled={!onFastChange || !fastAvailable}
                  onClick={() => onFastChange?.(!fast)}
                >
                  <Zap size={14} fill={fast && fastAvailable ? "currentColor" : "none"} />
                </button>
              </MetalFx>
            </div>
          </div>
          {onConfigureProviders ? <button type="button" className="agent-composer-configure" onClick={() => { setModelMenuOpen(false); onConfigureProviders(); }}>Configurar agentes y modelos <ChevronRight size={13}/></button> : null}
        </div>
        </ModelMenuPortal>
      ) : null}

      {suggestionsMenuOpen && suggestions.length > 0 ? (
        <div id={suggestionsMenuId} className="agent-composer-popover agent-composer-suggestions-menu" role="dialog" aria-label="Ideas para continuar">
          <header>
            <span><MessageCircleQuestion size={15} /></span>
            <div><strong>Ideas para continuar</strong><small>Elegí una y adaptala antes de enviarla</small></div>
          </header>
          {suggestions.map((suggestion, index) => {
            const previousSection = index > 0 ? suggestions[index - 1]?.section : undefined;
            return <Fragment key={suggestion.id}>
              {suggestion.section !== previousSection ? <small className="agent-composer-suggestion-section">{suggestion.section}</small> : null}
              <button type="button" onClick={() => {
                onChange(suggestion.prompt);
                setSuggestionsMenuOpen(false);
                window.requestAnimationFrame(() => inputRef.current?.focus());
              }}>
                <span><strong>{suggestion.label}</strong>{suggestion.description ? <em>{suggestion.description}</em> : null}</span>
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </Fragment>;
          })}
        </div>
      ) : null}

      {queuedMessages.length > 0 ? (
        <AgentComposerQueueTray
          messages={queuedMessages}
          queueEnabled={queueEnabled}
          redirectingQueueId={redirectingQueueId}
          onRedirect={onRedirectQueued}
          onEdit={onEditQueued}
          onDelete={onDeleteQueued}
        />
      ) : null}

          {attachmentPresentation === 'carousel' ? <><div className="agent-composer-attachment-area">
          <AgentMediaCarousel
            images={previewImages}
            onActivate={(index, trigger) => { attachmentPreviewTriggerRef.current = trigger; setAttachmentLightboxIndex(index); }}
            onRemove={onRemoveAttachment}
          />
          </div>
          <AgentImageLightbox
            images={previewImages}
            activeIndex={activeAttachmentLightboxIndex}
            onActiveIndexChange={setAttachmentLightboxIndex}
            triggerRef={attachmentPreviewTriggerRef}
            onRemove={onRemoveAttachment}
          />
          </> : null}

      <div className="agent-composer-surface" data-has-attachments={visibleAttachments.length > 0}>
          <div className="dictation-slot" />
          {attachmentPresentation === 'compact' && visibleAttachments.length ? <div className="agent-composer-compact-attachments" aria-label="Archivos adjuntos">
            {visibleAttachments.map(attachment => <span className="agent-composer-compact-photo" key={attachment.id} title={attachment.name}>
              {attachment.previewUrl ? <img src={attachment.previewUrl} alt={attachment.name} draggable={false}/> : <span className="agent-composer-compact-document" role="img" aria-label={attachment.name}><FileText size={15}/><small>TXT</small></span>}
              {attachment.mimeType.startsWith('video/') ? <span className="agent-composer-compact-video" aria-hidden="true"><Film size={9}/></span> : null}
              {onRemoveAttachment ? <button type="button" aria-label={`Quitar archivo: ${attachment.name}`} disabled={disabled} onClick={() => onRemoveAttachment(attachment.id)}><X size={9}/></button> : null}
            </span>)}
          </div> : null}
          {draftLinks.length?<div className="syka-composer-web-links" aria-label="Enlaces del mensaje">{draftLinks.map(href=><span className="syka-web-link-chip" key={href}><AgentExternalUrl href={href} compact/><button type="button" aria-label={`Quitar enlace de ${new URL(href).hostname}`} title="Quitar enlace" onClick={()=>updateDraft(draftText,draftLinks.filter(link=>link!==href))}><X size={12}/></button></span>)}</div>:null}
          <div className="agent-composer-row">
            <textarea
              ref={inputRef}
              rows={1}
              value={draftText}
              disabled={disabled}
              placeholder={placeholder}
              aria-label={ariaLabel}
              data-tour-target={variant === 'reference' ? undefined : 'chat-message'}
              onChange={(event) => updateDraft(event.currentTarget.value,draftLinks,/\s$/.test(event.currentTarget.value))}
              onBlur={(event)=>updateDraft(event.currentTarget.value,draftLinks,true)}
              onPaste={(event)=>{
                const pasted=splitWebDraft(event.clipboardData.getData('text/plain'));
                if(!pasted.links.length)return;
                event.preventDefault();const input=event.currentTarget,start=input.selectionStart,end=input.selectionEnd;
                updateDraft(draftText.slice(0,start)+pasted.text+draftText.slice(end),[...draftLinks,...pasted.links],true);
                requestAnimationFrame(()=>{input.focus();input.setSelectionRange(start+pasted.text.length,start+pasted.text.length);});
              }}
              onKeyDown={handleKeyDown}
            />

            <div className="agent-composer-toolbar">
              {variant !== "reference" ? <div className="agent-composer-toolbar-start">
                <button
                  type="button"
                  className="agent-composer-icon-button agent-composer-add-trigger"
                  ref={addTriggerRef}
                  aria-haspopup="dialog"
                  aria-label="Agregar archivos y herramientas"
                  aria-expanded={addMenuOpen}
                  aria-controls={addMenuId}
                  disabled={disabled || (working && !allowWhileWorking) || !hasAvailableAddAction}
                  title={hasAvailableAddAction ? "Agregar al chat" : "No hay herramientas disponibles"}
                  onClick={() => { setModelMenuOpen(false); setSuggestionsMenuOpen(false); setAddMenuOpen((open) => !open); }}
                >
                  <Plus size={17} />
                </button>
        <button type="button" className="agent-composer-context" data-context-known={contextPercent !== null} data-context-dismissed={contextDetailsDismissed} aria-expanded={contextDetailsOpen} onMouseEnter={()=>setContextDetailsDismissed(false)} onFocus={()=>setContextDetailsDismissed(false)} onClick={()=>{setContextDetailsDismissed(contextDetailsOpen);setContextDetailsOpen(!contextDetailsOpen);}} onBlur={()=>{setContextDetailsOpen(false);setContextDetailsDismissed(false);}} onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();setContextDetailsOpen(false);setContextDetailsDismissed(true);}}} aria-label={contextPercent === null ? "Uso de contexto no disponible" : `${contextPercent}% del contexto utilizado`}>
          <svg viewBox="0 0 22 22" aria-hidden="true">
            <circle cx="11" cy="11" r="8.5" pathLength="100" />
            {contextPercent !== null ? <circle className="agent-composer-context-value" cx="11" cy="11" r="8.5" pathLength="100" strokeDasharray={`${contextPercent} ${100 - contextPercent}`} /> : null}
          </svg>
          <strong>{contextPercent === null ? "—" : `${contextPercent}%`}</strong>
          <span className="agent-composer-context-popover" role="tooltip" data-open={contextDetailsOpen}>
            <span><strong>Ventana de contexto</strong><em>{contextPercent === null ? "Sin datos del runtime" : `${contextPercent}% utilizado`}</em></span>
            {contextUsage ? <>
              <i aria-hidden="true"><b style={{ width: `${contextPercent ?? 0}%` }} /></i>
              <span><em>Usados</em><b>{formatTokens(contextUsage.usedTokens)}</b></span>
              <span><em>Disponibles</em><b>{formatTokens(Math.max(0, contextUsage.maxTokens - contextUsage.usedTokens))}</b></span>
              <span><em>Ventana total</em><b>{formatTokens(contextUsage.maxTokens)}</b></span>
            </> : <span><em>Codex publica los datos al procesar el próximo mensaje.</em></span>}
          </span>
        </button>
                {suggestions.length > 0 ? <button
                  type="button"
                  className="agent-composer-suggestions-trigger"
                  aria-label="Abrir ideas para continuar"
                  aria-expanded={suggestionsMenuOpen}
                  aria-controls={suggestionsMenuId}
                  disabled={disabled}
                  onClick={() => { setAddMenuOpen(false); setModelMenuOpen(false); setSuggestionsMenuOpen((open) => !open); }}
                ><MessageCircleQuestion size={14} /><span>Ideas</span></button> : null}
              </div> : null}

              <div className="agent-composer-toolbar-controls">
                {variant === 'reference' && onFiles ? <button type="button" className="agent-composer-icon-button agent-composer-add-trigger"
                  aria-label="Adjuntar archivos" title="Adjuntar archivos" disabled={disabled} onClick={() => fileInputRef.current?.click()}><Plus size={16}/></button> : null}
                {variant !== "reference" ? <button
                  ref={modelTriggerRef}
                  type="button"
                  className="agent-composer-model-trigger"
                  aria-label="Elegir modelo y esfuerzo"
                  data-tour-target="model-picker"
                  aria-expanded={modelMenuOpen}
                  aria-controls={modelMenuId}
                  aria-busy={!hasModelControl && modelFallbackLabel === "Cargando modelos…"}
                  disabled={working || !hasModelControl}
                  title={hasModelControl ? `${selectedModel?.label??'Modelo'}${selectedModel?.description?' · '+selectedModel.description:''} · Elegir modelo y esfuerzo` : modelFallbackLabel}
                  onClick={() => { setAddMenuOpen(false); setSuggestionsMenuOpen(false); setModelMenuOpen((open) => !open); }}
                >
                  <span className="syka-provider-model-icon" data-provider={selectedModel?.id.split(':')[0]} aria-hidden="true">{selectedModel?.logoSvg ? <span dangerouslySetInnerHTML={{__html:selectedModel.logoSvg}}/> : <Globe2 size={15}/>}</span><span className="syka-model-trigger-label"><span>{modelTriggerLabel}</span>{selectedModel?.routeLabel?<small>{selectedModel.routeLabel}</small>:null}</span>
                  <ChevronDown size={12} />
                </button> : null}

                {dictationContext !== undefined ? <DictationControl key={dictationContext} disabled={disabled} onText={(text) => {
                  const input = inputRef.current;
                  const start = input?.selectionStart ?? draftText.length;
                  const end = input?.selectionEnd ?? start;
                  const before = draftText.slice(0, start), after = draftText.slice(end);
                  const insert = `${before && !/\s$/.test(before) ? " " : ""}${text}${after && !/^\s/.test(after) ? " " : ""}`;
                  updateDraft(before + insert + after,draftLinks);
                  requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + insert.length, start + insert.length); });
                }}/> : (
                <button
                  ref={voiceButtonRef}
                  type="button"
                  className="agent-composer-icon-button agent-composer-voice"
                  aria-label={voice.active ? "Detener voz" : "Iniciar voz"}
                  data-tour-target="dictation"
                  aria-pressed={Boolean(voice.active)}
                  disabled={disabled || !voice.enabled || !voice.onToggle}
                  title={voice.enabled ? "Voz" : voice.unavailableReason ?? "Voz no disponible"}
                  onClick={voice.onToggle}
                >
                  <Mic size={16} />
                </button>
                )}

                {primaryAction === "send" ? (
                  <MetalFx
                    className="agent-composer-primary-metal"
                    data-disabled={primaryDisabled ? "true" : "false"}
                    variant="button"
                    preset="chromatic"
                    strength={1}
                    theme={appearance.theme}
                    paused={appearance.reducedMotion}
                    borderRadius={8}
                    ringCssPx={1.4}
                    reflectionTargets={metalReflectionTargets}
                  >
                    <button
                      type="button"
                      className="agent-composer-primary"
                      data-action="send"
                      aria-label={primaryLabel}
                      disabled={primaryDisabled}
                      onClick={submit}
                    >
                      <ArrowUp size={17} />
                    </button>
                  </MetalFx>
                ) : (
                  <button
                    type="button"
                    className="agent-composer-primary"
                    data-action="stop"
                    aria-label={primaryLabel}
                    disabled={primaryDisabled}
                    onClick={onStop}
                  >
                    {canceling
                      ? <LoaderCircle className="agent-composer-cancel-spinner" size={14} />
                      : <Square size={12} fill="currentColor" />}
                  </button>
                )}
              </div>
            </div>
          </div>
      </div>

      {notice ? <div className="agent-composer-status-row">
        <span className="agent-composer-notice" role="status">{notice}</span>

      </div> : null}
    </div>
  );
}

function AgentComposerQueueTray({
  messages,
  queueEnabled,
  redirectingQueueId,
  onRedirect,
  onEdit,
  onDelete,
}: {
  messages: readonly AgentComposerQueuedMessage[];
  queueEnabled: boolean;
  redirectingQueueId: string | null;
  onRedirect: ((messageId: string) => void) | undefined;
  onEdit: ((messageId: string) => void) | undefined;
  onDelete: ((messageId: string) => void) | undefined;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const active = messages[0]!;

  useEffect(() => {
    if (!menuOpen && !queueOpen) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setQueueOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen, queueOpen]);

  return (
    <div ref={rootRef} className="agent-composer-queue" data-enabled={queueEnabled}>
      {queueOpen ? (
        <section className="agent-composer-queue-panel" role="dialog" aria-label="Mensajes en cola">
          <header><span>Cola</span><small>{messages.length}</small><button type="button" aria-label="Cerrar cola" onClick={() => setQueueOpen(false)}><X size={13} /></button></header>
          <div>
            {messages.map((message, index) => (
              <article key={message.id}>
                <span>{index + 1}</span>
                <p>{message.content}</p>
                {message.attachments.length > 0 ? <small><Paperclip size={11} />{message.attachments.length}</small> : null}
                <button type="button" aria-label={`Editar mensaje ${index + 1}`} onClick={() => { onEdit?.(message.id); setQueueOpen(false); }}><Pencil size={12} /></button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {menuOpen ? (
        <div className="agent-composer-queue-menu" role="menu" aria-label="Opciones del mensaje en cola">
          <button type="button" role="menuitem" onClick={() => { onEdit?.(active.id); setMenuOpen(false); }}><Pencil size={15} strokeWidth={1.6} /><span>Editar mensaje</span></button>
          <button type="button" role="menuitem" onClick={() => { onDelete?.(active.id); setMenuOpen(false); }}><Trash2 size={15} strokeWidth={1.6} /><span>Eliminar mensaje</span></button>
        </div>
      ) : null}

      <div className="agent-composer-queue-ear">
        <span className="agent-composer-queue-leading" aria-hidden="true"><Rows3 size={14} strokeWidth={1.6} /></span>
        <p title={active.content}>{active.content}</p>
        {active.attachments.length > 0 ? <span className="agent-composer-queue-files" title={`${active.attachments.length} archivos adjuntos`}><Paperclip size={11} />{active.attachments.length}</span> : null}
        {messages.length > 1 ? <button className="agent-composer-queue-count" type="button" aria-label={`Abrir ${messages.length} mensajes en cola`} onClick={() => { setMenuOpen(false); setQueueOpen((open) => !open); }}>+{messages.length - 1}</button> : null}
        <button
          className="agent-composer-queue-steer-text"
          data-busy={redirectingQueueId === active.id}
          type="button"
          disabled={!onRedirect || redirectingQueueId === active.id}
          onClick={() => onRedirect?.(active.id)}
        >
          {redirectingQueueId === active.id ? <LoaderCircle size={14} strokeWidth={1.6} /> : <CornerDownLeft size={14} strokeWidth={1.6} />}
          <span>Redirigir</span>
        </button>
        <button className="agent-composer-queue-icon" type="button" aria-label="Más opciones del mensaje en cola" aria-expanded={menuOpen} onClick={() => { setQueueOpen(false); setMenuOpen((open) => !open); }}><MoreHorizontal size={16} strokeWidth={1.7} /></button>
      </div>
    </div>
  );
}

function formatTokens(tokens: number): string {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(tokens / 1_000)} mil tokens`;
}

