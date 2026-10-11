import { For, Show, createSignal } from 'solid-js';
import { Button } from '@/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '@/components/ui/text-field';
import { ProviderSocialButton } from '@/components/ui/provider-social-button';
import { PlatformMark, SocialPlatformStack, ZernioMark } from '@/components/ui/provider-mark';
import { DashboardScrollView, DashboardSurfaceSection, DashboardFormModal } from '@/components/dashboard/shared';
import { openZernio, usePublication } from './state';
import './motion.css';

export function ZernioSettingsView() {
  const state = usePublication();
  const [method, setMethod] = createSignal<'oauth' | 'api_key'>('oauth');
  const [label, setLabel] = createSignal(''), [key, setKey] = createSignal(''), [visible, setVisible] = createSignal(false);
  const [removing, setRemoving] = createSignal<string | null>(null);
  const add = async () => {
    const request = method() === 'oauth' ? { action: 'add-oauth' as const, label: label() } : { action: 'add-key' as const, label: label(), key: key() };
    const done = await state.act(request, method() === 'oauth' ? 'Inicio de sesión preparado' : 'Clave guardada. Podés verificar la conexión.');
    setKey(''); setVisible(false); if (done) setLabel('');
  };
  return <DashboardScrollView class="syka-publication">
    <article class="syka-provider-panel">
      <div class="syka-provider-heading"><span class="syka-provider-tile"><ZernioMark class="size-7" /></span><div><h3>Conectá Zernio</h3><p>Tus cuentas, tus videos y un lugar para publicarlos.</p></div><span class="syka-settings-badge">OAuth · API key</span></div>
      <Show when={window.desktop} fallback={<p class="p-5 text-xs text-muted-foreground">Disponible en la aplicación de escritorio.</p>}>
        <div class="syka-provider-form">
            <details class="syka-provider-caption" open>
            <summary>Cómo crear y conectar tu cuenta</summary>
            <ol class="list-decimal pl-5 space-y-2 py-3">
              <li>Creá tu cuenta o ingresá en <a href="https://zernio.com/" target="_blank" rel="noopener noreferrer">Zernio</a>.</li>
              <li>En <a href="https://zernio.com/dashboard/api-keys" target="_blank" rel="noopener noreferrer">API keys</a>, elegí Create API key y copiá la clave al crearla.</li>
              <li>Elegí «API key» acá, poné un nombre a la conexión y pegá la clave en el campo protegido. Guardá y verificá la conexión.</li>
              <li>Conectá las cuentas sociales desde Zernio y autorizá cada plataforma. Volvé a Syka y actualizá la conexión para comprobar qué cuentas quedaron disponibles.</li>
            </ol>
            <p>También podés usar «Iniciar sesión» si la integración OAuth está configurada. Crear un borrador o exportar un video no lo publica.</p>
            <a href="https://docs.zernio.com/" target="_blank" rel="noopener noreferrer">Guía oficial de conexión</a>
          </details>
          <Show when={state.error()}><p role="alert" class="syka-settings-error">{state.error()}</p></Show>
          <Show when={!state.loading() && !state.data()?.secureStorage}><p role="alert" class="syka-settings-error">El almacenamiento seguro del sistema no está disponible.</p></Show>
          <div class="syka-provider-methods" role="group" aria-label="Método de conexión">
            <button type="button" aria-pressed={method() === 'oauth'} disabled={state.busy()} onClick={() => { setMethod('oauth'); setKey(''); setVisible(false); }}>Iniciar sesión</button>
            <button type="button" aria-pressed={method() === 'api_key'} disabled={state.busy()} onClick={() => { setMethod('api_key'); setVisible(false); }}>API key</button>
          </div>
          <TextField value={label()} onChange={setLabel}><TextFieldLabel uiSize="compact">Nombre de la conexión</TextFieldLabel><TextFieldInput uiSize="compact" placeholder="Personal, marca o cliente" maxlength={80} disabled={state.busy()} /></TextField>
          <Show when={method() === 'api_key'} fallback={<p class="syka-provider-caption">Autorizá a Syka desde tu navegador. Tu sesión queda protegida por el almacenamiento seguro del sistema.</p>}>
            <div class="t-panel-slide flex flex-col gap-2" data-open="true">
              <TextField value={key()} onChange={setKey}><TextFieldLabel uiSize="compact">API key de Zernio</TextFieldLabel><div class="syka-provider-key-input"><TextFieldInput uiSize="compact" type={visible() ? 'text' : 'password'} autocomplete="off" spellcheck={false} maxlength={8192} placeholder="sk_… o zrk_…" disabled={state.busy()} /><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="15" cy="8" r="5" /><path d="m11.5 11.5-8 8v2h4v-3h3v-3l3-3" /></svg><button type="button" aria-label={visible() ? 'Ocultar clave' : 'Mostrar clave'} aria-pressed={visible()} disabled={state.busy()} onClick={() => setVisible(value => !value)}><svg aria-hidden="true" viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /><Show when={visible()}><path d="m4 3 16 18" /></Show></svg></button></div></TextField>
              <p class="syka-provider-caption">Se cifra en este equipo. Podés cambiar la conexión cuando necesites.</p>
            </div>
          </Show>
          <ProviderSocialButton provider="zernio" label={state.busy() ? 'Preparando…' : method() === 'oauth' ? 'Conectar con Zernio' : 'Guardar conexión'} disabled={state.busy() || !state.data()?.secureStorage || !label().trim() || method() === 'api_key' && !key().trim()} onClick={() => void add()} />
          <Show when={method() === 'api_key'}><button type="button" class="syka-provider-secondary-link" onClick={() => openZernio('keys')}>Obtener una API key en Zernio ↗</button></Show>
        </div>
      </Show>
      <SocialPlatformStack>Publicá desde Syka en YouTube e Instagram.</SocialPlatformStack>
    </article>
    <DashboardSurfaceSection title="Tus conexiones" description="Agregá tu cuenta personal, una marca o un cliente. Cada conexión conserva sus propios destinos.">
      <Show when={!state.loading()} fallback={<p role="status" class="text-xs text-muted-foreground">Leyendo conexiones…</p>}>
        <Show when={state.data()?.connections.length} fallback={<p class="syka-connections-empty">Todavía no agregaste una conexión.</p>}>
          <For each={state.data()?.connections}>{connection => <div class="syka-connection-card" data-zernio-connection={connection.id}>
            <div class="syka-connection-title"><ZernioMark class="size-6 shrink-0" /><div><strong>{connection.label}</strong><small>{connection.pending ? 'Esperando autorización en el navegador…' : connection.owner ? connection.owner.name : connection.configured ? 'Credencial guardada · pendiente de verificación' : 'Conexión sin completar'}</small></div><span class="syka-settings-badge">{connection.method === 'oauth' ? 'OAuth' : 'API key'}</span></div>
            <div class="mt-3 flex flex-wrap gap-2"><Show when={!connection.pending} fallback={<Button variant="ghost" disabled={state.busy()} onClick={() => void state.act({ action: 'cancel-oauth', id: connection.id })}>Cancelar</Button>}><Button variant="secondary" disabled={state.busy() || !connection.configured} onClick={() => void state.act({ action: 'sync', id: connection.id })}>Verificar</Button><Button variant="ghost" disabled={state.busy()} onClick={() => setRemoving(connection.id)}>Quitar</Button></Show></div>
            <Show when={connection.error}><p class="mt-3 text-xs text-destructive" role="alert">{connection.error}</p></Show>
            <div class="mt-3"><For each={connection.accounts}>{account => <div class="syka-connection-account"><PlatformMark platform={account.platform} /><div><p class="truncate">{account.username}</p><small>{account.platform}</small></div><span>{account.canPost === true ? 'Lista para publicar' : account.canPost === false ? 'Requiere atención' : 'Permiso sin verificar'}</span></div>}</For></div>
            <Show when={connection.checkedAt}><p class="mt-2 text-xxs text-muted-foreground">Última verificación: {new Date(connection.checkedAt!).toLocaleString()}</p></Show>
          </div>}</For>
        </Show>
      </Show>
    </DashboardSurfaceSection>
    <details class="syka-provider-limits"><summary>Cuentas y límites de Zernio</summary><p>Podés agregar varias conexiones propias o de clientes. Los límites se aplican a cada equipo de Zernio; los perfiles no amplían el cupo gratuito.</p><div class="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => openZernio('dashboard')}>Administrar cuentas sociales</Button><Button variant="ghost" onClick={() => openZernio('pricing')}>Ver límites y precios</Button></div></details>
    <DashboardFormModal open={!!removing()} title="Quitar conexión de Syka" onClose={() => setRemoving(null)} footer={<><Button variant="ghost" onClick={() => setRemoving(null)}>Cancelar</Button><Button variant="secondary" disabled={state.busy()} onClick={async () => { if (await state.act({ action: 'disconnect', id: removing()! })) setRemoving(null); }}>Quitar conexión</Button></>}><p class="text-xs text-muted-foreground">Se elimina la credencial de este equipo. Los borradores y el historial se conservan. Podés revocar la autorización desde Zernio.</p></DashboardFormModal>
  </DashboardScrollView>;
}
