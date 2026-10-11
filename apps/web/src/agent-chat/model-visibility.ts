import type { HarnessId, HarnessInfo } from '@diffusionstudio/agent-chat';

export type ModelVisibility = {
  harnesses: Partial<Record<HarnessId, boolean>>;
  hermesProviders: Record<string, boolean>;
  /** Exact IDs are scoped to the connection, so direct Claude and Claude via
   * Antigravity can be configured independently. Missing entries are visible. */
  models?: Record<string, Record<string, boolean>>;
};
export const DEFAULT_MODEL_VISIBILITY: ModelVisibility = { harnesses: {}, hermesProviders: {}, models: {} };
type Model = HarnessInfo['models'][number];

/** Hermes model IDs carry the routing provider, including named custom endpoints. */
export function hermesProvider(model: Model): { id: string; label: string } {
  const custom = /^custom:([^:]+):/.exec(model.id);
  const id = custom ? `custom:${custom[1]}` : model.id.split(':')[0];
  const label = model.label.split(' · ')[0];
  return { id, label: label === model.label ? (custom?.[1] ?? id) : label };
}
export function hermesProviderGroups(models: Model[]) {
  const groups = new Map<string, { id: string; label: string; count: number }>();
  for (const model of models) {
    const provider = hermesProvider(model);
    const group = groups.get(provider.id);
    if (group) group.count++;
    else groups.set(provider.id, { ...provider, count: 1 });
  }
  return [...groups.values()];
}
export const harnessVisible = (id: HarnessId, visibility: ModelVisibility): boolean =>
  id !== 'muse' && visibility.harnesses[id] !== false;
export function modelVisible(harness: HarnessId, model: Model, visibility: ModelVisibility): boolean {
  return harnessVisible(harness, visibility) &&
    visibility.models?.[harness]?.[model.id] !== false &&
    (harness !== 'hermes' || visibility.hermesProviders[hermesProvider(model).id] !== false);
}
export function visibleModelCatalog(harnesses: HarnessInfo[], visibility: ModelVisibility): HarnessInfo[] {
  return harnesses.filter(h => harnessVisible(h.id, visibility)).map(h => ({
    ...h, models: h.models.filter(m => modelVisible(h.id, m, visibility)),
  }));
}
/** Ignore malformed stored preferences without dropping future provider names. */
export function parseModelVisibility(value: unknown): ModelVisibility {
  const booleans = (v: unknown) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).filter(([, flag]) => typeof flag === 'boolean')) : {};
  const data = value && typeof value === 'object' ? value as Partial<ModelVisibility> : {};
  const models=data.models&&typeof data.models==='object'&&!Array.isArray(data.models)
    ? Object.fromEntries(Object.entries(data.models).map(([id,entries])=>[id,booleans(entries)])) : {};
  return { harnesses: booleans(data.harnesses), hermesProviders: booleans(data.hermesProviders), models };
}
