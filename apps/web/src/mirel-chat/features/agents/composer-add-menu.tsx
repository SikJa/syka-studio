/** @jsxImportSource react */
import { createPortal } from 'react-dom';
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Paperclip, Sparkles } from 'lucide-react';
import type { AgentComposerMenuAction } from './agent-composer';
import './composer-add-menu.css';

export function ComposerAddMenu({ open, anchor, panelRef, id, actions, onFiles, onClose }: {
  open: boolean; anchor: RefObject<HTMLButtonElement | null>; panelRef: RefObject<HTMLDivElement | null>;
  id: string; actions: readonly AgentComposerMenuAction[]; onFiles?: () => void; onClose(): void;
}) {
  const [mounted, setMounted] = useState(open), [shown, setShown] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8, origin: 'bottom-left' });
  const [description, setDescription] = useState('Agregá contexto o elegí una herramienta.');
  const close = useRef(onClose); close.current = onClose;
  useLayoutEffect(() => {
    if (open) { setMounted(true); return; }
    setShown(false);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.sykaMotion === 'reduced';
    const duration = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dropdown-close-dur')) || 150;
    const timer = setTimeout(() => setMounted(false), reduced ? 0 : duration); return () => clearTimeout(timer);
  }, [open]);
  useLayoutEffect(() => {
    if (!mounted || !open || !anchor.current || !panelRef.current) return;
    const trigger = anchor.current, panel = panelRef.current;
    const place = () => {
      const box = trigger.getBoundingClientRect(), width = panel.offsetWidth, height = panel.offsetHeight;
      const above = box.top - height - 8 >= 8 || box.bottom + height + 8 > innerHeight;
      setPosition({ left: Math.max(8, Math.min(box.left, innerWidth - width - 8)), top: Math.max(8, Math.min(above ? box.top - height - 8 : box.bottom + 8, innerHeight - height - 8)), origin: above ? 'bottom-left' : 'top-left' });
    };
    place(); const frame = requestAnimationFrame(() => { setShown(true); panel.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); });
    const observer = new ResizeObserver(place); observer.observe(panel);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [mounted, open, anchor, panelRef]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (event.target instanceof Node && !panelRef.current?.contains(event.target) && !anchor.current?.contains(event.target)) close.current(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close.current(); anchor.current?.focus(); } };
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !panelRef.current?.contains(event.target)) close.current(); };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    window.addEventListener('resize', scroll); window.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', scroll); window.removeEventListener('scroll', scroll, true); };
  }, [open, anchor, panelRef]);
  const choose = (action: () => void) => { close.current(); action(); };
  if (!mounted) return null;
  return createPortal(<div ref={panelRef} id={id} role="dialog" aria-label="Agregar al chat" data-origin={position.origin} className={`syka-composer-add-menu t-dropdown ${shown ? 'is-open' : open ? '' : 'is-closing'}`} style={{ left: position.left, top: position.top }} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); close.current(); anchor.current?.focus(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const buttons = Array.from(panelRef.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      event.preventDefault(); buttons[next]?.focus();
    }
    if (event.key === 'Tab') close.current();
    event.stopPropagation();
  }} onKeyUp={event => event.stopPropagation()}>
    <div className="syka-composer-add-scroll">
      <small>Agregar</small>
      {onFiles ? <button type="button" onClick={() => choose(onFiles)} onFocus={() => setDescription('Adjuntá imágenes, videos, audio o documentos de tu computadora.')} onMouseEnter={() => setDescription('Adjuntá imágenes, videos, audio o documentos de tu computadora.')}><Paperclip size={16}/><span>Archivos y carpetas</span></button> : null}
      {actions.map((action, index) => <Fragment key={action.id}>
        {action.section && action.section !== actions[index - 1]?.section ? <small className="syka-composer-add-section">{action.section}</small> : null}
        <button type="button" disabled={action.disabled} title={action.disabled ? action.description : undefined} onClick={() => choose(action.onSelect)} onFocus={() => setDescription(action.description ?? action.label)} onMouseEnter={() => setDescription(action.description ?? action.label)}>
          <span className={`syka-composer-add-icon ${action.accent ? 'has-accent' : ''}`}>{action.icon ?? <Sparkles size={16}/>}</span><span>{action.label}</span>{action.hint ? <kbd>{action.hint}</kbd> : null}
        </button>
      </Fragment>)}
    </div>
    <p className="syka-composer-add-help">{description}</p>
  </div>, document.fullscreenElement ?? document.body);
}
