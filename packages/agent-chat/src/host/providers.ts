/**
 * Model providers (Settings › Proveedores): another service's models run by
 * Claude Code. Main keeps the configuration and the encrypted keys and hands
 * them to this host in memory; nothing here is written to disk. The
 * environment rules follow Syka Code's `core/features/providers/environment.ts`
 * and the DeepSeek and OpenRouter guides it cites.
 */

export type ProviderKind = 'openrouter' | 'deepseek' | 'anthropicCompatible' | 'openai' | 'openaiCompatible' | 'ollama' | 'lmstudio';
/** Which engine each kind can serve: Claude Code speaks Anthropic's API, Codex OpenAI's Responses API. */
export const PROVIDER_ENGINES: Record<ProviderKind, readonly ('claude' | 'codex')[]> = {
  openrouter: ['claude', 'codex'], deepseek: ['claude', 'codex'], anthropicCompatible: ['claude'], openai: ['codex'], openaiCompatible: ['codex'],
  // Local servers speak both APIs in their recent versions: Ollama 0.14+ and LM Studio 0.4+ (Anthropic Messages and OpenAI Responses).
  ollama: ['claude', 'codex'], lmstudio: ['claude', 'codex'],
};

/** Models running on this computer: no key and no internet, at the server's own address. */
export const LOCAL_PROVIDERS: Partial<Record<ProviderKind, { baseUrl: string; token: string }>> = {
  ollama: { baseUrl: 'http://localhost:11434', token: 'ollama' },
  lmstudio: { baseUrl: 'http://localhost:1234', token: 'lm-studio' },
};
/** The server address: the one typed in, otherwise the local server's default. */
export const providerBase = (provider: HostProvider) => (provider.baseUrl || LOCAL_PROVIDERS[provider.kind]?.baseUrl || '').replace(/\/+$/, '');
export type HostProvider = { id: string; kind: ProviderKind; name: string; enabled: boolean; baseUrl?: string; models: string[]; apiKey: string };

export const OPENROUTER_ANTHROPIC = 'https://openrouter.ai/api';
/** Anthropic Messages: the SDK adds `/v1/messages`. */
export const DEEPSEEK_ANTHROPIC_BASE = 'https://api.deepseek.com/anthropic';
/** The small fast model DeepSeek's Claude Code guide puts in Haiku and subagents. */
const DEEPSEEK_FAST_MODEL = 'deepseek-flash';
/** `CLAUDE_CODE_AUTO_COMPACT_WINDOW` from that guide: compact at 768K of the 1M window. */
const DEEPSEEK_AUTO_COMPACT_WINDOW = 786_432;

/**
 * The person's own Claude variables, removed before a provider session: a
 * leftover `ANTHROPIC_API_KEY` would be sent to Anthropic's API.
 */
export const CLAUDE_PROVIDER_VARIABLES = [
  'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_BEDROCK_BASE_URL', 'ANTHROPIC_BEDROCK_MANTLE_BASE_URL',
  'ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION', 'ANTHROPIC_CUSTOM_HEADERS', 'ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_FABLE_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL',
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_MANTLE', 'AWS_BEARER_TOKEN_BEDROCK', 'AWS_PROFILE', 'AWS_REGION',
] as const;

let providers: HostProvider[] = [];
export function setProviders(next: HostProvider[]): void {
  // A local server needs no key: it gets the placeholder token it accepts.
  providers = next.filter(provider => provider.enabled && (provider.apiKey || LOCAL_PROVIDERS[provider.kind]))
    .map(provider => provider.apiKey ? provider : { ...provider, apiKey: LOCAL_PROVIDERS[provider.kind]!.token });
}
export function activeProviders(): readonly HostProvider[] { return providers; }

/** A provider model in the Claude Code model list: `p:<provider>:<model>`. */
export function providerModelId(providerId: string, modelId: string): string { return `p:${providerId}:${modelId}`; }
export function parseProviderModel(id: string): { provider: HostProvider; model: string } | null {
  const match = /^p:([a-z0-9][a-z0-9-]{0,62}):(.+)$/.exec(id);
  const provider = match ? providers.find(entry => entry.id === match[1]) : undefined;
  return provider && match ? { provider, model: match[2]! } : null;
}

/** The provider models offered in Claude Code's model picker. */
export function claudeProviderModels(): { id: string; label: string }[] {
  return providers.filter(provider => PROVIDER_ENGINES[provider.kind].includes('claude')).flatMap(provider => provider.models.map(model => ({ id: providerModelId(provider.id, model), label: `${model} · ${provider.name}` })));
}

/* ------------------------------------------------------------------ */
/* Codex: the same providers through `codex app-server`, as Syka Code's  */
/* buildCodexSetup does (core/features/providers/environment.ts).       */
/* ------------------------------------------------------------------ */

/** OpenAI-style endpoints Codex talks to with the Responses API. */
export const OPENROUTER_OPENAI = 'https://openrouter.ai/api/v1';
/** As DeepSeek's Codex guide: the base without /v1. */
export const DEEPSEEK_OPENAI = 'https://api.deepseek.com';
/** Codex's own account (ChatGPT). */
export const CODEX_OWN_PROVIDER = 'openai';

