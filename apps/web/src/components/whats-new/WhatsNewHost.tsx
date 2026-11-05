import { createEffect, onCleanup, Show } from 'solid-js';
import SykaWhatsNew from './SykaWhatsNew';
import { closeWhatsNew, hasSeenWhatsNew, openWhatsNew, whatsNewOpen, whatsNewSession } from './whats-new-store';
import type { SettingsPage } from '@/components/settings/state';

/**
 * Opens What's new ~0.9 s after the window shows, the first time with each
 * release. A window that starts hidden opens it the first time it is shown.
 */
export function WhatsNewHost(props: { onOpenSettings: (section: SettingsPage) => void; autoOpenDelayMs?: number }) {
  createEffect(() => {
    if (hasSeenWhatsNew()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      if (!document.hidden && !hasSeenWhatsNew()) timer = setTimeout(openWhatsNew, props.autoOpenDelayMs ?? 900);
    };
    arm();
    document.addEventListener('visibilitychange', arm);
    onCleanup(() => { clearTimeout(timer); document.removeEventListener('visibilitychange', arm); });
  });
  // Keyed on the session: every opening starts again from the first page.
  return <Show when={whatsNewSession()} keyed>
    {(_session: number) => <SykaWhatsNew open={whatsNewOpen()} onClose={closeWhatsNew} onOpenSettings={props.onOpenSettings} />}
  </Show>;
}
