import { createResource, createSignal, For, Show } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { Button } from '@/components/ui/button';
import { DashboardScrollView, DashboardSurfaceSection } from './shared';
import type { AgentServer } from '../../../../../packages/agent-chat/src/host/agent-config';
import { t } from '@/i18n';

type Request = Parameters<typeof mainBridge.call<typeof MAIN_CHANNELS.SYKA_AGENT_SETTINGS>>[1];
function description(text: string) {
  const line = text.match(/^description:\s*(.+)$/m)?.[1];
  if (!line) return 'Flujo reutilizable guardado en tu perfil.';
  if (line.startsWith('"')) { try { return JSON.parse(line) as string; } catch { /* Keep the readable line. */ } }
  return line.replace(/^'|'$/g, '');
}

export function AgentSettings(props: { section?: 'skills' | 'plugins' } = {}) {
  const [state, { mutate, refetch }] = createResource(async () => window.desktop ? mainBridge.call(MAIN_CHANNELS.SYKA_AGENT_SETTINGS, { action: 'get' }) : null);
  const [name, setName] = createSignal(''), [endpoint, setEndpoint] = createSignal(''), [args, setArgs] = createSignal('[]'), [kind, setKind] = createSignal('url');
  const [skill, setSkill] = createSignal(''), [content, setContent] = createSignal(''), [revision, setRevision] = createSignal<string>();
  const [busy, setBusy] = createSignal(false), [editing, setEditing] = createSignal(false), [query, setQuery] = createSignal(''), [error, setError] = createSignal('');
  const run = async (request: Request) => {
    if (busy()) return;
    setBusy(true); setError('');
    try {
      const result = await mainBridge.call(MAIN_CHANNELS.SYKA_AGENT_SETTINGS, request);
      if (request.action !== 'read-skill') { mutate(result); toast.success('Configuración guardada'); }
      return result;
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };
  const saveServers = (servers: AgentServer[]) => run({ action: 'save-mcp', servers });
  const importSkill = async () => {
    try { const source = await mainBridge.call(MAIN_CHANNELS.PROJECTS_PICK_FOLDER, undefined); if (source) await run({ action: 'import-skill', source }); }
    catch (failure) { setError(String(failure)); }
  };
  const showFolder = async (path: string) => {
    try { await mainBridge.call(MAIN_CHANNELS.APP_SHOW_IN_FOLDER, { path }); } catch { toast.error('No se pudo mostrar la carpeta.'); }
  };
  const visibleSkills = () => (state()?.skills ?? []).filter(item => `${item.name} ${item.description}`.toLocaleLowerCase().includes(query().toLocaleLowerCase()));
  return <DashboardScrollView>
    <Show when={window.desktop} fallback={<p class="text-xs text-muted-foreground">Disponible en la aplicación de escritorio.</p>}>
      <Show when={state.loading}><p class="text-xs text-muted-foreground" role="status">Leyendo configuración local…</p></Show>
      <Show when={state.error || error()}><p class="syka-settings-error" role="alert">{error() || String(state.error)} <Button variant="ghost" onClick={() => void refetch()}>Volver a cargar</Button></p></Show>
      <Show when={props.section !== 'skills'}>
        <DashboardSurfaceSection title="Servidores MCP" description="Extensiones de herramientas para el Codex de Syka. Se cargan al iniciar una nueva sesión de chat.">
          <Show when={state()?.servers.length} fallback={<p class="text-xs text-muted-foreground">Todavía no agregaste un servidor MCP.</p>}>
            <For each={state()?.servers}>{server => <div class="syka-settings-row">
              <div class="min-w-0"><p>{server.name}</p><small class="break-all select-text">{server.url ? server.url.split('?')[0] : server.command}</small></div>
              <div class="flex items-center gap-2"><input type="checkbox" class="syka-native-check" aria-label={'Habilitar ' + server.name} checked={server.enabled} disabled={busy()} onChange={event => void saveServers(state()!.servers.map(item => item.name === server.name ? { ...item, enabled: event.currentTarget.checked } : item))} /><Button variant="ghost" disabled={busy()} onClick={() => void saveServers(state()!.servers.filter(item => item.name !== server.name))}>Quitar</Button></div>
            </div>}</For>
          </Show>
          <Button variant="secondary" class="self-start" disabled={busy() || state.loading || !!state.error} onClick={() => setEditing(value => !value)}>{editing() ? 'Cerrar formulario' : 'Agregar servidor'}</Button>
          <Show when={editing()}><form class="syka-settings-form t-panel-slide" data-open="true" onSubmit={async event => {
            event.preventDefault();
            try {
              const parsed = kind() === 'stdio' ? JSON.parse(args()) : undefined;
              const result = await saveServers([...(state()?.servers ?? []), { name: name().trim(), enabled: true, ...(kind() === 'url' ? { url: endpoint().trim() } : { command: endpoint().trim(), args: parsed }) }]);
              if (result) { setName(''); setEndpoint(''); setArgs('[]'); setEditing(false); }
            } catch (failure) { setError(String(failure)); }
          }}>
            <label>Nombre del servidor<input class="syka-settings-input" value={name()} onInput={event => setName(event.currentTarget.value)} placeholder="mi-servidor" maxlength={64} disabled={busy()} required /></label>
            <label>Tipo de conexión<select class="syka-settings-select" value={kind()} onChange={event => setKind(event.currentTarget.value)} disabled={busy()}><option value="url">URL HTTP</option><option value="stdio">Comando local (stdio)</option></select></label>
            <label>{kind() === 'url' ? 'URL del servidor' : 'Ejecutable'}<input class="syka-settings-input" value={endpoint()} onInput={event => setEndpoint(event.currentTarget.value)} placeholder={kind() === 'url' ? 'https://servidor.com/mcp' : 'Ruta del ejecutable'} disabled={busy()} required /></label>
            <Show when={kind() === 'stdio'}><label>Argumentos · lista JSON<input class="syka-settings-input" value={args()} onInput={event => setArgs(event.currentTarget.value)} disabled={busy()} /></label></Show>
            <Button type="submit" variant="secondary" class="self-start" disabled={busy() || !name().trim() || !endpoint().trim()}>Guardar servidor</Button>
          </form></Show>
        </DashboardSurfaceSection>
      </Show>
      <Show when={props.section !== 'plugins'}>
        <div class="syka-settings-toolbar"><input class="syka-settings-input" type="search" aria-label="Buscar skills" placeholder="Buscar en tu biblioteca…" value={query()} onInput={event => setQuery(event.currentTarget.value)} /><Button variant="secondary" disabled={busy() || state.loading || !!state.error} onClick={() => void importSkill()}>Importar skill</Button><Button variant="ghost" disabled={busy() || state.loading || !!state.error} onClick={() => { setSkill(''); setContent(''); setRevision(undefined); setEditing(true); }}>Crear skill</Button></div>
        <For each={[{ name: 'Mis skills', bundled: false }, { name: 'Incluidas con Syka', bundled: true }]}>{group => <DashboardSurfaceSection title={t(group.name)}>
          <Show when={visibleSkills().some(item => !!item.bundled === group.bundled)} fallback={<p class="text-xs text-muted-foreground">{query() ? 'No hay resultados para esta búsqueda.' : group.bundled ? 'No se encontraron skills incluidas.' : 'Importá o creá tu primer flujo reutilizable.'}</p>}>
            <For each={visibleSkills().filter(item => !!item.bundled === group.bundled)}>{item => <article class="syka-skill-settings-card">
              <div><strong>{item.name}</strong><small>{description(item.description)}</small><span class="syka-settings-badge">{item.format === 'youtube' ? 'YouTube' : item.format === 'reels' ? 'Reels' : 'General'}{item.bundled ? ' · Base de Syka' : ' · Personal'}</span></div>
              <div class="flex shrink-0 items-center gap-1"><Show when={!item.bundled}><Button variant="ghost" disabled={busy()} onClick={async () => { const result = await run({ action: 'read-skill', name: item.name }); if (result?.content) { setSkill(item.name); setContent(result.content); setRevision(result.revision); setEditing(true); } }}>Editar</Button></Show><Button variant="ghost" disabled={busy()} onClick={() => void showFolder(item.path)}>Carpeta</Button></div>
            </article>}</For>
          </Show>
        </DashboardSurfaceSection>}</For>
        <Show when={editing()}><DashboardSurfaceSection title={revision() ? 'Editar skill' : 'Nueva skill'}>
          <form class="syka-settings-form" onSubmit={async event => { event.preventDefault(); const result = await run({ action: revision() ? 'save-skill' : 'create-skill', name: skill(), content: content(), revision: revision() }); if (result) { setRevision(result.revision); setEditing(false); } }}>
            <label>Nombre de la skill<input class="syka-settings-input" value={skill()} onInput={event => { setSkill(event.currentTarget.value); setRevision(undefined); }} disabled={busy() || !!revision()} placeholder="mi-flujo-reels" maxlength={80} required /></label>
            <label>Instrucciones · SKILL.md<textarea class="syka-settings-input" rows={8} value={content()} onInput={event => setContent(event.currentTarget.value)} disabled={busy()} placeholder="Describí el flujo que debe seguir el agente…" required /></label>
            <div class="flex gap-2"><Button type="submit" variant="secondary" disabled={busy() || !skill().trim() || !content().trim()}>{revision() ? 'Guardar cambios' : 'Guardar skill'}</Button><Button variant="ghost" disabled={busy()} onClick={() => setEditing(false)}>Cancelar</Button></div>
          </form>
        </DashboardSurfaceSection></Show>
        <p class="text-xxs text-muted-foreground">Podés personalizar las bases y ejecutar tus skills desde Biblioteca → Skills, dentro de un proyecto.</p>
      </Show>
    </Show>
  </DashboardScrollView>;
}
