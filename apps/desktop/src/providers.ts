/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Settings › Proveedores: other services whose models Claude Code runs.
 * The configuration (no keys) lives in `providers.json`, the keys encrypted
 * in `provider-secrets.json`; the agent host receives both in memory.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { safeStorage } from 'electron';
import { MAIN_CHANNELS } from './main-channels';
import type { mainBridge } from './main-manager';
import { ProviderSecretStore } from './provider-secrets';
import { providerBase, type HostProvider, type ProviderKind } from '../../../packages/agent-chat/src/host/providers';

export type ProviderView = { id: string; kind: ProviderKind; name: string; enabled: boolean; baseUrl?: string; models: string[]; hasKey: boolean };
export type ProviderRequest =
  | { action: 'list' }
  | { action: 'save'; provider: { id?: string; kind: ProviderKind; name: string; enabled: boolean; baseUrl?: string; models: string[] }; apiKey?: string }
  | { action: 'remove'; id: string }
  | { action: 'catalog'; id: string };
export type ProviderResponse = { providers: ProviderView[]; catalog?: { id: string; name: string }[] };

type StoredProvider = Omit<ProviderView, 'hasKey'>;
const KINDS: readonly ProviderKind[] = ['openrouter', 'deepseek', 'openai', 'openaiCompatible', 'anthropicCompatible', 'ollama', 'lmstudio'];
/** Servers on this computer: their address may be plain http, and they need no key. */
const LOCAL_KINDS: readonly ProviderKind[] = ['ollama', 'lmstudio'];
const LOCAL_URL = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?(?:\/[^\s]*)?$/;
/** Kinds whose base URL the person types. */
const CUSTOM_URL: readonly ProviderKind[] = ['anthropicCompatible', 'openaiCompatible'];
const MODEL = /^[\w./:@[\]-]{1,200}$/;

export function registerProviders(bridge: typeof mainBridge, runtimeRoot: string, push: (providers: HostProvider[]) => void): () => HostProvider[] {
  const file = join(runtimeRoot, 'providers.json');
  const secrets = new ProviderSecretStore(join(runtimeRoot, 'provider-secrets.json'), safeStorage);
  const read = (): StoredProvider[] => {
    try { const parsed = JSON.parse(readFileSync(file, 'utf8')); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  };
  const write = (list: StoredProvider[]) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, JSON.stringify(list, null, 2), 'utf8');
    renameSync(`${file}.tmp`, file);
  };
  const forHost = (): HostProvider[] => {
    const keys = secrets.decryptAll();
    return read().map(provider => ({ ...provider, apiKey: keys[provider.id]?.apiKey ?? '' }));
  };
  const view = (): ProviderView[] => {
    const fields = secrets.fields();
    return read().map(provider => ({ ...provider, hasKey: !!fields[provider.id]?.includes('apiKey') }));
  };

  bridge.handle(MAIN_CHANNELS.SYKA_PROVIDERS, async (request: ProviderRequest): Promise<ProviderResponse> => {
    if (request.action === 'save') {
      const input = request.provider;
      if (!KINDS.includes(input.kind)) throw Error('Tipo de proveedor desconocido.');
      const name = String(input.name ?? '').trim().slice(0, 80);
      if (!name) throw Error('Poné un nombre al proveedor.');
      if (CUSTOM_URL.includes(input.kind) && !/^https:\/\/[^\s]+$/.test(input.baseUrl ?? '') && !LOCAL_URL.test(input.baseUrl ?? '')) throw Error('La URL base tiene que empezar con https:// (o ser un servidor de este equipo, http://localhost).');
      if (LOCAL_KINDS.includes(input.kind) && input.baseUrl && !LOCAL_URL.test(input.baseUrl) && !/^https:\/\/[^\s]+$/.test(input.baseUrl)) throw Error('La dirección tiene que ser http://localhost:puerto o https://.');
      const models = [...new Set((input.models ?? []).map(model => String(model).trim()).filter(model => MODEL.test(model)))].slice(0, 50);
      const list = read();
      const id = input.id && list.some(entry => entry.id === input.id) ? input.id : `${input.kind.toLowerCase().replace(/[^a-z0-9]/g, '')}-${randomUUID().slice(0, 8)}`;
      const next: StoredProvider = { id, kind: input.kind, name, enabled: input.enabled !== false, models, ...(CUSTOM_URL.includes(input.kind) || (LOCAL_KINDS.includes(input.kind) && input.baseUrl) ? { baseUrl: input.baseUrl!.trim().replace(/\/+$/, '') } : {}) };
      if (request.apiKey !== undefined) secrets.setMany(id, { apiKey: request.apiKey.trim() || null });
      write([...list.filter(entry => entry.id !== id), next]);
      push(forHost());
    } else if (request.action === 'remove') {
      write(read().filter(entry => entry.id !== request.id));
      secrets.removeProvider(request.id);
      push(forHost());
    } else if (request.action === 'catalog') {
      const provider = forHost().find(entry => entry.id === request.id);
      if (!provider) throw Error('Ese proveedor ya no existe.');
      return { providers: view(), catalog: await catalog(provider) };
    }
    return { providers: view() };
  });
  return forHost;
}

/** The models a provider publishes, to pick from. Anthropic-compatible services are typed in by hand. */
async function catalog(provider: HostProvider): Promise<{ id: string; name: string }[]> {
  const url = provider.kind === 'openrouter' ? 'https://openrouter.ai/api/v1/models' : provider.kind === 'deepseek' ? 'https://api.deepseek.com/models'
    : provider.kind === 'openai' ? 'https://api.openai.com/v1/models' : provider.kind === 'openaiCompatible' && provider.baseUrl ? `${provider.baseUrl}/models`
    : LOCAL_KINDS.includes(provider.kind) ? `${providerBase(provider)}/v1/models` : null;
  if (!url) return [];
  let response: Response;
  try {
    response = await fetch(url, { headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw Error(LOCAL_KINDS.includes(provider.kind) ? `${provider.name} no responde en ${providerBase(provider)}. Abrí la app y prendé su servidor.` : 'No se pudo conectar con el proveedor.');
  }
  if (response.status === 401 || response.status === 403) throw Error('El proveedor rechazó la clave.');
  if (!response.ok) throw Error(`El proveedor respondió ${response.status}.`);
  const body = await response.json() as { data?: { id?: unknown; name?: unknown }[] };
  return (body.data ?? []).flatMap(entry => typeof entry.id === 'string' ? [{ id: entry.id, name: typeof entry.name === 'string' ? entry.name : entry.id }] : [])
    .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 1000);
}
