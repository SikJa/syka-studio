import { readFile, stat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, basename } from 'node:path';
import { AcpHarness, type AcpHarnessConfig } from './acp';
import { which, type HostEnv } from './env';
import type { Harness, OpenOptions } from './harness';
import { HARNESS_LABELS } from '../protocol';
import { AntigravityCliHarness } from './antigravity-cli';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Modern Hermes publishes its runtime command; do not hardcode its Python version. */
export async function hermesRuntimeCommand(binary: string, env: HostEnv): Promise<string[] | undefined> {
  if (!isAbsolute(binary) || /\.(cmd|bat|ps1)$/i.test(binary)) return;
  try {
    const { stdout } = await execFileAsync(binary, ['--print-runtime-command', '--module', 'acp_adapter.entry'], {
      env: env.env, windowsHide: true, timeout: 10_000, maxBuffer: 64 * 1024,
    });
    const command: unknown = JSON.parse(stdout.trim());
    if (Array.isArray(command) && command.length > 0 && command.length < 64 && command.every(arg => typeof arg === 'string')
      && isAbsolute(command[0]) && !/\.(cmd|bat|ps1)$/i.test(command[0]) && await file(command[0])) return command;
  } catch { /* Older releases use a standalone ACP executable or `hermes acp`. */ }
}

const file = (path: string) => stat(path).then(s => s.isFile()).catch(() => false);
/** Follow the profile selected by the official Hermes CLI without changing it. */
export async function installedHermesHome(env: Record<string, string>, userHome: string, binary?: string | null): Promise<string | undefined> {
  const candidates = [env.SYKA_HERMES_HOME ?? env.HERMES_HOME,
    binary ? dirname(dirname(binary)) : undefined,
    env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'hermes') : undefined, join(userHome, '.hermes')];
  for (const root of candidates) {
    if (!root || !isAbsolute(root)) continue;
    if (basename(dirname(root)) === 'profiles' && await file(join(root, 'config.yaml'))) return realpath(root);
    let active = '';
    try { active = (await readFile(join(root, 'active_profile'), 'utf8')).trim(); } catch { /* Default profile. */ }
    if (active && active !== 'default') {
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(active)) throw Error('Perfil activo de Hermes inválido.');
      const selected = join(root, 'profiles', active);
      if (!await file(join(selected, 'config.yaml'))) throw Error('No se encontró el perfil activo de Hermes.');
      return realpath(selected);
    }
    if (await file(join(root, 'config.yaml'))) return realpath(root);
  }
}

/** Paths are resolved at probe time so a newly installed agent is discovered. */
export async function discoverInstalledAcp(id: 'hermes' | 'antigravity', profilesRoot: string, env: HostEnv): Promise<AcpHarness | undefined> {
  const userHome = env.env.USERPROFILE ?? env.env.HOME ?? homedir();
  const installedSession: NonNullable<AcpHarnessConfig['installedSession']> = { userHome, appData: env.env.APPDATA, localAppData: env.env.LOCALAPPDATA };
  let command: string | null | undefined;
  let args: string[] = [];
  let sharedRuntime = false;
  if (id === 'hermes') {
    const home = env.env.SYKA_HERMES_HOME ?? env.env.HERMES_HOME;
    const binary = env.env.SYKA_HERMES_PATH ?? which('hermes', { ...env, extraDirs: [...env.extraDirs, ...(home ? [join(home, 'bin')] : [])] });
    const hermesHome = await installedHermesHome(env.env, userHome, binary);
    if (!hermesHome) return undefined;
    installedSession.hermesHome = hermesHome;
    const acp = binary ? join(dirname(binary), process.platform === 'win32' ? 'hermes-acp.exe' : 'hermes-acp') : '';
    const standard = env.env.LOCALAPPDATA ? join(env.env.LOCALAPPDATA, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes-acp.exe') : '';
    const runtime = binary ? await hermesRuntimeCommand(binary, env) : undefined;
    if (runtime) { command = runtime[0]; args = runtime.slice(1); sharedRuntime = true; }
    else if (acp && await file(acp)) command = acp;
    else if (standard && await file(standard)) command = standard;
    else {
      const standalone = which('hermes-acp', env);
      if (standalone && !/\.(cmd|bat|ps1)$/i.test(standalone)) command = standalone;
      else { command = binary; args = ['acp']; }
    }
  } else {
    const prepared = join(profilesRoot, '..', 'providers', 'antigravity', process.platform === 'win32' ? 'agy_acp_server.exe' : 'agy_acp_server.par');
    command = await file(prepared) ? prepared : which('agy_acp_server', env);
  }
  if (!command || !isAbsolute(command) || /\.(cmd|bat|ps1)$/i.test(command) || !await file(command)) return undefined;
  // Changing the installed profile must not resume a conversation under another account.
  const identity = createHash('sha256').update(installedSession.hermesHome ?? userHome).digest('hex').slice(0, 16);
  return new AcpHarness({ id, command: await realpath(command), args, sharedRuntime, profileDir: join(profilesRoot, id, identity), installedSession });
}

export function installedAcpHarness(id: 'hermes' | 'antigravity', profilesRoot: string): Harness {
  let delegate: Harness | undefined;
  return { id,
    async probe(env, signal) {
      try {
        const agy = id === 'antigravity' ? join(profilesRoot, '..', 'providers', 'antigravity-cli', process.platform === 'win32' ? 'agy.exe' : 'agy') : '';
        const installed = id === 'antigravity' ? which('agy', env) : undefined;
        delegate = agy && await file(agy) ? new AntigravityCliHarness({command:agy,profileDir:join(profilesRoot,'antigravity-cli')})
          : installed && await file(installed) ? new AntigravityCliHarness({command:installed,profileDir:join(profilesRoot,'antigravity-cli')})
          : await discoverInstalledAcp(id, profilesRoot, env);
      }
      catch { return { id, label: HARNESS_LABELS[id], status: 'error', models: [], detail: 'Encontramos la instalación, pero su perfil necesita revisión. No se modificó tu cuenta.' }; }
      if (delegate) return delegate.probe(env, signal);
      return { id, label: HARNESS_LABELS[id], status: 'not-installed', models: [], detail: id === 'hermes' ? 'No encontramos Hermes con un perfil configurado en este equipo.' : 'Falta el componente de conexión oficial de Antigravity. Instalar la aplicación visual no prepara esta conexión.' };
    },
    async authenticate(env, methodId, signal, hooks) {
      if (!delegate) throw Error('Comprobá la instalación antes de conectar.');
      if (!delegate.authenticate) throw Error('Usá la sesión oficial de Antigravity CLI y después comprobá la conexión.');
      return delegate.authenticate(env, methodId, signal, hooks);
    },
    async open(options: OpenOptions) {
      if (!delegate) throw Error('El asistente instalado todavía no está disponible.');
      if (id === 'antigravity' && options.resume && 'acp' in options.resume) {
        const legacy = await discoverInstalledAcp(id, profilesRoot, options.env);
        if (!legacy) throw Error('La conexión anterior no está instalada; conservamos el chat. Abrí uno nuevo.');
        return legacy.open(options);
      }
      return delegate.open(options);
    },
  };
}
