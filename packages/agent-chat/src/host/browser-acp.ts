import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import { AcpHarness, acpEnvironment, type AcpHarnessConfig } from './acp';
import { which, type HostEnv } from './env';
import { runCliLogin } from './cli-login';
import { cursorRuntimeLaunch } from './provider-components';
import type { Harness, OpenOptions } from './harness';
import { HARNESS_LABELS, type HarnessInfo } from '../protocol';

/** Official browser login plus ACP, using one consistent provider-owned account. */
export function browserAcpHarness(id: 'grok' | 'cursor', profilesRoot: string, explicit?: { command: string; args?: string[] }): Harness {
  let delegate: AcpHarness | undefined, config: AcpHarnessConfig | undefined;
  let loginPrefix: string[] = [];
  const methodId = id === 'cursor' ? 'cursor-browser' : 'grok-browser';
  const authMethods = [{ id: methodId, label: `Iniciar sesión con ${HARNESS_LABELS[id]}` }];
  return {
    id,
    async probe(env, signal): Promise<HarnessInfo> {
      config = undefined; delegate = undefined; loginPrefix = [];
      const override = Object.entries(env.env).find(([key]) => key.toUpperCase() === `SYKA_${id.toUpperCase()}_PATH`)?.[1];
      const command = explicit?.command ?? override ?? (id === 'cursor' ? which('cursor-agent', env) ?? which('agent', env) : which('grok', env));
      if (!command || /\.(cmd|bat|ps1)$/i.test(command)) return { id, label: HARNESS_LABELS[id], status: 'not-installed', models: [], authMethods, detail: 'Conectá tu cuenta para preparar el componente oficial en este equipo.' };
      let runtime = id === 'cursor' && !explicit?.args?.length ? await cursorRuntimeLaunch(command) : undefined;
      if (id === 'cursor' && explicit?.args?.[0] && (explicit.args.length === 1 || explicit.args.length === 2 && explicit.args[1] === 'acp')) {
        const candidate = await cursorRuntimeLaunch(explicit.args[0]);
        if (candidate?.command === command) runtime = candidate;
      }
      if (id === 'cursor' && /\.(?:mjs|cjs|js)$/i.test(command) && !runtime) return { id, label: HARNESS_LABELS[id], status: 'not-installed', models: [], authMethods, detail: 'La ruta de Cursor no incluye su runtime oficial completo. Revisá el componente de conexión.' };
      // Never turn an arbitrary JS/runtime entrypoint into a different CLI invocation.
      if (!runtime && explicit?.args?.length && !/^(?:grok|agent|cursor-agent)(?:\.exe)?$/i.test(basename(command))) {
        delegate = new AcpHarness({ ...explicit, id, command, profileDir: join(profilesRoot, id) });
        return delegate.probe(env, signal);
      }
      loginPrefix = runtime?.args ?? [];
      config = { id, command: runtime?.command ?? command, args: runtime ? [...runtime.args, 'acp'] : explicit?.args ?? (id === 'cursor' ? ['acp'] : ['agent', 'stdio']), profileDir: join(profilesRoot, id), installedSession: { userHome: env.env.USERPROFILE ?? env.env.HOME ?? homedir(), appData: env.env.APPDATA, localAppData: env.env.LOCALAPPDATA } };
      delegate = new AcpHarness(config);
      const info = await delegate.probe(env, signal);
      return { ...info, authMethods };
    },
    async authenticate(env: HostEnv, selected, signal, hooks) {
      if (selected !== methodId) { if (!delegate?.authenticate) throw Error('Método de conexión no disponible.'); return delegate.authenticate(env, selected, signal, hooks); }
      if (!config || !delegate) throw Error('Comprobá el componente de conexión antes de iniciar sesión.');
      const loginEnv = { ...acpEnvironment(config.profileDir, env.env, config.installedSession), ...(id === 'cursor' ? { NO_OPEN_BROWSER: '1' } : {}) };
      await runCliLogin({ provider: id, command: config.command, args: [...loginPrefix, 'login'], cwd: config.profileDir, env: loginEnv, signal, hooks });
      if ((await delegate.probe(env, signal)).status !== 'ready') throw Error('El proveedor no confirmó una sesión disponible después del login.');
    },
    async open(options: OpenOptions) { if (!delegate) throw Error('Conectá este proveedor antes de iniciar el chat.'); return delegate.open(options); },
  };
}
