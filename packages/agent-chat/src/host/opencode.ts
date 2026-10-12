import { stat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';
import { AcpHarness } from './acp';
import { compareVersions, parseVersion, runOnce, type HostEnv } from './env';
import type { Harness, HarnessSession, OpenOptions } from './harness';
import { openCodeAuthMethods, authenticateOpenCode } from './opencode-login';

export type OpenCodeRoute = { command: string; args?: string[]; accountMode?: 'installed' | 'syka' };
const file = (path: string) => stat(path).then(value => value.isFile()).catch(() => false);
const variables = (env: Record<string, string>) => Object.fromEntries(Object.entries(env).map(([key, value]) => [key.toUpperCase(), value]));

/** Resolve native CLIs, including npm packages, without running shell shims or GUI apps. */
export async function findOpenCode(env: HostEnv, profilesRoot: string): Promise<OpenCodeRoute | undefined> {
  const source = variables(env.env), home = source.USERPROFILE ?? source.HOME ?? homedir();
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const candidates = [source.SYKA_OPENCODE_PATH,
    join(profilesRoot, '..', 'providers', 'opencode', 'node_modules', 'opencode-ai', 'bin', 'opencode' + suffix),
    ...[...(source.PATH ?? '').split(delimiter), ...env.extraDirs,
      ...(source.APPDATA ? [join(source.APPDATA, 'npm')] : []), join(home, '.local', 'bin'), join(home, '.opencode', 'bin')]
      .filter(Boolean).flatMap(dir => [join(dir, 'opencode' + suffix),
        join(dir, 'node_modules', 'opencode-ai', 'bin', 'opencode' + suffix),
        ...(process.platform === 'win32' ? [join(dir, 'node_modules', 'opencode-ai', 'node_modules', 'opencode-windows-x64-baseline', 'bin', 'opencode.exe'),
          join(dir, 'node_modules', 'opencode-ai', 'node_modules', `opencode-windows-${process.arch}`, 'bin', 'opencode.exe')] : [])]),
  ].filter((path): path is string => !!path);
  // A broken explicit override is reported; it never switches to another installation.
  for (const candidate of source.SYKA_OPENCODE_PATH ? candidates.slice(0, 1) : candidates) {
    if (!isAbsolute(candidate) || /\.(cmd|bat|ps1)$/i.test(candidate) || !await file(candidate)) continue;
    return { command: await realpath(candidate), args: ['acp'], accountMode: 'installed' };
  }
}

/** Official OpenCode owns authentication. Only profile paths cross into Syka. */
export function installedOpenCodeEnvironment(profile: string, source: Record<string, string>, accountMode: 'installed' | 'syka' = 'installed'): Record<string, string> {
  const original = variables(source), env: Record<string, string> = {};
  for (const key of ['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'LANG', 'LC_ALL']) if (original[key]) env[key] = original[key];
  const home = accountMode === 'installed' ? original.USERPROFILE ?? original.HOME ?? homedir() : profile;
  if (!isAbsolute(home)) throw Error('La carpeta de la cuenta de OpenCode debe ser absoluta.');
  const inheritedPath = (key: string, fallback: string) => accountMode === 'installed' && original[key] && isAbsolute(original[key]) ? original[key] : fallback;
  return { ...env, HOME: home, USERPROFILE: home,
    APPDATA: inheritedPath('APPDATA', join(home, 'AppData', 'Roaming')), LOCALAPPDATA: inheritedPath('LOCALAPPDATA', join(home, 'AppData', 'Local')),
    XDG_CONFIG_HOME: inheritedPath('XDG_CONFIG_HOME', accountMode === 'installed' ? join(home, '.config') : join(profile, 'config')),
    XDG_DATA_HOME: inheritedPath('XDG_DATA_HOME', accountMode === 'installed' ? join(home, '.local', 'share') : join(profile, 'data')),
    XDG_STATE_HOME: inheritedPath('XDG_STATE_HOME', accountMode === 'installed' ? join(home, '.local', 'state') : join(profile, 'state')),
    XDG_CACHE_HOME: join(profile, 'cache'), TEMP: join(profile, 'tmp'), TMP: join(profile, 'tmp'), TMPDIR: join(profile, 'tmp'),
    OPENCODE_CONFIG_DIR: join(profile, 'config', 'opencode'), OPENCODE_DISABLE_AUTOUPDATE: 'true', NO_COLOR: '1',
    ...(accountMode === 'installed' && original.OPENCODE_CONFIG && isAbsolute(original.OPENCODE_CONFIG) ? { OPENCODE_CONFIG: original.OPENCODE_CONFIG } : {}),
  };
}

/** Re-detect on refresh, preserve explicit routes, and never infer account access from a catalog. */
export function openCodeHarness(profilesRoot: string, explicit?: OpenCodeRoute): Harness {
  let delegate: AcpHarness | undefined;
  let login: { route: OpenCodeRoute; cwd: string; env: Record<string, string> } | undefined;
  return { id: 'opencode',
    async probe(env, signal) {
      delegate = undefined;
      const route = explicit ?? await findOpenCode(env, profilesRoot);
      const base = { id: 'opencode' as const, label: 'OpenCode', models: [] };
      if (!route) return { ...base, status: 'not-installed', detail: 'Usá Conectar OpenCode para preparar el componente oficial y obtener sus modelos. La app visual puede usar una instalación distinta.' };
      const profileEnv = installedOpenCodeEnvironment(join(profilesRoot, 'opencode'), env.env, route.accountMode);
      login = { route, cwd: join(profilesRoot, 'opencode', 'login'), env: profileEnv };
      const args = route.args?.length ? route.args : ['acp'];
      const prefix = args.filter(arg => arg !== 'acp');
      const version = parseVersion(await runOnce(route.command, [...prefix, '--version'], { env: profileEnv, extraDirs: [] }));
      if (signal.aborted) return { ...base, status: 'error', detail: 'Comprobación cancelada.' };
      if (!version) return { ...base, status: 'error', detail: 'La instalación no respondió como una CLI de OpenCode. Revisá el ejecutable.' };
      if (compareVersions(version, '1.18.0') < 0) return { ...base, version, status: 'error', detail: `OpenCode ${version} necesita una versión compatible. Usá Conectar OpenCode para preparar el componente actualizado.` };
      const account = createHash('sha256').update([profileEnv.HOME, profileEnv.XDG_CONFIG_HOME, profileEnv.XDG_DATA_HOME, profileEnv.OPENCODE_CONFIG ?? ''].join('\n')).digest('hex').slice(0, 16);
      const profileDir = join(profilesRoot, 'opencode', account);
      delegate = new AcpHarness({ id: 'opencode', command: route.command, args, profileDir, openCodeAccount: route.accountMode ?? 'installed', openCodeConfigDir: join(profilesRoot, 'opencode', 'config', 'opencode') });
      const info = await delegate.probe(env, signal);
      return { ...info, version, detail: info.status === 'ready' ? 'Instalación detectada. Se usa la cuenta configurada en OpenCode, incluidos sus modelos gratuitos. Go requiere una suscripción y Zen puede cobrar por uso. El acceso y la cuota se comprueban al enviar un mensaje.' : info.detail };
    },
    async authMethods(_env, signal) {
      if (!login) throw Error('Comprobá la instalación de OpenCode antes de ver sus conexiones.');
      return openCodeAuthMethods({ ...login, signal });
    },
    async authenticate(_env, methodId, signal, hooks) {
      if (!login) throw Error('Comprobá la instalación de OpenCode antes de conectar otra cuenta.');
      await authenticateOpenCode({ ...login, signal }, methodId, hooks);
    },
    async open(options: OpenOptions): Promise<HarnessSession> {
      if (!delegate) throw Error('Comprobá o actualizá la instalación de OpenCode antes de enviar.');
      return delegate.open(options);
    },
  };
}
