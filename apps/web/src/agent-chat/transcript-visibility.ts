import type { Item } from '@diffusionstudio/agent-chat';

/** A view over the durable trace: never delete provider events or conversation data. */
export function transcriptPresentation(items: Item[], active: boolean) {
  const transient = new Set<string>();
  const turnStart = items.findLastIndex(item => item.kind === 'user');
  let laterAssistant = false;
  // Old bridges discarded Codex's phase. Infer intermediate messages from
  // later messages in the SAME turn, never from their wording. Tools can
  // finish after the final answer (for example a subagent completion).
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (item.kind === 'user') { laterAssistant = false; continue; }
    if (item.kind === 'assistant' && item.phase === 'commentary') {
      transient.add(item.id);
      continue;
    }
    if ((item.kind === 'tool' && item.name !== 'imageGeneration') || item.kind === 'reasoning') {
      transient.add(item.id);
    } else if (item.kind === 'assistant') {
      if (!item.phase && laterAssistant) transient.add(item.id);
      laterAssistant = true;
    }
  }
  // ACP/Claude may stream public assistant text without a phase. Display that
  // text immediately; completed history can still collapse intermediate items.
  const messages = items.filter(item => !transient.has(item.id));
  const activity = active ? items.slice(turnStart + 1).filter(item => item.kind === 'tool' || item.kind === 'reasoning' || (item.kind === 'assistant' && item.phase === 'commentary') || transient.has(item.id)) : [];
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
      : last.name === 'webSearch' ? 'Consultando la web' : last.name === 'imageGeneration' ? 'Generando imagen'
      : /read|inspect|source|file|syka_files/i.test(last.name + ' ' + last.title) ? 'Revisando archivos'
      : /write|edit|patch|apply/i.test(last.name + ' ' + last.title) ? 'Aplicando cambios'
      : /render|export/i.test(last.name + ' ' + last.title) ? 'Preparando el video'
      : /search|browse|fetch/i.test(last.name + ' ' + last.title) ? 'Consultando información' : 'Ejecutando herramientas',
    text: '',
  };
  if (last?.kind === 'assistant') return { label: 'Preparando la respuesta', text: publicProgressSummary(last.text) };
  if (last?.kind === 'reasoning' && last.summary) return {label:'Pensando',text:publicProgressSummary(last.text)};
  return { label: 'Esperando al modelo', text: 'Esperando respuesta del modelo' };
}

/** Only short, explicitly public summaries. Never translate or summarize a
 * private thought stream; unknown-language summaries use the localized status. */
export function publicProgressSummary(text: string): string {
  const plain = text.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  if (!/\b(?:voy|estoy|revisando|analizando|para|las|los|del|una|necesito|verificar|preparando|comparar|buscando|archivo|proyecto)\b/i.test(plain)) return '';
  const sentence = plain.match(/^.{1,220}?(?:[.!?](?:\s|$)|$)/)?.[0]?.trim();
  if (sentence) return sentence;
  const boundary = plain.lastIndexOf(' ', 200);
  return plain.slice(0, boundary > 80 ? boundary : 200).trimEnd() + '…';
}
