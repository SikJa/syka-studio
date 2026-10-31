import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { spawn } from 'node:child_process';
import { AcpHarness } from './acp';
import { findOpenCode } from './opencode';
import type { Harness } from './harness';
import type { HarnessInfo } from '../protocol';

const ROUTE = 'gemini-web-syka/web-argon';
const base = { id: 'gemini-web' as const, label: 'Gemini Web · Experimental', models: [] };
const AUTH_BLOCKED = 'Google rechazó el inicio de sesión del navegador del puente. La conexión está detenida; no se reintentará el login ni se usará otro modelo.';
type Installation = { bridgeRoot: string; command?: string; transport?: 'cdp' | 'extension'; port?: number };
const TAB_HELP = 'En la pestaña de Gemini de tu perfil de Brave, abrí la extensión Syka y pulsá «Conectar esta pestaña». No hace falta volver a iniciar sesión.';
type BridgeState = { service?: string; status?: string; observedModel?: string; transport?: string };
function connectionIssue(error: unknown): string {
  const value = error as { name?: string; code?: string; cause?: { code?: string } } | null;
  if (value?.name === 'TimeoutError' || value?.name === 'AbortError') return 'La comprobación de la pestaña no terminó a tiempo o fue cancelada. Esto no significa que hayas cerrado sesión. Volvé a comprobar conexiones.';
  if (value?.cause?.code === 'ECONNREFUSED' || value?.code === 'ECONNREFUSED') return 'El puente local no está respondiendo. Iniciá el puente de pestaña y volvé a comprobar conexiones.';
  return 'No se pudo comprobar el puente local. Revisá su configuración y volvé a comprobar conexiones; no hace falta iniciar sesión otra vez.';
}
function tabIssue(state: BridgeState | null): string | undefined {
  if (!state) return;
  if (state.status === 'model-not-selected' || state.status === 'ready' && !/\bargon\b/i.test(state.observedModel ?? '')) {
    const model = (state.observedModel ?? '').replace(/\s+Abrir selector.*$/i, '').slice(0, 100).trim();
    return `La pestaña está conectada${model ? `, pero tiene seleccionado ${model}` : ', pero no se pudo identificar Argon'}. Elegí Argon en esa misma pestaña de Gemini y volvé a comprobar conexiones. Si no aparece allí, no está disponible para este conector. No hace falta iniciar sesión otra vez.`;
  }
  if (state.status === 'quota-limited') return 'La pestaña está conectada, pero Gemini informó un límite de uso. No se cambió a otro modelo.';
  if (state.status === 'busy') return 'La pestaña está conectada y Gemini está respondiendo. Esperá a que termine y volvé a comprobar conexiones.';
  if (state.status === 'dialog-open') return 'La pestaña está conectada, pero hay un diálogo abierto en Gemini. Cerralo y volvé a comprobar conexiones.';
  if (state.status === 'page-not-ready') return 'La pestaña está conectada, pero Gemini todavía no muestra el cuadro de mensaje. Revisá esa pestaña y volvé a comprobar conexiones.';
  if (state.status === 'wrong-page') return 'La pestaña conectada ya no está en Gemini. Volvé a Gemini y conectá esa pestaña desde la extensión.';
  if (state.status === 'browser-unavailable') return 'El puente está funcionando, pero la pestaña no respondió a la comprobación. Abrí esa pestaña y volvé a comprobar conexiones. No hace falta iniciar sesión otra vez.';
}

