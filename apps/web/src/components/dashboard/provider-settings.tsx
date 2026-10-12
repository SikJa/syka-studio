import { createSignal, For, Show } from 'solid-js';
import { HARNESS_IDS, HARNESS_LABELS, type HarnessId, type HarnessInfo } from '@diffusionstudio/agent-chat';
import { Button } from '@/components/ui/button';
import { DashboardSurfaceSection } from './shared';
import { authenticateHarness, chatState, currentModel, ensureConnected, refreshHarnesses, setStoredModel } from '@/agent-chat/store';
import { PROVIDER_LOGOS, PROVIDER_NAMES, PROVIDER_NOTES, PROVIDER_GUIDES } from '@/agent-chat/provider-catalog';
import { AssistantMark } from '@/components/ui/assistant-mark';
import { OfficialLink } from './syka-onboarding-settings';
import { Switch, SwitchControl, SwitchInput, SwitchThumb } from '@/components/ui/switch';
import { modelVisibility, pickerHarnesses, setHarnessVisible, setHermesProviderVisible, setModelsVisible } from '@/agent-chat/store';
import { harnessVisible, hermesProvider, hermesProviderGroups, modelVisible } from '@/agent-chat/model-visibility';
import './provider-settings.css';

const STATUS = { ready: 'Listo para editar', 'signed-out': 'Conectá tu cuenta', 'not-installed': 'Sin conectar', checking: 'Comprobando…', error: 'Revisar instalación' };
const statusLabel = (id: HarnessId, status: keyof typeof STATUS) => id === 'opencode' && status === 'ready' ? 'Instalación detectada' : STATUS[status];
export function ProviderSettings() {
  ensureConnected();
  return <>
    <ModelVisibilitySettings />
    <DashboardSurfaceSection title="¿Con qué asistente querés editar?" description="Conectá tu cuenta una vez. Después elegís el modelo y trabajás desde el chat.">
    <div class="syka-model-connections"><For each={HARNESS_IDS.filter(id => id !== 'muse')}>{id => <ProviderRow id={id} />}</For>
      <Button variant="ghost" onClick={() => refreshHarnesses(true)}>Volver a comprobar conexiones</Button>
      <p class="syka-model-footnote">Groq transcribe audio y Zernio publica contenido: tienen sus propios apartados. Las capacidades de edición dependen del asistente conectado.</p>
    </div>
  </DashboardSurfaceSection></>;
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
  const login = () => info()?.authMethods?.[0];
  const guide = () => PROVIDER_GUIDES[props.id];
  const connect = async () => {
    setError(''); setBusy(true); setExpanded(true);
    try { if (login()) await authenticateHarness(props.id, login()!.id); }
    catch { setError('No se pudo iniciar la conexión. Volvé a comprobarla y reintentá.'); }
    finally { setBusy(false); }
  };
  return <article class="syka-model-card" data-provider={props.id}>
    <div class="syka-model-heading">
      <span class="syka-model-mark" aria-hidden="true" innerHTML={PROVIDER_LOGOS[props.id] ?? ''} />
      <div class="syka-model-title"><strong>{PROVIDER_NAMES[props.id]}</strong><span data-ready={info()?.status === 'ready'}>{statusLabel(props.id, info()?.status ?? 'not-installed')}</span></div>
      <Show when={info()?.status === 'signed-out' && login()} fallback={
        <Show when={info()?.status === 'ready' || info()?.status === 'checking'} fallback={<span class="syka-model-connect"><OfficialLink href={guide().url}><AssistantMark provider={props.id} class="size-4" />Configurar {PROVIDER_NAMES[props.id]}</OfficialLink></span>}>
          <Button variant="secondary" aria-expanded={expanded()} disabled={info()?.status === 'checking'} onClick={() => setExpanded(!expanded())}>{info()?.status === 'checking' ? 'Comprobando…' : 'Elegir modelo'}</Button>
        </Show>
      }>
        <Button variant="secondary" class="syka-model-login" disabled={busy()} onClick={() => void connect()}><AssistantMark provider={props.id} class="size-4" />{busy() ? 'Abriendo…' : `Conectar ${PROVIDER_NAMES[props.id]}`}</Button>
      </Show>
    </div>
    <p>{PROVIDER_NOTES[props.id]}</p>
    <Show when={props.id === 'opencode' && info()?.detail}><p class="syka-model-footnote" role="status">{info()?.detail}</p></Show>
    <Show when={props.id === 'opencode' && info()?.status === 'ready'}><details class="syka-model-guide"><summary>Conectar otra cuenta en OpenCode</summary><p>Abrí OpenCode y usá /connect. Se usa el mismo perfil de tu CLI; no necesitás otra cuenta para probar sus modelos gratuitos.</p><OfficialLink href="https://opencode.ai/docs/providers/">Conexiones de OpenCode · guía oficial</OfficialLink><Button variant="ghost" onClick={() => refreshHarnesses(true)}>Ya la conecté · comprobar</Button></details></Show>
    <Show when={info()?.status !== 'ready' && info()?.status !== 'checking'}><button type="button" class="syka-model-help" aria-expanded={expanded()} onClick={() => setExpanded(!expanded())}>{expanded() ? 'Ocultar pasos' : 'Cómo conectarlo · paso a paso'}</button></Show>
    <Show when={info()?.status === 'checking'}><p role="status">Completá la conexión en el navegador si ya la iniciaste.</p></Show>
    <Show when={expanded()}><div class="syka-model-guide t-panel-slide" data-open="true">
      <Show when={info()?.status !== 'ready'}>
        <ol><For each={guide().steps}>{step => <li>{step}</li>}</For></ol>
        <OfficialLink href={guide().url}>{guide().linkLabel}</OfficialLink>
        <Show when={guide().limitation}><p class="syka-model-limitation">{guide().limitation}</p></Show>
        <Button variant="ghost" disabled={busy() || info()?.status === 'checking'} onClick={() => refreshHarnesses(true)}>Ya lo preparé · comprobar</Button>
      </Show>
      <Show when={info()?.status === 'ready'}><div class="syka-model-options" aria-label={`Modelos de ${HARNESS_LABELS[props.id]}`}>
        <For each={info()?.models}>{model => <button type="button" aria-pressed={currentModel()?.harness === props.id && currentModel()?.model === model.id} onClick={() => setStoredModel({ harness: props.id, model: model.id })}><span>{model.label}</span><span>{currentModel()?.harness === props.id && currentModel()?.model === model.id ? 'Elegido' : 'Elegir'}</span></button>}</For>
      </div></Show>
    </div></Show>
    <Show when={error()}><p role="alert" class="text-destructive">{error()}</p></Show>
  </article>;
}
