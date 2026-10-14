import { createEffect, createMemo, createSignal, on, onCleanup, Show } from 'solid-js';
import type { Item } from '@diffusionstudio/agent-chat';
import { currentActivity } from './transcript-visibility';
import { MirelToolMark } from './mirel-messages';
import { resolveToolBrand } from '@/mirel-chat/features/agents/thinking-logos/catalog';

/** One transient surface for the whole turn, with no response actions or raw trace. */
export function TurnActivity(props: { items: Item[]; waiting: boolean; responding?: boolean }) {
  const tool = createMemo(() => !props.waiting && !props.responding
    ? props.items.findLast((item): item is Extract<Item,{kind:'tool'}> => item.kind === 'tool' && item.status === 'running') : undefined);
  const activity = createMemo(() => {
    const item=tool();
    if(item){
      const brand=resolveToolBrand({toolName:item.name,label:item.title,summary:item.detail,state:item.status});
      const modes={thinking:'Pensando',searching:'Buscando',working:'Trabajando',solving:'Resolviendo',listening:'Escuchando',waiting:'Esperando',generating:'Generando'};
      return {label:`${modes[brand.state]} · ${brand.mark.name}`,text:''};
    }
    return props.responding && !props.waiting
    ? {label:'Escribiendo la respuesta',text:''} : currentActivity(props.items, props.waiting);
  });
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
    <Show when={tool()} fallback={<span class="syka-orb-anchor" data-chat-orb-anchor="activity" aria-hidden="true" />}>
      {item=><MirelToolMark item={item()} size={48}/>}
    </Show>
    <span class={'syka-turn-label t-text-swap ' + phase()} data-text={label()} role="status">{label()}</span>
    <Show when={activity().text}><p class="syka-turn-summary">{activity().text}</p></Show>
  </section>;
}
