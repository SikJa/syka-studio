import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { Dialog as DialogPrimitive } from '@kobalte/core/dialog';
import { openSettings } from '@/components/settings/state';
import { WhatsNewArt } from './whats-new-art';
import { WHATS_NEW_PAGES } from './whats-new-pages';
import { WHATS_NEW_RELEASE, closeWhatsNew, hasSeenWhatsNew, openWhatsNew, whatsNewOpen, whatsNewSession } from './whats-new-store';
import './whats-new.css';

// "Novedades de Syka": a short paged story in one card, ported from the Syka
// app's what's-new modal. It opens once per release, a moment after the app
// has painted, and can be reopened from the updates menu.

const SWIPE_DISTANCE = 44;
const AUTO_OPEN_DELAY_MS = 900;
const LAST = WHATS_NEW_PAGES.length - 1;

function WhatsNew() {
  const [index, setIndex] = createSignal(0);
  const [direction, setDirection] = createSignal<'forward' | 'back'>('forward');
  let swipe: { id: number; x: number; y: number } | null = null;
  let content: HTMLDivElement | undefined;
  const page = () => WHATS_NEW_PAGES[index()]!;

  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), LAST);
    if (clamped === index()) return;
    setDirection(clamped > index() ? 'forward' : 'back');
    setIndex(clamped);
  };
  const advance = () => index() === LAST ? closeWhatsNew() : goTo(index() + 1);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'Enter' && event.target === event.currentTarget) { event.preventDefault(); advance(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); goTo(index() + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(index() - 1); }
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipe; swipe = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    goTo(index() + (dx < 0 ? 1 : -1));
  };

  return <DialogPrimitive open={whatsNewOpen()} onOpenChange={next => { if (!next) closeWhatsNew(); }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay class="syka-wn-overlay" />
      <DialogPrimitive.Content ref={content} class="syka-wn" data-testid="syka-whats-new" tabIndex={-1} onKeyDown={onKeyDown}
        onOpenAutoFocus={event => { event.preventDefault(); content?.focus({ preventScroll: true }); }}>
        <div class="syka-wn-stage" data-direction={direction()}
          onPointerDown={event => { if (event.button === 0) swipe = { id: event.pointerId, x: event.clientX, y: event.clientY }; }}
          onPointerUp={onPointerUp} onPointerCancel={() => { swipe = null; }}>
          <div class="syka-wn-hero" data-page={page().id} style={{ '--syka-wn-ha': String(page().hues[0]), '--syka-wn-hb': String(page().hues[1]) }}>
            <div class="syka-wn-glow" aria-hidden="true"><span data-blob="a" /><span data-blob="b" /><span data-blob="c" /></div>
            <Show when={page().id} keyed>{id => <div class="syka-wn-art" data-art={id} aria-hidden="true"><WhatsNewArt page={id} /></div>}</Show>
            <button type="button" class="syka-wn-close" aria-label="Cerrar" onClick={closeWhatsNew}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5" /></svg>
            </button>
          </div>
          <div class="syka-wn-body">
            <DialogPrimitive.Title class="syka-wn-eyebrow">Novedades de Syka Studio {WHATS_NEW_RELEASE}</DialogPrimitive.Title>
            <div class="syka-wn-copy" aria-live="polite">
              <Show when={page()} keyed>{current => <div class="syka-wn-copy-page">
                <h3 class="syka-wn-heading">{current.title}</h3>
                <DialogPrimitive.Description class="syka-wn-text">{current.body}</DialogPrimitive.Description>
                <span class="sr-only">{index() + 1} de {WHATS_NEW_PAGES.length}</span>
                <Show when={current.link}>{link => <button type="button" class="syka-wn-link" onClick={() => { closeWhatsNew(); openSettings(link().settings); }}>
                  {link().label}
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h11M11 6l4 4-4 4" /></svg>
                </button>}</Show>
              </div>}</Show>
            </div>
          </div>
        </div>
        <div class="syka-wn-footer">
          <div class="syka-wn-dots" role="group" aria-label="Novedades">
            {WHATS_NEW_PAGES.map((item, position) => <button type="button" class="syka-wn-dot" aria-label={`Ir a ${item.title}`}
              aria-current={index() === position ? 'step' : undefined} onClick={() => goTo(position)} />)}
          </div>
          <button type="button" class="syka-wn-primary" onClick={advance}>{index() === LAST ? 'Empezar' : 'Siguiente'}</button>
          <button type="button" class="syka-wn-secondary" onClick={() => index() === 0 ? closeWhatsNew() : goTo(index() - 1)}>{index() === 0 ? 'Ahora no' : 'Atrás'}</button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive>;
}

/** Mounted once at the app root: opens the story the first time a release runs. */
export function WhatsNewHost(props: { autoOpenDelayMs?: number }) {
  onMount(() => {
    if (hasSeenWhatsNew() || navigator.webdriver) return;
    const timer = setTimeout(() => { if (!hasSeenWhatsNew()) openWhatsNew(); }, props.autoOpenDelayMs ?? AUTO_OPEN_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });
  // A fresh story per opening, starting on its first page.
  return <Show when={whatsNewSession()} keyed>{_session => <WhatsNew />}</Show>;
}
