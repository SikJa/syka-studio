import { createEffect, createSignal, For, Show } from 'solid-js';
import { HARNESS_IDS, HARNESS_LABELS, type HarnessId, type HarnessInfo, type ProviderAuthFlow } from '@diffusionstudio/agent-chat';
import { Button } from '@/components/ui/button';
import { DashboardSurfaceSection } from './shared';
import { authenticateHarness, cancelProviderAuth, submitProviderAuthCode, providerAuthMethods, chatState, currentModel, ensureConnected, refreshHarnesses, setStoredModel } from '@/agent-chat/store';
import { PROVIDER_LOGOS, PROVIDER_NAMES, PROVIDER_NOTES } from '@/agent-chat/provider-catalog';
import { AssistantMark } from '@/components/ui/assistant-mark';
import { OfficialLink } from './syka-onboarding-settings';
import { Switch, SwitchControl, SwitchInput, SwitchThumb } from '@/components/ui/switch';
import { modelVisibility, pickerHarnesses, setHarnessVisible, setHermesProviderVisible, setModelsVisible } from '@/agent-chat/store';
import { harnessVisible, hermesProvider, hermesProviderGroups, modelVisible } from '@/agent-chat/model-visibility';
import './provider-settings.css';

const STATUS = { ready: 'Conexión disponible', 'signed-out': 'Conectá tu cuenta', 'not-installed': 'Sin conectar', checking: 'Comprobando…', error: 'Conexión pendiente' };
const statusLabel = (id: HarnessId, status: keyof typeof STATUS) => id === 'opencode' && status === 'ready' ? 'Instalación detectada' : STATUS[status];
export function ProviderSettings() {
  ensureConnected();
  return <>
    <DashboardSurfaceSection title="¿Con qué asistente querés editar?" description="Conectá tu cuenta una vez. Después elegís el modelo y trabajás desde el chat.">
    <div class="syka-model-connections"><For each={HARNESS_IDS.filter(id => id !== 'muse')}>{id => <ProviderRow id={id} />}</For>
      <Button variant="ghost" onClick={() => refreshHarnesses(true)}>Volver a comprobar conexiones</Button>
      <p class="syka-model-footnote">Groq transcribe audio y Zernio publica contenido: tienen sus propios apartados. Las capacidades de edición dependen del asistente conectado.</p>
    </div>
  </DashboardSurfaceSection>
    <ModelVisibilitySettings />
  </>;
}
function VisibilitySwitch(props: { label: string; checked: boolean; onChange(value: boolean): void }) {
  return <Switch checked={props.checked} onChange={props.onChange}>
    <SwitchInput aria-label={props.label} /><SwitchControl><SwitchThumb /></SwitchControl>
  </Switch>;
}
function ModelVisibilitySettings() {
  const count = () => pickerHarnesses().filter(h => h.status === 'ready').reduce((n, h) => n + h.models.length, 0);
  return <DashboardSurfaceSection title="Modelos visibles" description="Elegí qué querés ver en el selector del chat. Se guarda en este equipo; no desconecta cuentas ni cambia los chats existentes.">
    <div class="syka-model-visibility-grid"><For each={HARNESS_IDS.filter(id => id !== 'muse')}>{id =>
      <div class="syka-model-visibility-row" data-harness={id}>
        <span class="syka-model-visibility-logo" aria-hidden="true" innerHTML={PROVIDER_LOGOS[id]} />
        <span>{PROVIDER_NAMES[id]}</span>
        <VisibilitySwitch label={`Mostrar ${PROVIDER_NAMES[id]} en el selector`} checked={harnessVisible(id, modelVisibility())} onChange={value => setHarnessVisible(id, value)} />
      </div>
    }</For></div>
    <div class="syka-model-catalogs" aria-label="Elegir modelos visibles por proveedor"><For each={HARNESS_IDS.filter(id=>id!=='muse')}>{id=><Show when={chatState.harnesses.find(h=>h.id===id)?.models.length}><ProviderModelVisibility info={chatState.harnesses.find(h=>h.id===id)!}/></Show>}</For></div>
    <p class="syka-model-footnote" role="status">{count()} modelos visibles en el selector. Mostrar un catálogo no confirma que tenga sesión o cuota disponible.</p>
    <Show when={count() === 0}><p class="syka-model-footnote">Para iniciar un chat nuevo, mostrale al menos un proveedor conectado al selector.</p></Show>
  </DashboardSurfaceSection>;
}
function ProviderModelVisibility(props:{info:HarnessInfo}){
  const [open,setOpen]=createSignal(false),[query,setQuery]=createSignal('');
  const groups = () => props.info.id === 'hermes' ? hermesProviderGroups(props.info.models) : [];
  const name=()=>PROVIDER_NAMES[props.info.id];
  const enabled=(id:string)=>modelVisibility().models?.[props.info.id]?.[id]!==false;
  const matching=()=>props.info.models.filter(m=>(m.label+' '+m.id).toLocaleLowerCase().includes(query().trim().toLocaleLowerCase()));
  return <details class="syka-provider-model-visibility" data-model-catalog={props.info.id} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary><span class="syka-model-visibility-logo" aria-hidden="true" innerHTML={PROVIDER_LOGOS[props.info.id]}/><strong>{name()}</strong><span>{props.info.models.filter(m=>modelVisible(props.info.id,m,modelVisibility())).length} / {props.info.models.length} modelos</span></summary>
    <Show when={open()}><div class="syka-provider-model-content">
      <Show when={groups().length > 0}><section class="syka-hermes-provider-visibility" aria-label="Proveedores de Hermes">
        <p>Podés usar Hermes y ocultar catálogos completos, como OpenRouter.</p>
        <div class="syka-model-visibility-grid"><For each={groups()}>{group =>
          <div class="syka-model-visibility-row" data-hermes-provider={group.id}>
            <span>{group.label}<small>{group.count} {group.count === 1 ? 'modelo' : 'modelos'}</small></span>
            <VisibilitySwitch label={`Mostrar ${group.label} en Hermes`} checked={modelVisibility().hermesProviders[group.id] !== false} onChange={value => setHermesProviderVisible(group.id, value)} />
          </div>
        }</For></div>
      </section></Show>
      <p>Elegí los modelos que querés ver en el chat. Los que ocultes siguen disponibles en sus conversaciones actuales.</p>
      <Show when={!harnessVisible(props.info.id,modelVisibility())}><p>Este proveedor está oculto. Podés preparar su lista antes de volver a mostrarlo.</p></Show>
      <div class="syka-model-list-controls"><input type="search" placeholder="Buscar un modelo…" aria-label={`Buscar modelos en ${name()}`} value={query()} onInput={event=>setQuery(event.currentTarget.value)}/><button type="button" aria-label={`Mostrar todos los modelos de ${name()}`} onClick={()=>setModelsVisible(props.info.id,props.info.models.map(m=>m.id),true)}>Mostrar todos</button><button type="button" aria-label={`Ocultar todos los modelos de ${name()}`} onClick={()=>setModelsVisible(props.info.id,props.info.models.map(m=>m.id),false)}>Ocultar todos</button></div>
      <div class="syka-individual-model-list"><For each={matching()}>{model=><div class="syka-individual-model-row" data-model-id={model.id}><span><strong>{model.label}</strong><Show when={props.info.id==='antigravity'||props.info.id==='hermes'}><small>Vía {props.info.id==='antigravity'?'Antigravity':hermesProvider(model).label}</small></Show></span><VisibilitySwitch label={`Mostrar ${model.label} en ${name()}`} checked={enabled(model.id)} onChange={value=>setModelsVisible(props.info.id,[model.id],value)}/></div>}</For><Show when={matching().length===0}><p>No hay modelos que coincidan con la búsqueda.</p></Show></div>
    </div></Show>
  </details>;
}
function ProviderRow(props: { id: HarnessId }) {
  const [expanded, setExpanded] = createSignal(false), [busy, setBusy] = createSignal(false), [error, setError] = createSignal('');
  const info = () => chatState.harnesses.find(h => h.id === props.id);
  const flow = () => info()?.authFlow;
  const connecting = () => busy() || !!flow() && ['preparing', 'waiting', 'verifying'].includes(flow()!.phase);
  const connect = async (methodId = 'connect') => {
    setError(''); setBusy(true);
    try { await authenticateHarness(props.id, methodId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo iniciar la conexión. Reintentá.'); }
    finally { setBusy(false); }
  };
  const accounts = async () => {
    setError(''); setExpanded(true); setBusy(true);
    try { const methods = await providerAuthMethods(props.id); if (!methods.length) setError('Este proveedor no anunció un login de navegador disponible para agregar otra cuenta.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron comprobar los métodos de conexión.'); }
    finally { setBusy(false); }
  };
  return <article class="syka-model-card" data-provider={props.id}>
    <div class="syka-model-heading">
      <span class="syka-model-mark" aria-hidden="true" innerHTML={PROVIDER_LOGOS[props.id] ?? ''} />
      <div class="syka-model-title"><strong>{PROVIDER_NAMES[props.id]}</strong><span data-ready={info()?.status === 'ready'}>{statusLabel(props.id, info()?.status ?? 'not-installed')}</span></div>
      <Show when={info()?.status === 'ready' && !connecting()} fallback={
        <Button variant="secondary" class="syka-model-login" disabled={connecting()} onClick={() => void connect()}><AssistantMark provider={props.id} class="size-4" />{connecting() ? 'Conectando…' : `Conectar ${PROVIDER_NAMES[props.id]}`}</Button>
      }>
        <Button variant="secondary" aria-expanded={expanded()} onClick={() => setExpanded(!expanded())}>Elegir modelo</Button>
      </Show>
    </div>
    <p>{PROVIDER_NOTES[props.id]}</p>
    <Show when={flow()}>{value => <ProviderLoginPanel id={props.id} flow={value()} />}</Show>
    <Show when={props.id === 'codex' && info()?.status !== 'ready'}><button type="button" class="syka-model-help" disabled={connecting()} onClick={() => void connect('chatgpt-device')}>Vincular con un código de ChatGPT</button></Show>
    <Show when={props.id === 'opencode' && info()?.detail}><p class="syka-model-footnote" role="status">{info()?.detail}</p></Show>
    <Show when={info()?.status !== 'ready' && !connecting()}><button type="button" class="syka-model-help" aria-expanded={expanded()} onClick={() => setExpanded(!expanded())}>{expanded() ? 'Ocultar detalles' : 'Detalles de la conexión'}</button></Show>
    <Show when={info()?.status === 'checking' && !flow()}><p role="status">Comprobando la instalación y la sesión…</p></Show>
    <Show when={expanded()}><div class="syka-model-guide t-panel-slide" data-open="true">
      <Show when={info()?.status !== 'ready'}>
        <Show when={info()?.detail && !flow()}><p role="status">{info()?.detail}</p></Show>
        <Show when={info()?.version}><p>Versión detectada: {info()!.version}</p></Show>
        <Button variant="ghost" disabled={connecting()} onClick={() => refreshHarnesses(true)}>Volver a comprobar</Button>
      </Show>
      <Show when={info()?.status === 'ready'}><div class="syka-model-options" aria-label={`Modelos de ${HARNESS_LABELS[props.id]}`}>
        <For each={info()?.models}>{model => <button type="button" aria-pressed={currentModel()?.harness === props.id && currentModel()?.model === model.id} onClick={() => setStoredModel({ harness: props.id, model: model.id })}><span>{model.label}</span><span>{currentModel()?.harness === props.id && currentModel()?.model === model.id ? 'Elegido' : 'Elegir'}</span></button>}</For>
      </div></Show>
      <Show when={info()?.status === 'ready' && props.id !== 'antigravity'}><Button variant="ghost" disabled={connecting()} onClick={() => void accounts()}>Conectar otra cuenta</Button><div class="syka-provider-auth-methods"><For each={info()?.authMethods}>{method => <Button variant="secondary" disabled={connecting()} onClick={() => void connect(method.id)}>{method.label}</Button>}</For></div></Show>
      <Show when={info()?.status === 'ready' && props.id === 'antigravity'}><p class="syka-model-footnote">Usás la cuenta conectada en Antigravity. Para cambiarla, cambiá de cuenta en Antigravity y volvé a comprobar la conexión.</p><Button variant="ghost" disabled={connecting()} onClick={() => refreshHarnesses(true)}>Volver a comprobar</Button></Show>
    </div></Show>
    <Show when={error()}><p role="alert" class="text-destructive">{error()}</p></Show>
  </article>;
}

function ProviderLoginPanel(props: { id: HarnessId; flow: ProviderAuthFlow }) {
  const [code, setCode] = createSignal(''), [error, setError] = createSignal(''), [sending, setSending] = createSignal(false);
  const active = () => ['preparing', 'waiting', 'verifying'].includes(props.flow.phase);
  let lastFlow: string | undefined;
  createEffect(() => {
    if (lastFlow !== props.flow.id || !props.flow.inputPrompt) setCode('');
    lastFlow = props.flow.id;
  });
  const respond = async (event: SubmitEvent) => {
    event.preventDefault(); setSending(true); setError('');
    try { await submitProviderAuthCode(props.id, props.flow.id, code()); setCode(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo enviar el código.'); }
    finally { setSending(false); }
  };
  return <div class="syka-provider-login" data-auth-phase={props.flow.phase}>
    <p role={props.flow.phase === 'failed' ? 'alert' : 'status'}>{props.flow.message}</p>
    <Show when={active() && props.flow.url}><OfficialLink href={props.flow.url!}>Abrir inicio de sesión oficial</OfficialLink></Show>
    <Show when={active() && props.flow.userCode}><div class="syka-provider-device-code"><span>Código de vinculación</span><strong>{props.flow.userCode}</strong><button type="button" onClick={() => void navigator.clipboard.writeText(props.flow.userCode!).catch(() => setError('No se pudo copiar. Seleccioná el código para copiarlo.'))}>Copiar código</button></div></Show>
    <Show when={active() && props.flow.inputPrompt && props.flow.options?.length}><div class="syka-provider-auth-methods" aria-label={props.flow.inputPrompt}><For each={props.flow.options}>{option => <Button variant="secondary" disabled={sending()} onClick={() => { setSending(true); void submitProviderAuthCode(props.id, props.flow.id, option.id).catch(cause => setError(cause instanceof Error ? cause.message : 'No se pudo elegir la cuenta.')).finally(() => setSending(false)); }}>{option.label}</Button>}</For></div></Show>
    <Show when={active() && props.flow.inputPrompt && !props.flow.options?.length}><form onSubmit={event => void respond(event)}><label>{props.flow.inputPrompt}<input autocomplete="off" spellcheck={false} aria-label="Código de autorización" value={code()} onInput={event => setCode(event.currentTarget.value)} /></label><Button type="submit" variant="secondary" disabled={sending() || !code().trim()}>Verificar código</Button></form></Show>
    <Show when={active()}><Button variant="ghost" onClick={() => void cancelProviderAuth(props.id, props.flow.id).catch(cause => setError(cause instanceof Error ? cause.message : 'No se pudo cancelar.'))}>Cancelar conexión</Button></Show>
    <Show when={error()}><p role="alert">{error()}</p></Show>
  </div>;
}
