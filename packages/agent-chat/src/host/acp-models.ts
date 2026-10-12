import type { HarnessId, HarnessInfo } from '../protocol';

type Value = Record<string, any>;
const object = (value: unknown): Value => value && typeof value === 'object' && !Array.isArray(value) ? value as Value : {};
const string = (value: unknown): string => typeof value === 'string' ? value : '';

export function acpConfig(session: Value, category: string): Value | undefined {
  return Array.isArray(session.configOptions) ? session.configOptions.find(option => option?.category === category && option.type === 'select' && typeof option.id === 'string') : undefined;
}

export function acpConfigValues(config: Value | undefined): Value[] {
  return (Array.isArray(config?.options) ? config.options : []).flatMap((option: Value) => Array.isArray(option?.options) ? option.options : [option]).filter((option: Value) => typeof option?.value === 'string');
}

/** Hermes names start with the account/provider; put the selected model first. */
export function hermesModelLabel(id: string, announced: string): string {
  const separated = announced.split(' · ');
  let label = separated.length > 1 ? separated.slice(1).join(' · ').trim() : announced.trim();
  if (!label || /^ChatGPT(?: or Codex)? Subscription\b/i.test(label)) label = id.replace(/^(?:custom:[^:]+|[^:]+):/, '');
  if (/^gpt-\d/i.test(label)) label = label.replace(/^gpt/i, 'GPT').replace(/-(sol|astra|terra|luna)$/i, (_, name: string) => '-' + name[0]!.toUpperCase() + name.slice(1).toLowerCase());
  return label || id;
}

export function acpModels(session: Value, harness: HarnessId): HarnessInfo['models'] {
  const modelConfig = acpConfig(session, 'model');
  const legacy = object(session.models).availableModels;
  const raw: { id: string; name: string; meta: Value }[] = modelConfig
    ? acpConfigValues(modelConfig).map(option => ({ id: option.value, name: string(option.name), meta: object(option._meta) }))
    : (Array.isArray(legacy) ? legacy : []).filter(model => typeof model?.modelId === 'string').map(model => ({ id: model.modelId, name: string(model.name), meta: object(model._meta) }));
  const thought = acpConfig(session, 'thought_level');
  const current = string(modelConfig?.currentValue) || string(session.models?.currentModelId);
  const seen = new Set<string>();
  return raw.filter(model => { if (seen.has(model.id)) return false; seen.add(model.id); return true; }).map(model => {
    // Model metadata is emitted by Syka's native Hermes bridge. Generic ACP
    // thought options describe only the currently selected model.
    const declared = object(model.meta.syka).reasoningEfforts;
    const efforts: string[] = Array.isArray(declared) ? [...new Set(declared.filter((value: unknown): value is string => typeof value === 'string' && !!value))]
      : model.id === current ? acpConfigValues(thought).map(option => option.value) : [];
    const defaultValue = string(object(model.meta.syka).defaultEffort) || (model.id === current ? string(thought?.currentValue) : '');
    return { id: model.id, label: harness === 'hermes' ? hermesModelLabel(model.id, model.name) : model.name || model.id,
      ...(efforts.length ? { efforts, ...(efforts.includes(defaultValue) ? { defaultEffort: defaultValue } : {}) } : {}) };
  });
}
