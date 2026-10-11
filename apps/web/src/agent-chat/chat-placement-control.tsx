import { Show } from 'solid-js';
import { PreviewIcon } from '@/components/canvas/preview-icon';
import { chatDockReady, chatFloating, fullscreenChatMount, setChatFloating } from './chat-presentation';
import './chat-placement-control.css';

/** One icon in the header's trailing slot; text remains available to assistive tools. */
export function ChatPlacementButton() {
  return <button type="button" class="syka-chat-placement-action"
    aria-label={chatFloating() ? 'Acoplar chat' : 'Desacoplar chat'}
    title={chatFloating() ? 'Acoplar chat' : 'Desacoplar chat'}
    disabled={!!fullscreenChatMount()}
    onClick={() => setChatFloating(!chatFloating())}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <Show when={chatFloating()} fallback={<path d="M13 4h4a3 3 0 0 1 3 3v4m-1-6-7 7M9 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" />}>
        <rect x="3" y="4" width="18" height="16" rx="4" />
        <path d="M9 4v16m8-11-3 3 3 3m-3-3h4" />
      </Show>
    </svg>
  </button>;
}

/** The drag cue owns a temporary row, never an overlay on the conversation. */
export function ChatPlacementControl() {
  return <Show when={!fullscreenChatMount()}>
    <div class="syka-chat-placement-row" data-dock-ready={chatDockReady()}>
      <div class="syka-chat-dock-feedback t-panel-slide" data-open={chatDockReady()}
        role="status" aria-hidden={!chatDockReady()}>
        <PreviewIcon name="dock" />
        <span>Soltá para fijar el chat</span>
      </div>
    </div>
  </Show>;
}
