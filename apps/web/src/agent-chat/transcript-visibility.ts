import type { Item } from '@diffusionstudio/agent-chat';

/** A view over the durable trace: never delete provider events or conversation data. */
export function transcriptPresentation(items: Item[], active: boolean) {
  const transient = new Set<string>();
  const turnStart = items.findLastIndex(item => item.kind === 'user');
  let laterAssistant = false;
  let finalSeen = false;
  // Old bridges discarded Codex's phase. Infer intermediate messages from
  // later messages in the SAME turn, never from their wording. Tools can
  // finish after the final answer (for example a subagent completion).
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (item.kind === 'user') { laterAssistant = false; finalSeen = false; continue; }
    if (finalSeen && (item.kind === 'reasoning' || (item.kind === 'assistant' && item.phase === 'commentary'))) {
      transient.add(item.id);
    }
    if ((item.kind === 'tool' && item.name !== 'webSearch' && item.name !== 'imageGeneration') || (item.kind === 'reasoning' && !item.summary)) {
      transient.add(item.id);
    } else if (item.kind === 'assistant') {
      if (item.phase === 'final' || (!item.phase && !laterAssistant && (!active || index < turnStart))) finalSeen = true;
      if (!item.phase && laterAssistant) transient.add(item.id);
      laterAssistant = true;
    }
  }
  const messages = items.filter((item, index) => !transient.has(item.id)
    && !(active && index > turnStart && item.kind === 'assistant' && !item.phase));
  const activity = active ? items.slice(turnStart + 1).filter(item => item.kind === 'tool' || item.kind === 'reasoning' || (item.kind === 'assistant' && item.phase === 'commentary') || transient.has(item.id)
    || (item.kind === 'assistant' && !item.phase)) : [];
  return { messages, activity };
}

export function visibleTranscriptItems(items: Item[], active: boolean): Item[] {
  return transcriptPresentation(items, active).messages;
}

/** Public progress only; private reasoning text and tool outputs are not exposed. */
export function currentActivity(activity: Item[], waiting = false) {
  if (waiting) return { label: 'Esperando tu respuesta', text: '' };
  const last = activity.at(-1);
  if (last?.kind === 'tool') return {
    label: last.status === 'failed' ? 'Revisando un problema' : last.status !== 'running' ? 'Continuando'
      : last.name === 'webSearch' ? 'Consultando la web' : last.name === 'imageGeneration' ? 'Generando imagen' : 'Ejecutando herramientas',
    text: '',
  };
  if (last?.kind === 'assistant') return { label: 'Trabajando', text: last.phase === 'commentary' ? '' : last.text };
  if (last?.kind === 'reasoning' && last.summary) return {label:'Pensando',text:''};
  return { label: 'Pensando', text: 'Analizando el proyecto' };
}
