/** @jsxImportSource react */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, FileText, X } from 'lucide-react';
import ProximitySidebar, { type ProximitySection } from '../../components/ui/proximity-sidebar';
import { parseAgentMarkdown, renderAgentBlock } from './agent-rich-text';
import './agent-document-reader.css';

export type AgentDocumentReaderProps = { body: string; title: string; fileName?: string; onClose(): void };

/** Native dialog gives this React island focus containment and a top-layer surface. */
export function AgentDocumentReader({ body, title, fileName, onClose }: AgentDocumentReaderProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [progress, setProgress] = useState(0);
  const id = useId().replaceAll(':', '');
  const titleId = `${id}-document-title`;
  const blocks = useMemo(() => {
    const parsed = parseAgentMarkdown(body);
    return parsed[0]?.type === 'heading' && parsed[0].text.replace(/[*_`]/g, '') === title ? parsed.slice(1) : parsed;
  }, [body, title]);
  const sections = useMemo<ProximitySection[]>(() => {
    const stride = Math.max(1, Math.ceil(blocks.length / 64));
    return [{ id: titleId, label: title, kind: 'title' }, ...blocks.flatMap<ProximitySection>((block, index) => {
      if (block.type === 'rule' || (block.type !== 'heading' && index % stride !== 0)) return [];
      const label = 'text' in block ? block.text : block.type === 'list' ? block.items[0] : block.type === 'table' ? block.headers.join(' · ') : 'Enlaces';
      return [{ id: `${id}-block-${index}`, label: label?.replace(/[*_`]/g, '').slice(0, 110) || `Sección ${index + 1}`,
        kind: block.type === 'heading' ? block.level === 1 ? 'title' : block.level === 2 ? 'subtitle' : 'section' : 'body' }];
    })];
  }, [blocks, id, title, titleId]);
  const minutes = Math.max(1, Math.ceil(body.split(/\s+/).length / 220));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.sykaMotion === 'reduced';
  const [downloadUrl, setDownloadUrl] = useState<string>();

  useLayoutEffect(() => {
    const node = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node.showModal();
    const frame = requestAnimationFrame(() => { void node.offsetHeight; setOpen(true); });
    return () => {
      cancelAnimationFrame(frame); clearTimeout(closeTimer.current); clearTimeout(copyTimer.current);
      node.close(); document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown;charset=utf-8' }));
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [body]);

  const close = () => {
    if (closeTimer.current !== undefined) return;
    setOpen(false);
    const duration = reduced ? 0 : parseFloat(getComputedStyle(dialog.current!).getPropertyValue('--modal-close-dur')) || 150;
    closeTimer.current = setTimeout(() => { dialog.current?.close(); onClose(); }, duration);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body); setCopied(true); setCopyError(false);
      clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch { setCopyError(true); }
  };

  return createPortal(<dialog ref={dialog} className={`syka-document-reader t-modal ${open ? 'is-open' : 'is-closing'}`}
    aria-labelledby={titleId} data-document-reader data-reduced={reduced}
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } }}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <header className="syka-document-toolbar">
      <span><FileText size={14} aria-hidden="true"/>Documento <i/> {minutes} min de lectura</span>
      <div role="group" aria-label="Acciones del documento">
        <button type="button" onClick={() => void copy()} aria-label={copied ? 'Documento copiado' : 'Copiar documento'} title="Copiar documento">{copied ? <Check/> : <Copy/>}</button>
        <a href={downloadUrl} download={fileName || 'documento-syka.md'} aria-label="Descargar documento" title="Descargar documento"><Download/></a>
        <button type="button" onClick={close} autoFocus aria-label="Cerrar documento" title="Cerrar · Esc"><X/></button>
      </div>
    </header>
    <div className="syka-document-layout">
      <aside className="syka-document-minimap"><ProximitySidebar sections={sections} side="left" activeOffset={0.34} updateHash={false} reduceMotion={reduced}/></aside>
      <div ref={scroll} className="syka-document-scroll" tabIndex={0} aria-label="Contenido completo del documento" onScroll={() => {
        const node = scroll.current!; setProgress(Math.round(100 * node.scrollTop / Math.max(1, node.scrollHeight - node.clientHeight)));
      }}>
        <article className="syka-document-content">
          <p className="syka-document-eyebrow">SYKA STUDIO · DOCUMENTO</p>
          <h1 id={titleId}>{title}</h1>
          <div className="agent-rich-text">{blocks.map((block, index) => <section key={index} id={`${id}-block-${index}`} className="syka-document-block">
            {renderAgentBlock(block, index, false)}
          </section>)}</div>
        </article>
      </div>
    </div>
    <footer className="syka-document-footer"><span>{copyError ? 'No se pudo copiar. Probá descargar el documento.' : fileName || 'Texto completo'}</span><span>{progress}%</span></footer>
  </dialog>, document.fullscreenElement ?? document.body);
}

export default AgentDocumentReader;
