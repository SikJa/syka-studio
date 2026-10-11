import { Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { Portal } from 'solid-js/web';
import { t } from '@/i18n';
import { EDITOR_TOUR_EVENT, EDITOR_TOUR_STEPS, placeTourCard, readTourProgress, resolveEditorTourTarget, saveTourProgress, setEditorTourVisible, type TourRect } from './editor-tour-model';
import './editor-tour.css';

let activeHost: symbol | null = null;
const visible = (element: HTMLElement) => {
  if (element.closest('[data-chat-transition-clone], [inert], [aria-hidden="true"], [hidden]')) return false;
  const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth
    && style.visibility !== 'hidden' && style.display !== 'none' && (!element.checkVisibility || element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
};

/** A non-modal, voluntary guide. It never sends a chat message or edits a project. */
export function EditorTour(props: { menuAnchor: () => HTMLElement | undefined }) {
  const host = Symbol('editor-tour');
  const [phase, setPhase] = createSignal<'closed' | 'invite' | 'active' | 'closing'>('closed');
  const [stepIndex, setStepIndex] = createSignal(0);
  const [rect, setRect] = createSignal<TourRect | null>(null);
  const [position, setPosition] = createSignal({ x: 12, y: 44 });
  const step = () => EDITOR_TOUR_STEPS[stepIndex()]!;
  let card: HTMLDivElement | undefined, focusBefore: HTMLElement | null = null, lastComposer: Element | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | undefined, focusTimer: ReturnType<typeof setTimeout> | undefined;
  let lastRect = '', lastTargetStep = '';
  createEffect(() => { const shown = phase() !== 'closed'; if (activeHost === host) setEditorTourVisible(shown); });
  const target = () => {
    const current = step();
    const focusedComposer = document.activeElement?.closest('.agent-composer') ?? lastComposer;
    const priority = (el: HTMLElement) => (focusedComposer?.contains(el) ? 10 : 0) + (el.closest('.syka-agent-chat') ? 2 : 0);
    return resolveEditorTourTarget(current, selector => document.querySelectorAll<HTMLElement>(selector), visible, priority);
  };
  const measure = () => {
    if (phase() !== 'active') return;
    const element = target(), bounds = element?.getBoundingClientRect();
    // The real chat is briefly hidden while a noninteractive clone animates.
    // Keep the previous cue instead of announcing a missing control mid-flight.
    if (!bounds && lastTargetStep === step().id && document.querySelector('[data-chat-transition-clone]')) return;
    if (bounds) lastTargetStep = step().id;
    const next = bounds ? { x: Math.max(4, bounds.x - 5), y: Math.max(4, bounds.y - 5), width: Math.max(0, Math.min(innerWidth - 4, bounds.right + 5) - Math.max(4, bounds.x - 5)), height: Math.max(0, Math.min(innerHeight - 4, bounds.bottom + 5) - Math.max(4, bounds.y - 5)) } : null;
    const signature = JSON.stringify(next);
    if (signature !== lastRect) { setRect(next); lastRect = signature; }
    const size = card?.getBoundingClientRect();
    const nextPosition = placeTourCard(next, { width: innerWidth, height: innerHeight }, { width: size?.width || Math.min(312, innerWidth - 24), height: size?.height || 244 });
    setPosition(previous => previous.x === nextPosition.x && previous.y === nextPosition.y ? previous : nextPosition);
  };
  const finish = (completed = false) => {
    saveTourProgress(localStorage, completed ? 'completed' : 'dismissed', stepIndex());
    setPhase('closing');
    clearTimeout(focusTimer); clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { setPhase('closed'); setRect(null); }, 350);
    const fallback = props.menuAnchor();
    const previous = focusBefore?.isConnected && focusBefore !== document.body && focusBefore !== document.documentElement && visible(focusBefore) ? focusBefore : fallback;
    if (card?.contains(document.activeElement)) previous?.focus({ preventScroll: true });
  };
  const start = () => {
    if (!props.menuAnchor() || !visible(props.menuAnchor()!)) return;
    if (activeHost && activeHost !== host) return;
    clearTimeout(closeTimer); clearTimeout(focusTimer);
    focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : props.menuAnchor() ?? null;
    setStepIndex(0); setPhase('active'); lastRect = ''; measure();
    focusTimer = setTimeout(() => { measure(); card?.focus({ preventScroll: true }); }, 160);
  };
  const move = (delta: number) => {
    if (stepIndex() + delta >= EDITOR_TOUR_STEPS.length) { finish(true); return; }
    setStepIndex(Math.max(0, stepIndex() + delta)); lastRect = ''; measure();
  };
  onMount(() => {
    if (activeHost) return;
    activeHost = host;
    const handleStart = () => start();
    const handleFocus = (event: FocusEvent) => {
      const composer = event.target instanceof Element ? event.target.closest('.agent-composer') : null;
      if (composer && !composer.closest('[inert], [data-chat-transition-clone]')) lastComposer = composer;
    };
    const handleKey = (event: KeyboardEvent) => {
      if (phase() !== 'active' || event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(); }
      else if (card?.contains(document.activeElement) && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) { event.preventDefault(); event.stopPropagation(); move(event.key === 'ArrowRight' ? 1 : -1); }
    };
    window.addEventListener(EDITOR_TOUR_EVENT, handleStart);
    window.addEventListener('focusin', handleFocus);
    window.addEventListener('keydown', handleKey, true);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    // Poll only geometry while visible, including panels animated by the editor.
    const tracker = setInterval(measure, 180);
    const invitation = setTimeout(() => { if (phase() === 'closed' && readTourProgress(localStorage).status === 'new') setPhase('invite'); }, 1200);
    onCleanup(() => {
      if (activeHost === host) { activeHost = null; setEditorTourVisible(false); }
      window.removeEventListener(EDITOR_TOUR_EVENT, handleStart); window.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('focusin', handleFocus);
      window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true);
      clearInterval(tracker); clearTimeout(invitation); clearTimeout(closeTimer); clearTimeout(focusTimer);
    });
  });
  return <Portal>
    <Show when={phase() === 'invite'}>
      <aside class="syka-tour-invitation t-panel-slide" data-open="true" aria-label="Conocé el editor">
        <strong>¿Te muestro el editor?</strong>
        <p>Un recorrido corto por las herramientas, sin cambiar tu proyecto.</p>
        <div><button type="button" onClick={() => { saveTourProgress(localStorage, 'dismissed', 0); setPhase('closed'); }}>Ahora no</button><button type="button" class="syka-tour-primary" onClick={start}>Ver recorrido</button></div>
      </aside>
    </Show>
    <Show when={phase() === 'active' || phase() === 'closing'}>
      <Show when={rect()}>{box => <div aria-hidden="true" class="syka-tour-spotlight" data-open={phase() === 'active'} style={{ transform: `translate(${box().x}px,${box().y}px)`, width: `${box().width}px`, height: `${box().height}px` }} />}</Show>
      <div class="syka-tour-position" style={{ transform: `translate(${position().x}px,${position().y}px)` }}>
        <div ref={card} role="dialog" aria-modal="false" aria-hidden={phase() === 'closing' ? true : undefined} aria-label="Recorrido del editor" aria-describedby="syka-tour-copy" tabIndex={-1} class="syka-tour-card t-panel-slide" data-open={phase() === 'active'}>
          <header><span>CONOCÉ SYKA <b>{stepIndex() + 1} / {EDITOR_TOUR_STEPS.length}</b></span><button type="button" aria-label="Cerrar recorrido" title="Cerrar · Esc" onClick={() => finish()}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8"/></svg></button></header>
          <div aria-live="polite" aria-atomic="true"><h2>{t(step().title)}</h2>
          <p id="syka-tour-copy">{t(step().body)}</p></div>
          <Show when={!rect()}><small class="syka-tour-muted">Esta zona está oculta en tu vista. Podés continuar y abrirla después.</small></Show>
          <Show when={step().shortcut}><small class="syka-tour-shortcut">{t(step().shortcut)}</small></Show>
          <footer><button type="button" class="syka-tour-skip" onClick={() => finish()}>Omitir</button><div><button type="button" disabled={stepIndex() === 0} onClick={() => move(-1)}>Atrás</button><button type="button" class="syka-tour-primary" onClick={() => move(1)}>{stepIndex() === EDITOR_TOUR_STEPS.length - 1 ? 'Terminar' : 'Siguiente'}</button></div></footer>
        </div>
      </div>
    </Show>
  </Portal>;
}