/** OpenAI's own API, with the person's key (not the ChatGPT account). */
export const OPENAI_API = 'https://api.openai.com/v1';
const servesCodex = (provider: HostProvider) => PROVIDER_ENGINES[provider.kind].includes('codex');
const codexBase = (provider: HostProvider) => provider.kind === 'openrouter' ? OPENROUTER_OPENAI : provider.kind === 'deepseek' ? DEEPSEEK_OPENAI
  : provider.kind === 'openai' ? OPENAI_API : LOCAL_PROVIDERS[provider.kind] ? `${providerBase(provider)}/v1` : (provider.baseUrl ?? '').replace(/\/+$/, '');
/** The provider's id inside Codex: prefixed so it never shadows one of the person's config.toml. */
export const codexProviderId = (provider: HostProvider) => `syka-${provider.id}`;
const keyVariable = (provider: HostProvider) => `SYKA_PROVIDER_${provider.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;

/** `-c` settings for `codex app-server` and the variables holding the keys (config only names them). */
export function codexProviderSetup(): { args: string[]; env: Record<string, string> } {
  const args: string[] = [];
  const env: Record<string, string> = {};
  for (const provider of providers.filter(servesCodex)) {
    const prefix = `model_providers.${codexProviderId(provider)}`;
    const variable = keyVariable(provider);
    env[variable] = provider.apiKey;
    const base = codexBase(provider);
    args.push('-c', `${prefix}.name=${JSON.stringify(provider.name)}`, '-c', `${prefix}.base_url=${JSON.stringify(base)}`,
      '-c', `${prefix}.env_key=${JSON.stringify(variable)}`, '-c', `${prefix}.wire_api="responses"`);
  }
  return { args, env };
}

/** The provider models offered in Codex's model picker. */
export function codexProviderModels(): { id: string; label: string }[] {
  return providers.filter(servesCodex).flatMap(provider => provider.models.map(model => ({ id: providerModelId(provider.id, model), label: `${model} · ${provider.name}` })));
}

/** Who answers a Codex model: its own account, or a provider and the model id it knows. Null for a provider that is gone or cannot serve Codex. */
export function codexModelTarget(model: string): { provider: string; model: string } | null {
  if (!model.startsWith('p:')) return { provider: CODEX_OWN_PROVIDER, model };
  const parsed = parseProviderModel(model);
  return parsed && servesCodex(parsed.provider) ? { provider: codexProviderId(parsed.provider), model: parsed.model } : null;
}

const withMillionContext = (model: string) => model.endsWith(']') ? model : `${model}[1m]`;

/** The chosen model also covers Claude Code's subagents and background tasks. */
function modelVariables(model: string): Record<string, string> {
  return { ANTHROPIC_MODEL: model, ANTHROPIC_DEFAULT_OPUS_MODEL: model, ANTHROPIC_DEFAULT_SONNET_MODEL: model, ANTHROPIC_DEFAULT_HAIKU_MODEL: model, CLAUDE_CODE_SUBAGENT_MODEL: model };
}

/** What Claude Code is started with for a provider model: the model id it receives, the extra environment and a note on who is answering. */
export function claudeProviderLaunch(provider: HostProvider, model: string): { model: string; env: Record<string, string>; identity: string } {
  const claude = /(?:^|[/.])claude-/.test(model);
  const identity = `Model note: Claude Code is only the harness in this session. The model answering is "${model}", served by ${provider.name}; `
    + `${claude ? 'it is an Anthropic Claude model' : 'it is not an Anthropic Claude model'}. If the user asks which model you are, say so plainly.`;
  const token = { ANTHROPIC_AUTH_TOKEN: provider.apiKey, ANTHROPIC_API_KEY: '' };
  switch (provider.kind) {
    case 'openrouter':
      return { model, identity, env: { ANTHROPIC_BASE_URL: OPENROUTER_ANTHROPIC, ...token, ...modelVariables(model) } };
    case 'deepseek': {
      const main = withMillionContext(model);
      return { model: main, identity, env: { ANTHROPIC_BASE_URL: DEEPSEEK_ANTHROPIC_BASE, ...token, CLAUDE_CODE_EFFORT_LEVEL: 'max',
        CLAUDE_CODE_AUTO_COMPACT_WINDOW: String(DEEPSEEK_AUTO_COMPACT_WINDOW), ANTHROPIC_MODEL: main, ANTHROPIC_DEFAULT_OPUS_MODEL: main,
        ANTHROPIC_DEFAULT_SONNET_MODEL: main, ANTHROPIC_DEFAULT_HAIKU_MODEL: DEEPSEEK_FAST_MODEL, CLAUDE_CODE_SUBAGENT_MODEL: DEEPSEEK_FAST_MODEL } };
    }
    case 'anthropicCompatible':
      return { model, identity, env: { ANTHROPIC_BASE_URL: (provider.baseUrl ?? '').replace(/\/+$/, ''), ...token, ...modelVariables(model) } };
    case 'ollama':
    case 'lmstudio':
      return { model, identity, env: { ANTHROPIC_BASE_URL: providerBase(provider), ...token, ...modelVariables(model) } };
    case 'openai':
    case 'openaiCompatible':
      throw new Error(`${provider.name} solo funciona con Codex: Claude Code necesita un servicio con la API de Anthropic.`);
  }
}

/** The environment of a provider session: the inherited one without the person's own Claude variables, plus the provider's. */
export function providerEnvironment(base: Record<string, string>, extra: Record<string, string>): Record<string, string> {
  const env = { ...base };
  for (const name of CLAUDE_PROVIDER_VARIABLES) delete env[name];
  return { ...env, ...extra };
}
