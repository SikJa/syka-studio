import { describe, expect, it } from 'vitest';
import { claudeProviderLaunch, claudeProviderModels, codexModelTarget, codexProviderModels, codexProviderSetup, parseProviderModel, providerEnvironment, providerModelId, setProviders, type HostProvider } from '../src/host/providers';

const openrouter: HostProvider = { id: 'openrouter-1', kind: 'openrouter', name: 'OpenRouter', enabled: true, models: ['qwen/qwen3-coder'], apiKey: 'sk-or' };
const deepseek: HostProvider = { id: 'deepseek-1', kind: 'deepseek', name: 'DeepSeek', enabled: true, models: ['deepseek-v4-pro'], apiKey: 'sk-ds' };

describe('model providers for Claude Code', () => {
  it('offers only enabled providers with a key, and finds them back from the model id', () => {
    setProviders([openrouter, deepseek, { ...openrouter, id: 'off', enabled: false }, { ...deepseek, id: 'nokey', apiKey: '' }]);
    expect(claudeProviderModels().map(model => model.id)).toEqual(['p:openrouter-1:qwen/qwen3-coder', 'p:deepseek-1:deepseek-v4-pro']);
    expect(parseProviderModel(providerModelId('openrouter-1', 'qwen/qwen3-coder'))?.model).toBe('qwen/qwen3-coder');
    expect(parseProviderModel('p:off:any')).toBeNull();
  });
  it('points Claude Code at the provider and never forwards the person\'s own Anthropic key', () => {
    const launch = claudeProviderLaunch(openrouter, 'qwen/qwen3-coder');
    const env = providerEnvironment({ ANTHROPIC_API_KEY: 'mine', AWS_PROFILE: 'mine', PATH: 'x' }, launch.env);
    expect(env).toMatchObject({ ANTHROPIC_BASE_URL: 'https://openrouter.ai/api', ANTHROPIC_AUTH_TOKEN: 'sk-or', ANTHROPIC_API_KEY: '', ANTHROPIC_MODEL: 'qwen/qwen3-coder', PATH: 'x' });
    expect(env.AWS_PROFILE).toBeUndefined();
    expect(launch.identity).toContain('not an Anthropic Claude model');
  });
  it('follows DeepSeek\'s guide: 1M window on the chosen model, Flash for the small one', () => {
    const launch = claudeProviderLaunch(deepseek, 'deepseek-v4-pro');
    expect(launch.model).toBe('deepseek-v4-pro[1m]');
    expect(launch.env).toMatchObject({ ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-flash', CLAUDE_CODE_SUBAGENT_MODEL: 'deepseek-flash' });
  });
});

describe("model providers for Codex", () => {
  const compatible: HostProvider = { id: "anthro-1", kind: "anthropicCompatible", name: "Mine", enabled: true, baseUrl: "https://x.example", models: ["m"], apiKey: "k" };
  it("registers OpenRouter and DeepSeek as Responses providers with the key in a variable", () => {
    setProviders([openrouter, deepseek, compatible]);
    const setup = codexProviderSetup();
    expect(setup.args).toContain("model_providers.syka-openrouter-1.base_url=\"https://openrouter.ai/api/v1\"");
    expect(setup.args).toContain("model_providers.syka-deepseek-1.base_url=\"https://api.deepseek.com\"");
    expect(setup.args).toContain("model_providers.syka-openrouter-1.wire_api=\"responses\"");
    expect(setup.args.join(" ")).not.toContain("sk-or");
    expect(setup.env).toEqual({ SYKA_PROVIDER_OPENROUTER_1_API_KEY: "sk-or", SYKA_PROVIDER_DEEPSEEK_1_API_KEY: "sk-ds" });
    // An Anthropic-only service cannot serve Codex.
    expect(codexProviderModels().map(model => model.id)).toEqual(["p:openrouter-1:qwen/qwen3-coder", "p:deepseek-1:deepseek-v4-pro"]);
  });
  it("tells which provider answers each Codex model", () => {
    setProviders([openrouter, compatible]);
    expect(codexModelTarget("gpt-5.5")).toEqual({ provider: "openai", model: "gpt-5.5" });
    expect(codexModelTarget("p:openrouter-1:qwen/qwen3-coder")).toEqual({ provider: "syka-openrouter-1", model: "qwen/qwen3-coder" });
    expect(codexModelTarget("p:anthro-1:m")).toBeNull();
    expect(codexModelTarget("p:gone:x")).toBeNull();
  });
});

describe("OpenAI providers", () => {
  const openai: HostProvider = { id: "openai-1", kind: "openai", name: "OpenAI", enabled: true, models: ["gpt-5.1-codex"], apiKey: "sk-oa" };
  const local: HostProvider = { id: "lm-1", kind: "openaiCompatible", name: "LM", enabled: true, baseUrl: "https://lm.example.com/v1/", models: ["qwen3"], apiKey: "k" };
  it("serve Codex only, each at its own base URL", () => {
    setProviders([openai, local]);
    expect(claudeProviderModels()).toEqual([]);
    expect(codexProviderModels().map(model => model.id)).toEqual(["p:openai-1:gpt-5.1-codex", "p:lm-1:qwen3"]);
    const args = codexProviderSetup().args;
    expect(args).toContain("model_providers.syka-openai-1.base_url=\"https://api.openai.com/v1\"");
    expect(args).toContain("model_providers.syka-lm-1.base_url=\"https://lm.example.com/v1\"");
    expect(() => claudeProviderLaunch(openai, "gpt-5.1-codex")).toThrow("solo funciona con Codex");
  });
});

describe("local providers (Ollama, LM Studio)", () => {
  const ollama: HostProvider = { id: "ollama-1", kind: "ollama", name: "Ollama", enabled: true, models: ["qwen3-coder:30b"], apiKey: "" };
  const lmstudio: HostProvider = { id: "lm-2", kind: "lmstudio", name: "LM Studio", enabled: true, baseUrl: "http://localhost:4321/", models: ["openai/gpt-oss-20b"], apiKey: "" };
  it("need no key, and serve both engines at the local address", () => {
    setProviders([ollama, lmstudio]);
    expect(claudeProviderModels().map(model => model.id)).toEqual(["p:ollama-1:qwen3-coder:30b", "p:lm-2:openai/gpt-oss-20b"]);
    expect(codexProviderModels()).toHaveLength(2);
    const args = codexProviderSetup().args;
    expect(args).toContain("model_providers.syka-ollama-1.base_url=\"http://localhost:11434/v1\"");
    expect(args).toContain("model_providers.syka-lm-2.base_url=\"http://localhost:4321/v1\"");
    const launch = claudeProviderLaunch(parseProviderModel("p:ollama-1:qwen3-coder:30b")!.provider, "qwen3-coder:30b");
    expect(launch.env).toMatchObject({ ANTHROPIC_BASE_URL: "http://localhost:11434", ANTHROPIC_AUTH_TOKEN: "ollama", ANTHROPIC_MODEL: "qwen3-coder:30b" });
  });
});
