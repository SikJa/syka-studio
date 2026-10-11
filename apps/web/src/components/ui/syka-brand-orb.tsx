import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AgentIdentityOrb } from '@/mirel-chat/features/agents/agent-identity-orb';
import { Icon } from './icon';
import { SYKA_ORB_STATE } from '@/lib/syka-brand';
import './syka-brand-orb.css';

const agent = { key: 'codex', name: 'Syka', orbState: SYKA_ORB_STATE, accent: '#a6b4c2' };

/** Same live orb and idle speed as the chat, in the existing 24px brand slot. */
export function SykaBrandOrb() {
  let host!: HTMLSpanElement;
  let root: Root | undefined;
  const [live, setLive] = createSignal(false);
  onMount(() => {
    if (!document.createElement('canvas').getContext('2d')) return;
    root = createRoot(host);
    root.render(createElement(AgentIdentityOrb, { agent, variant: 'header', state: SYKA_ORB_STATE, working: false }));
    setLive(true);
  });
  onCleanup(() => root?.unmount());
  return (
    <span class="syka-brand-orb size-6 shrink-0 text-foreground" aria-hidden="true">
      <Show when={!live()}><Icon name="syka-logo" class="size-6" /></Show>
      <span ref={host} class="syka-brand-orb-live" />
    </span>
  );
}