/** Separate product connector; OpenCode is a temporary, isolated agent transport. */
export function geminiWebHarness(profilesRoot: string): Harness {
  const profileDir = join(profilesRoot, 'gemini-web');
  let delegate: AcpHarness | undefined;
  const installation = async (): Promise<Installation> => {
    const value = JSON.parse(await readFile(join(profilesRoot, '..', 'gemini-web.json'), 'utf8'));
    if (typeof value.bridgeRoot !== 'string' || !isAbsolute(value.bridgeRoot)
      || value.command !== undefined && (typeof value.command !== 'string' || !isAbsolute(value.command) || /\.(cmd|bat|ps1)$/i.test(value.command))
      || value.transport !== undefined && !['cdp', 'extension'].includes(value.transport)
      || value.port !== undefined && (!Number.isInteger(value.port) || value.port < 1024 || value.port > 65535)) throw Error('Configuración del puente inválida.');
    return value;
  };
  const health = async (config: Installation, signal?: AbortSignal) => {
    const key = (await readFile(join(config.bridgeRoot, 'Datos', 'bridge.key'), 'utf8')).trim();
    const port = config.port ?? (config.transport === 'extension' ? 28183 : 28181);
    // The bridge itself gives the extension 5s to answer inspect. Do not time out first.
    const response = await fetch(`http://127.0.0.1:${port}/health`, { headers: { authorization: `Bearer ${key}` }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000), redirect: 'error' });
    if (!response.ok) throw Error('El puente no autorizó la conexión.');
    const value = await response.json() as BridgeState;
    if (value.service !== 'syka-gemini-web-bridge') throw Error('Servicio local incorrecto.');
    if (config.transport === 'extension' && value.transport !== 'extension') throw Error('El servicio local no es el puente de pestaña seleccionado.');
    return value;
  };
  return {
    id: 'gemini-web', codeGraphTools: true,
    async probe(env, signal): Promise<HarnessInfo> {
      delegate = undefined;
      let config: Installation;
      try { config = await installation(); }
      catch { return { ...base, status: 'not-installed', detail: 'Puente experimental todavía no configurado en este equipo.' }; }
      const authMethods = [{ id: 'browser', label: config.transport === 'extension' ? 'Conectar pestaña de Gemini' : 'Abrir Gemini Web' }];
      let bridgeReady = false;
      try {
        const state = await health(config, signal);
        if (state.status === 'authentication-blocked') return { ...base, authMethods: [], status: 'error', detail: AUTH_BLOCKED };
        const issue = config.transport === 'extension' ? tabIssue(state) : undefined;
        if (issue) return { ...base, authMethods: [{ id: 'browser', label: 'Comprobar pestaña' }], status: 'error', detail: issue };
        if (state.status !== 'ready' || !/\bargon\b/i.test(state.observedModel ?? '')) return { ...base, authMethods, status: 'signed-out', detail: config.transport === 'extension' ? TAB_HELP + ' Dejá Argon seleccionado.' : 'Iniciá sesión y seleccioná Argon en el navegador del puente.' };
        bridgeReady = true;
        const route = config.command ? { command: config.command } : await findOpenCode(env, profilesRoot);
        if (!route || !(await stat(route.command)).isFile()) return { ...base, status: 'not-installed', detail: 'Falta el componente de ejecución del conector experimental.' };
        delegate = new AcpHarness({ id: 'gemini-web', command: route.command, args: ['acp'], profileDir, openCodeAccount: 'syka', openCodeConfigDir: join(profileDir, 'config', 'opencode') });
        const info = await delegate.probe(env, signal);
        const model = info.models.find(m => m.id === ROUTE);
        if (info.status !== 'ready' || !model) return { ...base, authMethods, status: 'error', detail: 'El puente responde, pero su componente de ejecución no anunció Argon.' };
        return { ...base, authMethods, status: 'ready', version: info.version, defaultModel: 'web-argon', models: [{ ...model, id: 'web-argon', label: 'Argon · Experimental' }], detail: 'Conexión experimental con Gemini Web. La identidad interna del modelo y la estabilidad no están certificadas.' };
      } catch (error) { return { ...base, authMethods, status: 'error', detail: bridgeReady
        ? 'La pestaña de Gemini está conectada, pero falló el componente de ejecución ACP. Volvé a comprobar conexiones; no hace falta reconectar la pestaña ni iniciar sesión.'
        : connectionIssue(error) }; }
    },
    async authenticate(_env, method, signal, hooks) {
      if (method !== 'browser') throw Error('Método de conexión no compatible.');
      const config = await installation();
      const current = await health(config, signal).catch(() => null);
      if (current?.status === 'authentication-blocked') throw Error(AUTH_BLOCKED);
      if (config.transport === 'extension') {
        const issue = tabIssue(current);
        if (issue) throw Error(issue);
        if (current?.status === 'ready' && /\bargon\b/i.test(current.observedModel ?? '')) return;
      }
      const node = join(config.bridgeRoot, 'Herramientas', 'node-v24.14.1-win-x64', 'node.exe');
      const launcher = join(config.bridgeRoot, config.transport === 'extension' ? 'launch-tab-bridge.mjs' : 'launch.mjs');
      if (!(await stat(node)).isFile() || !(await stat(launcher)).isFile()) throw Error('La instalación del puente está incompleta.');
      const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
      await new Promise<void>((resolve, reject) => {
        const child = spawn(node, [launcher], { cwd: config.bridgeRoot, env, windowsHide: true, stdio: 'ignore', shell: false, signal });
        child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(Error(config.transport === 'extension' ? 'No se pudo iniciar el puente local de pestaña.' : 'No se pudo iniciar el navegador del puente.')));
      });
      hooks?.update({ phase: 'waiting', message: config.transport === 'extension' ? TAB_HELP : 'Completá el inicio de sesión y seleccioná Argon en el navegador del puente.' });
      const deadline = Date.now() + 180000;
      while (!signal.aborted && Date.now() < deadline) {
        const state = await health(config, signal).catch(() => null);
        if (state?.status === 'authentication-blocked') throw Error(AUTH_BLOCKED);
        const issue = config.transport === 'extension' ? tabIssue(state) : undefined;
        if (issue) throw Error(issue);
        if (state?.status === 'ready' && /\bargon\b/i.test(state.observedModel ?? '')) return;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw Error('La conexión no se completó. Podés volver a comprobarla.');
    },
    async open(options) {
      if (!delegate || options.model !== 'web-argon') throw Error('Comprobá Gemini Web antes de enviar.');
      const session = await delegate.open({ ...options, model: ROUTE });
      return {
        get resume() { return session.resume; }, get isClosed() { return session.isClosed; },
        async send(text, model, emit, effort, fast) {
          if (model !== 'web-argon' || effort || fast) return { status: 'failed', error: 'Opción no disponible en Gemini Web experimental.' };
          const state = await health(await installation()).catch(() => null);
          if (state?.status === 'authentication-blocked') return { status: 'failed', error: AUTH_BLOCKED };
          if (state?.status !== 'ready' || !/\bargon\b/i.test(state.observedModel ?? '')) return { status: 'failed', error: 'Gemini Web no tiene Argon seleccionado. No se cambió de modelo.' };
          return session.send(text, ROUTE, emit);
        },
        respond: (id, response) => session.respond(id, response), interrupt: () => session.interrupt(), close: () => session.close(),
      };
    },
  };
}
