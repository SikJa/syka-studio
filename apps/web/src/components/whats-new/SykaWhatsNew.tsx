import { createEffect, createSignal, For, onCleanup, Show, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Icon } from './whats-new-icon';
import { WhatsNewArt } from './WhatsNewArt';
import { useWhatsNewMessages } from './whats-new-messages';
import { WHATS_NEW_PAGES, type WhatsNewPage } from './whats-new-pages';
import type { SettingsPage } from '@/components/settings/state';
import { useDarkTheme } from './dark-theme';

import './whats-new.css';
import './syka-studio-whats-new.css';

const SWIPE_DISTANCE = 44;
const LAST_INDEX = WHATS_NEW_PAGES.length - 1;

function pageAt(index: number): WhatsNewPage {
  const page = WHATS_NEW_PAGES[index] ?? WHATS_NEW_PAGES[0];
  if (page === undefined) throw new Error("What's new has no pages");
  return page;
}

/**
 * Kevin's What's new card (Syka Legacy), ported from Whispera's copy to Solid.
 * Its markup and classes are the original ones, so whats-new.css drives it
 * unchanged; the dialog is the card's own: centred, Esc and a click outside
 * close it, and focus enters the card.
 */
export default function SykaWhatsNew(props: { open: boolean; onClose: () => void; onOpenSettings: (section: SettingsPage) => void }) {
  const t = useWhatsNewMessages();
  const dark = useDarkTheme();
  const [paging, setPaging] = createSignal<{ index: number; direction: 'forward' | 'back' }>({ index: 0, direction: 'forward' });
  let content: HTMLDivElement | undefined;
  let swipe: { pointerId: number; x: number; y: number } | null = null;
  const page = () => pageAt(paging().index);
  const isFirst = () => paging().index === 0;
  const isLast = () => paging().index === LAST_INDEX;

  function goTo(index: number) {
    const next = Math.min(Math.max(index, 0), LAST_INDEX);
    if (next === paging().index) return;
    setPaging({ index: next, direction: next > paging().index ? 'forward' : 'back' });
  }

  function advance() {
    if (isLast()) props.onClose();
    else goTo(paging().index + 1);
  }

  const handleKeyDown: JSX.EventHandler<HTMLDivElement, KeyboardEvent> = event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'Enter' && event.target === event.currentTarget) { event.preventDefault(); advance(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); goTo(paging().index + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(paging().index - 1); }
  };

  const handlePointerUp: JSX.EventHandler<HTMLDivElement, PointerEvent> = event => {
    const start = swipe;
    swipe = null;
    if (start === null || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    goTo(paging().index + (dx < 0 ? 1 : -1));
  };

  createEffect(() => {
    if (!props.open) return;
    const previous = document.activeElement as HTMLElement | null;
    queueMicrotask(() => content?.focus({ preventScroll: true }));
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); props.onClose(); } };
    window.addEventListener('keydown', onEscape);
    onCleanup(() => { window.removeEventListener('keydown', onEscape); previous?.focus?.({ preventScroll: true }); });
  });

  const titleId = 'syka-whats-new-title', textId = 'syka-whats-new-text';
  return <Show when={props.open}>
    <Portal mount={document.body}>
      <div class={dark() ? 'dark syka-studio-wn-root' : 'syka-studio-wn-root'}>
        <div class="syka-studio-wn-overlay" onClick={() => props.onClose()} />
        <div ref={content} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId} tabIndex={-1}
          class="syka-wn at-animate-pop fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2" data-testid="syka-whats-new" onKeyDown={handleKeyDown}>
          <div class="syka-wn-stage" data-direction={paging().direction}
            onPointerDown={event => { if (event.button === 0) swipe = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }; }}
            onPointerUp={handlePointerUp} onPointerCancel={() => { swipe = null; }}>
            <div class="syka-wn-hero" data-page={page().id} style={{ '--syka-wn-ha': String(page().hues[0]), '--syka-wn-hb': String(page().hues[1]) }}>
              <div class="syka-wn-glow" aria-hidden="true"><span data-blob="a" /><span data-blob="b" /><span data-blob="c" /></div>
              {/* Keyed: a new page builds a new node, so its entrance animations play again. */}
              <Show when={page()} keyed>{current =>
                <div class="syka-wn-art" data-art={current.id} aria-hidden="true"><WhatsNewArt page={current.id} /></div>}
              </Show>
              <button type="button" class="syka-wn-close" aria-label={t('close')} onClick={() => props.onClose()}>
                <Icon name="X" aria-hidden="true" />
              </button>
            </div>
            <div class="syka-wn-body">
              <h2 id={titleId} class="syka-wn-eyebrow">{t('title')}</h2>
              <div class="syka-wn-copy" aria-live="polite">
                <Show when={page()} keyed>{current =>
                  <div class="syka-wn-copy-page">
                    <h3 class="syka-wn-heading">{t(`${current.id}.title`)}</h3>
                    <p id={textId} class="syka-wn-text">{t(`${current.id}.body`)}</p>
                    <span class="sr-only">{t('progress', { current: paging().index + 1, total: WHATS_NEW_PAGES.length })}</span>
                    <Show when={current.link}>{link =>
                      <button type="button" class="syka-wn-link" onClick={() => { props.onClose(); props.onOpenSettings(link().section); }}>
                        {t(link().label)}
                        <Icon name="ArrowRight" aria-hidden="true" />
                      </button>}
                    </Show>
                  </div>}
                </Show>
              </div>
            </div>
          </div>
          <div class="syka-wn-footer">
            <div class="syka-wn-dots" role="group" aria-label={t('pages')}>
              <For each={WHATS_NEW_PAGES}>{(item, index) =>
                <button type="button" class="syka-wn-dot" aria-label={t('goTo', { title: t(`${item.id}.title`) })}
                  aria-current={index() === paging().index ? 'step' : undefined} onClick={() => goTo(index())} />}
              </For>
            </div>
            <button type="button" class="syka-wn-primary" onClick={advance}>{isLast() ? t('start') : t('next')}</button>
            <button type="button" class="syka-wn-secondary" onClick={() => (isFirst() ? props.onClose() : goTo(paging().index - 1))}>
              {isFirst() ? t('notNow') : t('back')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  </Show>;
}
