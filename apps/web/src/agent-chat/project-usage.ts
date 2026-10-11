/* MPL-2.0. One batched fetch for visible project cards; live host pushes, no polling. */
import { createStore } from 'solid-js/store';
import type { ProjectTokenUsage } from '@diffusionstudio/agent-chat';
import { client } from './connection';
import { ensureConnected } from './store';

const [usage, setUsage] = createStore<Record<string, ProjectTokenUsage>>({});
const watched = new Map<string, number>();
let scheduled = false;

function accept(value: ProjectTokenUsage) {
  if (!value?.projectId || !Array.isArray(value.models)) return;
  const key = JSON.stringify(value.projectId);
  if ((usage[key]?.updatedAt ?? -1) > value.updatedAt) return;
  setUsage(key, value);
}
client.onUsage(accept);
client.onState(state => { if (state === 'open') schedule(); });

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    const projectIds = [...watched.keys()];
    if (!projectIds.length || client.state !== 'open') return;
    void client.request('projects.usage', { projectIds }).then(values => values.forEach(accept)).catch(() => {});
  });
}

export function observeProjectUsage(projectId: string): () => void {
  if (!projectId) return () => {};
  watched.set(projectId, (watched.get(projectId) ?? 0) + 1);
  ensureConnected();
  schedule();
  return () => {
    const count = (watched.get(projectId) ?? 1) - 1;
    if (count > 0) watched.set(projectId, count); else watched.delete(projectId);
  };
}
export const projectUsage = (projectId: string) => usage[JSON.stringify(projectId)];

const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });
const exact = new Intl.NumberFormat('es-AR');
export const compactTokens = (count: number) => `${compact.format(count)} tokens`;
export const exactTokens = (count: number) => exact.format(count);
