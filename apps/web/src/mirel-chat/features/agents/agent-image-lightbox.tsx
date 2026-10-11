/** @jsxImportSource react */
import { ChevronLeft, ChevronRight, ExternalLink, X, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import './agent-reference-detail.css';

export interface AgentLightboxImage {
  id: string;
  name: string;
  previewUrl: string;
  contentUrl?: string;
  detail?: { kind?: string; instruction?: string; context?: unknown; path?: string; onReveal?(): void };
}
interface AgentImageLightboxProps {
  images: readonly AgentLightboxImage[];
  activeIndex: number | null;
  onActiveIndexChange(index: number | null): void;
  triggerRef?: RefObject<HTMLElement | null>;
  onRemove?(id: string): void;
}

export function AgentImageLightbox({ images, activeIndex, onActiveIndexChange, triggerRef, onRemove }: AgentImageLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const current = activeIndex === null ? undefined : images[activeIndex];
  const retained = useRef(current);
  if (current) retained.current = current;
  const image = current ?? retained.current;
  const requestedOpen = !!current;
  const [present, setPresent] = useState(requestedOpen);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (requestedOpen) {
      setPresent(true);
      const frame = requestAnimationFrame(() => { void dialogRef.current?.offsetHeight; setOpen(true); });
      return () => cancelAnimationFrame(frame);
    }
    setOpen(false);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.sykaMotion === 'reduced';
    const duration = reduced ? 0 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--modal-close-dur')) || 150;
    const timer = setTimeout(() => setPresent(false), duration);
    return () => clearTimeout(timer);
  }, [requestedOpen]);

  useEffect(() => {
    if (!present) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); onActiveIndexChange(null); return;
      }
      if (event.key === 'Tab') {
        const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary') ?? [])];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault(); event.stopImmediatePropagation();
      onActiveIndexChange(Math.min(images.length - 1, Math.max(0, (activeIndexRef.current ?? 0) + (event.key === 'ArrowLeft' ? -1 : 1))));
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (triggerRef?.current?.isConnected) triggerRef.current.focus();
      else document.querySelector<HTMLTextAreaElement>('textarea[data-tour-target="chat-message"]')?.focus();
    };
  }, [images.length, onActiveIndexChange, present, triggerRef]);

  if (!present || !image || typeof document === 'undefined') return null;
  const originalUrl = image.contentUrl ?? image.previewUrl;
  const detail = image.detail;
  const context = detail?.context && typeof detail.context === 'object' ? detail.context as Record<string, unknown> : undefined;
  const time = typeof context?.timeSeconds === 'number' ? context.timeSeconds : undefined;
  const elements = Array.isArray(context?.elements) ? context.elements as {name?: string; key?: string}[] : [];
  const index = activeIndex ?? 0;
  return createPortal(
    <div ref={dialogRef} className="agent-image-lightbox-backdrop agent-reference-lightbox" data-open={open}
      role="dialog" aria-modal="true" aria-label={`Previsualización de ${image.name}`}
      onMouseDown={event => { if (event.target === event.currentTarget) onActiveIndexChange(null); }}>
      <button ref={closeButtonRef} type="button" className="agent-image-lightbox-close" aria-label="Cerrar previsualización" onClick={() => onActiveIndexChange(null)}><X size={19}/></button>
      {images.length > 1 ? <button type="button" className="agent-image-lightbox-arrow agent-image-lightbox-arrow-prev" aria-label="Imagen anterior" disabled={index === 0} onClick={() => onActiveIndexChange(index - 1)}><ChevronLeft size={24}/></button> : null}
      {detail ? <section className="agent-reference-detail" key={image.id}>
        <img src={image.previewUrl} alt={image.name} decoding="async"/>
        <div className="agent-reference-detail-body">
          <small>{detail.kind ?? 'Referencia'}</small><h2>{image.name}</h2>
          {time !== undefined ? <span className="agent-reference-time">En {time.toFixed(2)} s{elements.length ? ` · ${elements.map(element => element.name || element.key).filter(Boolean).join(', ')}` : ''}</span> : null}
          {detail.instruction ? <><h3>Indicación para el agente</h3><p>{detail.instruction}</p></> : null}
          {context ? <details><summary>Ver contexto completo</summary><pre>{JSON.stringify(context, null, 2)}</pre></details> : null}
          {detail.path ? <p className="agent-reference-path" title={detail.path}>{detail.path}</p> : null}
          {detail.onReveal ? <button type="button" className="agent-reference-file" onClick={detail.onReveal}>Mostrar archivo <ExternalLink size={13}/></button> : null}
        </div>
      </section> : <img key={image.id} src={originalUrl} alt={image.name} decoding="async"/>}
      {images.length > 1 ? <button type="button" className="agent-image-lightbox-arrow agent-image-lightbox-arrow-next" aria-label="Imagen siguiente" disabled={index === images.length - 1} onClick={() => onActiveIndexChange(index + 1)}><ChevronRight size={24}/></button> : null}
      <div className="agent-image-lightbox-meta">
        <span>{image.name}</span>{images.length > 1 ? <small>{index + 1} / {images.length}</small> : null}
        {!detail ? <a href={originalUrl} target="_blank" rel="noreferrer">Abrir original <ExternalLink size={12}/></a> : null}
        {onRemove ? <button type="button" aria-label={`Quitar ${image.name}`} onClick={() => { onActiveIndexChange(null); onRemove(image.id); }}><Trash2 size={13}/>Quitar</button> : null}
      </div>
    </div>, document.fullscreenElement ?? document.body,
  );
}
