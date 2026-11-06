/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// What goes in the «Pensando» block (Thinking + Reasoning, from Syka Code):
// the turn's tools with their verb, and only the reasoning the engine marked
// as a public summary. Private thought text is never shown.

import type { Item } from '@diffusionstudio/agent-chat';
import type { ThinkingEntry } from '@/mirel-chat/features/agents/thinking/ThinkingReasoning';

type Tool = Extract<Item, { kind: 'tool' }>;

/** Plain sentences of a summary, without Markdown or code. */
function sentences(text: string): string[] {
  return text
    .replaceAll(/```[\s\S]*?```/g, ' ')
    .replaceAll(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/[*_`#>~|]/g, '')
    .split(/(?<=[.!?…:])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence !== '');
}

const VERBS: [RegExp, string, string][] = [
  [/web.?search|browse|fetch|search|buscar/i, 'Buscando', 'Buscó'],
  [/read|inspect|context|list|ver|leer|syka_files|capture|check/i, 'Leyendo', 'Leyó'],
  [/write|edit|patch|apply|create|update|source_/i, 'Editando', 'Editó'],
  [/render|export|gate/i, 'Preparando', 'Preparó'],
  [/transcri/i, 'Transcribiendo', 'Transcribió'],
  [/shell|command|bash|exec|run/i, 'Ejecutando', 'Ejecutó'],
];

/** The tool's highlighted verb: present while it runs, past once done. */
export function toolVerb(item: Tool): string {
  const haystack = `${item.name} ${item.title}`;
  const match = VERBS.find(([pattern]) => pattern.test(haystack));
  const [running, done] = match ? [match[1], match[2]] : ['Usando', 'Usó'];
  if (item.status === 'failed') return 'Falló';
  return item.status === 'running' ? running : done;
}

const SUBJECTS: Record<string, string> = {
  resources: 'los recursos del proyecto', read_reference: 'una referencia', context: 'el proyecto',
  capture: 'una captura del video', check: 'el video', gate: 'el control de calidad', files: 'los archivos',
  skills: 'las skills', receta: 'la receta', plan: 'el plan', delivery: 'la entrega', ask_user: 'una pregunta',
};

/** What the tool worked on, in words: its title, else its detail, else its name made readable. */
export function toolSubject(item: Tool): string {
  const strip = (value: string) => value.replace(/^mcp__[^_]+(?:_[^_]+)*?__/, '').replace(/^syka_/, '');
  const bare = strip(item.name);
  // A title that is only the tool's identifier (with or without its prefix) says nothing.
  if (item.title && strip(item.title) !== bare) return item.title;
  const detail = item.detail?.split('\n')[0]?.trim();
  // Raw JSON arguments are not words for a person.
  if (detail && !/^[[{]/.test(detail)) return detail.length > 120 ? detail.slice(0, 119) + '…' : detail;
  return SUBJECTS[bare.toLowerCase()] ?? bare.replaceAll('_', ' ');
}

/** Whether an item belongs in the block. */
export function isThinkingItem(item: Item): boolean {
  if (item.kind === 'reasoning') return item.summary === true && item.text.trim() !== '';
  return item.kind === 'tool' && item.name !== 'imageGeneration';
}

export function thinkingEntries(items: readonly Item[]): ThinkingEntry[] {
  const entries: ThinkingEntry[] = [];
  for (const item of items) {
    if (!isThinkingItem(item)) continue;
    if (item.kind === 'reasoning') {
      sentences(item.text).forEach((text, index) => entries.push({ key: `${item.id}:${index}`, verb: null, text }));
    } else if (item.kind === 'tool') {
      entries.push({ key: item.id, verb: toolVerb(item), text: toolSubject(item) });
    }
  }
  return entries;
}

/** How long it thought: from the first item that started to the last that ended (at least 1 s). */
export function thinkingSeconds(items: readonly Item[], now: number): number {
  const starts = items.map(item => item.createdAt).filter((at): at is number => typeof at === 'number');
  if (!starts.length) return 1;
  const ends = items.map(item => item.completedAt ?? item.createdAt ?? now);
  return Math.max(1, Math.round((Math.max(...ends) - Math.min(...starts)) / 1000));
}

/**
 * For finished turns: the block that goes before each turn's first visible answer,
 * keyed by that answer's id. The live turn is left to the activity row.
 */
export function turnTraces(items: readonly Item[], visible: ReadonlySet<string>, active: boolean): Map<string, Item[]> {
  const traces = new Map<string, Item[]>();
  const lastUser = items.findLastIndex(item => item.kind === 'user');
  let trace: Item[] = [];
  let anchored = false;
  items.forEach((item, index) => {
    if (item.kind === 'user') { trace = []; anchored = false; return; }
    if (active && index > lastUser) return;
    if (isThinkingItem(item)) { trace.push(item); return; }
    if (!anchored && item.kind === 'assistant' && visible.has(item.id) && trace.length) {
      traces.set(item.id, trace);
      anchored = true;
    }
  });
  return traces;
}
