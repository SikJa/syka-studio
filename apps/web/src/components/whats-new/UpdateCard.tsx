import { createEffect, onCleanup, onMount, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { connectUpdates, setUpdateAnnouncement, updateAnnouncement, updateCommand, updateState } from '@/components/dashboard/update-menu';
import { Icon } from './whats-new-icon';
import { BrandArt } from './WhatsNewArt';
import { useWhatsNewMessages } from './whats-new-messages';
import { useDarkTheme } from './dark-theme';
import { whatsNewOpen } from './whats-new-store';

import './whats-new.css';
import './syka-studio-whats-new.css';

/**
 * The new-version card: Kevin's What's new card with a single page, centred
 * over a dimmed window like the card itself. It opens when the updater finds a
 * version (and again when it is ready to install), follows the download and
 * stays until it is dismissed. The update menu keeps the same state.
 */
function UpdateCard() {
  const t = useWhatsNewMessages();
  const dark = useDarkTheme();
  let content: HTMLDivElement | undefined;
  const state = updateState;
  const phase = () => state().phase;
  const dismiss = () => setUpdateAnnouncement(null);
  const title = () => t(phase() === 'downloading' ? 'update.downloading.title' : phase() === 'ready' ? 'update.ready.title' : phase() === 'error' ? 'update.error.title' : 'update.available.title');
  const body = () => phase() === 'error' ? state().message ?? '' : t(phase() === 'downloading' ? 'update.downloading.body' : phase() === 'ready' ? 'update.ready.body' : 'update.available.body', { version: state().availableVersion ?? '' });
  const primary = () => {
    if (phase() === 'ready') void updateCommand('install');
    else void updateCommand('download');
  };

  createEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    queueMicrotask(() => content?.focus({ preventScroll: true }));
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); dismiss(); } };
    window.addEventListener('keydown', onEscape);
    onCleanup(() => { window.removeEventListener('keydown', onEscape); previous?.focus?.({ preventScroll: true }); });
  });

  return <Portal mount={document.body}>
    <div class={dark() ? 'dark syka-studio-wn-root' : 'syka-studio-wn-root'}>
      <div class="syka-studio-wn-overlay" onClick={dismiss} />
      <div ref={content} role="dialog" aria-modal="true" aria-labelledby="syka-update-title" aria-describedby="syka-update-text" tabIndex={-1}
        class="syka-wn syka-studio-wn-update at-animate-pop fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2" data-testid="syka-update-card">
        <div class="syka-wn-stage" data-direction="forward">
          <div class="syka-wn-hero" data-page="update" style={{ '--syka-wn-ha': '156', '--syka-wn-hb': '244' }}>
            <div class="syka-wn-glow" aria-hidden="true"><span data-blob="a" /><span data-blob="b" /><span data-blob="c" /></div>
            <div class="syka-wn-art" data-art="update" aria-hidden="true">
              <BrandArt t={t} head={t('update.versions')} action={t('update.restart')} rows={[
                { icon: 'SecurityCheck', title: t('update.verified'), body: t('update.verifiedBody') },
                { icon: 'Folder', title: t('update.kept'), body: t('update.keptBody') },
              ]} />
            </div>
            <span class="syka-wn-update-chip">{state().currentVersion}<i>→</i><b>{state().availableVersion}</b></span>
            <button type="button" class="syka-wn-close" aria-label={t('update.notNow')} onClick={dismiss}><Icon name="X" aria-hidden="true" /></button>
          </div>
          <div class="syka-wn-body">
            <p class="syka-wn-eyebrow">{t('update.eyebrow')}</p>
            <div class="syka-wn-copy" aria-live="polite">
              <div class="syka-wn-copy-page">
                <h3 id="syka-update-title" class="syka-wn-heading">{title()}</h3>
                <p id="syka-update-text" class="syka-wn-text">{body()}</p>
                <Show when={phase() === 'downloading'}>
                  <div class="syka-wn-update-progress" role="progressbar" aria-label={title()} aria-valuemin={0} aria-valuemax={100}
                    aria-valuenow={Math.round((state().progress ?? 0) * 100)}>
                    <span style={{ width: `${Math.round((state().progress ?? 0) * 100)}%` }} />
                  </div>
                </Show>
                <Show when={state().releaseUrl && phase() !== 'downloading'}>
                  <button type="button" class="syka-wn-link" onClick={() => void updateCommand('notes')}>{t('update.notes')}<Icon name="ArrowRight" aria-hidden="true" /></button>
                </Show>
              </div>
            </div>
          </div>
        </div>
        <div class="syka-wn-footer">
          <div class="syka-wn-dots" aria-hidden="true" />
          <Show when={phase() !== 'downloading'}>
            <button type="button" class="syka-wn-primary" onClick={primary}>
              {t(phase() === 'ready' ? 'update.install' : phase() === 'error' ? 'update.retry' : 'update.download')}
            </button>
          </Show>
          <button type="button" class="syka-wn-secondary" onClick={dismiss}>{t(phase() === 'downloading' ? 'update.background' : 'update.notNow')}</button>
        </div>
      </div>
    </div>
  </Portal>;
}

/** Mounted once at app level, including direct launches into the editor. It waits while What's new is open: one card at a time. */
export function UpdateCardHost() {
  onMount(connectUpdates);
  return <Show when={updateAnnouncement() && !whatsNewOpen()}><UpdateCard /></Show>;
}
