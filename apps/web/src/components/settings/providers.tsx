import { createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import type { ProviderView } from '@desktop/providers';
import { LOCAL_PROVIDERS, PROVIDER_ENGINES, type ProviderKind } from '../../../../../packages/agent-chat/src/host/providers';
import { mainBridge } from '@/lib/ipc';
import { isDesktop } from '@/projects';
import { SettingsButton, SettingsGroup, SettingsRow, SettingsSelect, SettingsSwitch } from './kit';
import { ProviderIcon } from './provider-icon';

const KIND_LABEL: Record<ProviderKind, string> = { openrouter: 'OpenRouter', deepseek: 'DeepSeek', openai: 'OpenAI', openaiCompatible: 'Compatible con OpenAI', anthropicCompatible: 'Compatible con Anthropic', ollama: 'Ollama', lmstudio: 'LM Studio' };
const CUSTOM_URL: readonly ProviderKind[] = ['anthropicCompatible', 'openaiCompatible'];
/** «Claude Code y Codex», «Codex» or «Claude Code»: where its models show up. */
const engines = (kind: ProviderKind) => PROVIDER_ENGINES[kind].map(engine => engine === 'claude' ? 'Claude Code' : 'Codex').join(' y ');
const KIND_HINT: Record<ProviderKind, string> = {
  openrouter: 'Cientos de modelos con una sola clave de openrouter.ai.',
  deepseek: 'Los modelos V4 de DeepSeek con tu clave de platform.deepseek.com.',
  openai: 'Los modelos de OpenAI con tu clave de API de platform.openai.com. Para Codex.',
  openaiCompatible: 'Cualquier servicio con la API de OpenAI (Responses), con su URL. Para Codex.',
  anthropicCompatible: 'Cualquier servicio con la API de Anthropic (Messages). Solo para Claude Code.',
  ollama: 'Modelos que corren en tu PC con Ollama: sin internet ni clave. Necesita Ollama 0.14 o más nuevo y la app abierta.',
  lmstudio: 'Modelos que corren en tu PC con LM Studio: sin internet ni clave. Prendé su servidor (Developer › Start Server); necesita LM Studio 0.4 o más nuevo.',
};

type Draft = { id?: string; kind: ProviderKind; name: string; enabled: boolean; baseUrl: string; models: string[]; apiKey: string; hasKey: boolean };
const empty = (kind: ProviderKind): Draft => ({ kind, name: KIND_LABEL[kind], enabled: true, baseUrl: LOCAL_PROVIDERS[kind]?.baseUrl ?? '', models: [], apiKey: '', hasKey: false });
const isLocal = (kind: ProviderKind) => !!LOCAL_PROVIDERS[kind];

/**
 * Settings › Proveedores, after Syka Code's ProvidersSettings: other services
 * whose models Claude Code runs. Keys are encrypted by Windows and never come
 * back to this page.
 */
export function ProvidersSettings() {
  const call = (request: Parameters<typeof mainBridge.call<typeof MAIN_CHANNELS.SYKA_PROVIDERS>>[1]) => mainBridge.call(MAIN_CHANNELS.SYKA_PROVIDERS, request);
  const [list, { mutate }] = createResource(async () => isDesktop() ? (await call({ action: 'list' })).providers : []);
  const [draft, setDraft] = createSignal<Draft | null>(null);
  const [catalog, setCatalog] = createSignal<{ id: string; name: string }[] | null>(null);
  const [filter, setFilter] = createSignal('');
  const [modelInput, setModelInput] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const shown = createMemo(() => {
    const needle = filter().trim().toLowerCase();
    return (catalog() ?? []).filter(model => !needle || model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle)).slice(0, 60);
  });
  const edit = (provider: ProviderView) => { setCatalog(null); setFilter(''); setDraft({ ...provider, baseUrl: provider.baseUrl ?? '', apiKey: '' }); };
  const patch = (value: Partial<Draft>) => setDraft(current => current && { ...current, ...value });
  const toggleModel = (id: string) => patch({ models: draft()!.models.includes(id) ? draft()!.models.filter(model => model !== id) : [...draft()!.models, id] });

  const save = async () => {
    const current = draft();
    if (!current) return;
    setBusy(true);
    try {
      const result = await call({ action: 'save', provider: { id: current.id, kind: current.kind, name: current.name, enabled: current.enabled, baseUrl: current.baseUrl, models: current.models },
        ...(current.apiKey ? { apiKey: current.apiKey } : {}) });
      mutate(result.providers);
      setDraft(null);
      toast.success('Proveedor guardado', { description: `Sus modelos aparecen en ${engines(current.kind)}.` });
    } catch (error) { toast.error('No se pudo guardar el proveedor', { description: (error as Error).message }); }
    finally { setBusy(false); }
  };
  const loadCatalog = async () => {
    const current = draft();
    if (!current?.id) { toast.error(isLocal(current?.kind ?? 'openrouter') ? 'Guardá el proveedor antes de buscar sus modelos.' : 'Guardá el proveedor con su clave antes de buscar modelos.'); return; }
    setBusy(true);
    try { setCatalog((await call({ action: 'catalog', id: current.id })).catalog ?? []); }
    catch (error) { toast.error('No se pudieron leer los modelos', { description: (error as Error).message }); }
    finally { setBusy(false); }
  };
  const remove = async (provider: ProviderView) => {
    try { mutate((await call({ action: 'remove', id: provider.id })).providers); if (draft()?.id === provider.id) setDraft(null); }
    catch (error) { toast.error('No se pudo quitar el proveedor', { description: (error as Error).message }); }
  };
  // The switch moves at once; two quick clicks used to read the same old value and end inverted.
  const toggle = async (provider: ProviderView, enabled: boolean) => {
    const before = list();
    mutate(current => current?.map(entry => entry.id === provider.id ? { ...entry, enabled } : entry));
    try { mutate((await call({ action: 'save', provider: { ...provider, enabled } })).providers); }
    catch (error) { mutate(before); toast.error('No se pudo cambiar el proveedor', { description: (error as Error).message }); }
  };

  return <Show when={isDesktop()} fallback={<p class="syka-settings-page-description">Los proveedores se configuran en la aplicación de escritorio.</p>}>
    <SettingsGroup title="Proveedores" description="Modelos de otros servicios en Claude Code y Codex. Las claves se cifran en este equipo."
      action={<SettingsSelect label="Añadir proveedor" value={'add' as string}
        options={[{ value: 'add', label: '+ Añadir proveedor', disabled: true }, ...(Object.keys(KIND_LABEL) as ProviderKind[]).map(kind => ({ value: kind, label: <span class="inline-flex items-center gap-2"><ProviderIcon kind={kind} />{KIND_LABEL[kind]}</span> }))]}
        onChange={kind => { setCatalog(null); setDraft(empty(kind as ProviderKind)); }} />}
      footnote="El proveedor da acceso al modelo con tu clave; el motor sigue poniendo las herramientas. Solo se envía al servicio que elegiste.">
      <Show when={(list() ?? []).length} fallback={<SettingsRow title="Todavía no agregaste proveedores" description="Elegí uno en «Añadir proveedor»." />}>
        <For each={list()}>{provider =>
          <SettingsRow icon={<ProviderIcon kind={provider.kind} class="size-[18px]" />} title={provider.name} description={`${KIND_LABEL[provider.kind]} · ${engines(provider.kind)} · ${provider.models.length ? `${provider.models.length} ${provider.models.length === 1 ? 'modelo' : 'modelos'}` : 'sin modelos elegidos'}${provider.hasKey || isLocal(provider.kind) ? '' : ' · falta la clave'}`}>
            <div class="flex items-center gap-2">
              <SettingsButton tone="quiet" onClick={() => edit(provider)}>Editar</SettingsButton>
              <SettingsButton tone="quiet" onClick={() => void remove(provider)}>Quitar</SettingsButton>
              <SettingsSwitch label={`Usar ${provider.name}`} checked={provider.enabled} onChange={enabled => void toggle(provider, enabled)} />
            </div>
          </SettingsRow>}
        </For>
      </Show>
    </SettingsGroup>

    <Show when={draft()}>{current =>
      <SettingsGroup title={<span class="inline-flex items-center gap-2"><ProviderIcon kind={current().kind} />{current().id ? `Editar ${current().name}` : `Nuevo proveedor · ${KIND_LABEL[current().kind]}`}</span>} description={KIND_HINT[current().kind]}>
        <SettingsRow title="Nombre">
          <input class="syka-settings-input" value={current().name} maxLength={80} onInput={event => patch({ name: event.currentTarget.value })} />
        </SettingsRow>
        <Show when={CUSTOM_URL.includes(current().kind) || isLocal(current().kind)}>
          <SettingsRow title={isLocal(current().kind) ? 'Dirección del servidor' : 'URL base'} description={isLocal(current().kind) ? `La de ${KIND_LABEL[current().kind]} en este equipo. Cambiala solo si usás otro puerto.` : current().kind === 'openaiCompatible' ? 'La de su API de OpenAI, terminada en /v1.' : 'La de su API de Anthropic, sin /v1/messages.'}>
            <input class="syka-settings-input" placeholder={LOCAL_PROVIDERS[current().kind]?.baseUrl ?? 'https://'} value={current().baseUrl} onInput={event => patch({ baseUrl: event.currentTarget.value })} />
          </SettingsRow>
        </Show>
        <SettingsRow title={isLocal(current().kind) ? 'Clave (opcional)' : 'Clave de API'} description={isLocal(current().kind) ? 'Solo si activaste una clave en el servidor. Si no, dejala vacía.' : current().hasKey ? 'Ya hay una clave guardada. Escribí otra para reemplazarla.' : 'Se cifra con Windows y no vuelve a mostrarse.'}>
          <input class="syka-settings-input" type="password" autocomplete="off" placeholder={current().hasKey ? '••••••••' : 'Pegá la clave'} value={current().apiKey}
            onInput={event => patch({ apiKey: event.currentTarget.value })} />
        </SettingsRow>
        <SettingsRow title="Modelos" description={`Los que vas a ver en ${engines(current().kind)}.`} below>
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap gap-1.5">
              <For each={current().models}>{model => <button type="button" class="syka-settings-badge" onClick={() => toggleModel(model)} title="Quitar">{model} ×</button>}</For>
            </div>
            <div class="flex items-center gap-2">
              <input class="syka-settings-input" placeholder="Id del modelo, por ejemplo deepseek-v4-pro" value={modelInput()} onInput={event => setModelInput(event.currentTarget.value)}
                onKeyDown={event => { if (event.key === 'Enter' && modelInput().trim()) { event.preventDefault(); if (!current().models.includes(modelInput().trim())) toggleModel(modelInput().trim()); setModelInput(''); } }} />
              <Show when={current().kind !== 'anthropicCompatible'}>
                <SettingsButton disabled={busy()} onClick={() => void loadCatalog()}>Ver catálogo</SettingsButton>
              </Show>
            </div>
            <Show when={catalog()}>
              <input class="syka-settings-input" placeholder="Buscar en el catálogo" value={filter()} onInput={event => setFilter(event.currentTarget.value)} />
              <div class="syka-provider-catalog">
                <For each={shown()} fallback={<p class="syka-settings-message">Sin resultados.</p>}>{model =>
                  <label><input type="checkbox" checked={current().models.includes(model.id)} onChange={() => toggleModel(model.id)} /><span>{model.name}</span><small>{model.id}</small></label>}
                </For>
              </div>
            </Show>
          </div>
        </SettingsRow>
        <div class="flex items-center justify-end gap-2 px-4 pt-1 pb-3">
          <SettingsButton tone="quiet" onClick={() => setDraft(null)}>Cancelar</SettingsButton>
          <SettingsButton tone="solid" disabled={busy() || !current().name.trim()} onClick={() => void save()}>Guardar</SettingsButton>
        </div>
      </SettingsGroup>}
    </Show>
  </Show>;
}
