import { createEffect, createMemo, createSignal, on, onCleanup, Show } from 'solid-js';
import type { Item } from '@diffusionstudio/agent-chat';
import { currentActivity } from './transcript-visibility';

/** One transient surface for the whole turn, with no response actions or raw trace. */
export function TurnActivity(props: { items: Item[]; waiting: boolean; responding?: boolean }) {
  const activity = createMemo(() => props.responding && !props.waiting
    ? {label:'Escribiendo la respuesta',text:''} : currentActivity(props.items, props.waiting));
  const [label, setLabel] = createSignal(activity().label);
  const [phase, setPhase] = createSignal('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame: number | undefined;
  createEffect(on(() => activity().label, (next) => {
    clearTimeout(timer);
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (next === label()) { setPhase(''); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.querySelector('[data-motion="reduced"]')) {
      setLabel(next); setPhase(''); return;
    }
    setPhase('is-exit');
    timer = setTimeout(() => {
      setLabel(next); setPhase('is-enter-start');
      frame = requestAnimationFrame(() => setPhase(''));
    }, 150);
  }));
  onCleanup(() => { clearTimeout(timer); if (frame !== undefined) cancelAnimationFrame(frame); });
  return <section class="syka-turn-activity" data-turn-activity aria-label="Actividad de Syka" aria-busy={!props.waiting}>
    <span class="syka-orb-anchor" data-chat-orb-anchor="activity" aria-hidden="true" />
    <span class={'syka-turn-label t-text-swap ' + phase()} data-text={label()} role="status">{label()}</span>
    <Show when={activity().text}><p class="syka-turn-summary">{activity().text}</p></Show>
  </section>;
}
