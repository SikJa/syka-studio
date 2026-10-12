import { execFile } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { AcpHarnessConfig } from './acp';
import type { HostEnv } from './env';
import type { AuthHooks } from './harness';
import type { HarnessInfo } from '../protocol';
import { acpEnvironment } from './acp';
import { runCliLogin } from './cli-login';

export const HERMES_LOGIN_METHODS = [
  { id: 'hermes-nous-device', label: 'Nous Portal · login con código' },
  { id: 'hermes-chatgpt-device', label: 'ChatGPT / Codex · login con código' },
] as const;

/** Calls the installed official OAuth implementation; no prompts/model-config writes. */
export const HERMES_LOGIN_BRIDGE = String.raw`
try:
    import hermes_bootstrap
    hermes_bootstrap.harden_import_path()
except ModuleNotFoundError:
    pass

import contextlib
import io
import json
import re
import sys
import time
from hermes_cli import auth

METHODS = {'hermes-nous-device': 'nous', 'hermes-chatgpt-device': 'openai-codex'}


def capabilities():
    shared = all(callable(getattr(auth, name, None)) for name in ('_auth_store_lock', '_load_auth_store', '_save_auth_store', '_store_provider_state'))
    methods = []
    if shared and all(callable(getattr(auth, name, None)) for name in ('_nous_device_code_login', '_nous_invoke_jwt_status')):
        methods.append('hermes-nous-device')
    if shared and all(callable(getattr(auth, name, None)) for name in ('_codex_device_code_login', '_sync_codex_pool_entries', '_decode_jwt_claims')):
        methods.append('hermes-chatgpt-device')
    return methods


def local_status(provider):
    # Never use get_codex_auth_status/resolve_* here: they can refresh or import
    # credentials from another app/profile. Read only this Hermes auth store.
    store = auth._load_auth_store()
    state = (store.get('providers') or {}).get(provider) or {}
    if provider == 'nous':
        return auth._nous_invoke_jwt_status(state.get('access_token'), scope=state.get('scope'), expires_at=state.get('expires_at')) is None
    if provider == 'openai-codex':
        candidates = [(state.get('tokens') or {}).get('access_token')]
        for entry in (store.get('credential_pool') or {}).get(provider) or []:
            if isinstance(entry, dict):
                candidates.append(entry.get('access_token'))
        for token in candidates:
            if not isinstance(token, str) or not token:
                continue
            expiry = auth._decode_jwt_claims(token).get('exp')
            if isinstance(expiry, (int, float)) and expiry > time.time() + 60:
                return True
    return False


def verification(url, code):
    # Only the official function supplies these ephemeral values. No tokens,
    # account identifiers or raw auth responses ever cross the subprocess wire.
    sys.__stdout__.write('Open: ' + str(url) + '\nUser code: ' + str(code) + '\n')
    sys.__stdout__.flush()


class CodexVerificationOutput(io.TextIOBase):
    def __init__(self):
        self.buffer = ''
        self.emitted = False

    def write(self, text):
        self.buffer = (self.buffer + text)[-65536:]
        clean = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', self.buffer)
        url = re.search(r'https://auth\.openai\.com/codex/device\b', clean)
        code = re.search(r'Enter this code:\s*([A-Z0-9]{3,8}-[A-Z0-9]{3,8})\b', clean)
        if url and code and not self.emitted:
            self.emitted = True
            verification(url.group(0), code.group(1))
        return len(text)


def save_fresh(provider, fresh):
    # Provider-owned atomic save; retain existing selected provider/model and
    # independent pooled accounts. Do not mirror into Codex or other profiles.
    with auth._auth_store_lock():
        store = auth._load_auth_store()
        if provider == 'openai-codex':
            state = dict((store.get('providers') or {}).get(provider) or {})
            previous = state.get('tokens') if isinstance(state.get('tokens'), dict) else None
            state.update(tokens=fresh['tokens'], last_refresh=fresh.get('last_refresh'), auth_mode='chatgpt')
            auth._store_provider_state(store, provider, state, set_active=not bool(store.get('active_provider')))
            auth._sync_codex_pool_entries(store, fresh['tokens'], fresh.get('last_refresh'), previous_singleton_tokens=previous)
        else:
            auth._store_provider_state(store, provider, fresh, set_active=not bool(store.get('active_provider')))
        auth._save_auth_store(store)


def login(method):
    if method not in capabilities():
        raise ValueError('This Hermes version does not provide the selected login')
    provider = METHODS[method]
    if local_status(provider):
        print('Existing Hermes session verified', flush=True)
        return
    if provider == 'nous':
        registry = auth.PROVIDER_REGISTRY[provider]
        # Suppress the native informational portal URL, which is not the login
        # link. The verification callback emits only the actual device URL/code.
        with contextlib.redirect_stdout(io.StringIO()):
            fresh = auth._nous_device_code_login(portal_base_url=registry.portal_base_url, inference_base_url=registry.inference_base_url, open_browser=False, on_verification=verification)
    else:
        with contextlib.redirect_stdout(CodexVerificationOutput()):
            fresh = auth._codex_device_code_login()
    save_fresh(provider, fresh)
    if not local_status(provider):
        raise ValueError('Hermes did not persist a valid session for the selected provider')
    print('Hermes session verified', flush=True)


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else ''
    if action == '--capabilities':
        print(json.dumps({'methods': capabilities()}), flush=True)
        return
    method = sys.argv[2] if len(sys.argv) > 2 else ''
    if method not in METHODS:
        raise ValueError('Invalid Hermes login method')
    if action == '--status':
        print(json.dumps({'loggedIn': local_status(METHODS[method])}), flush=True)
    elif action == '--login':
        from acp_adapter.entry import _setup_logging
        _setup_logging()
        login(method)
    else:
        raise ValueError('Invalid Hermes login action')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # The host shows retry/cancel; never serialize an auth exception that
        # may contain a request body, access token or profile's credentials.
        print('Hermes could not complete the selected authorization', file=sys.stderr, flush=True)
        raise SystemExit(1)
`;

type Launch = { command: string; script: string; env: Record<string, string>; cwd: string };
async function prepare(config: AcpHarnessConfig, env: HostEnv): Promise<Launch | undefined> {
  if (config.id !== 'hermes') return undefined;
  const binary = basename(config.command).toLowerCase();
  if (!(binary === 'hermes-acp.exe' || binary === 'hermes-acp') || config.args?.length) return undefined;
  const command = join(dirname(config.command), process.platform === 'win32' ? 'python.exe' : 'python');
  if (!await stat(command).then(info => info.isFile()).catch(() => false)) return undefined;
  await mkdir(config.profileDir, { recursive: true });
  const script = join(config.profileDir, 'syka-hermes-login-v1.py');
  if (await readFile(script, 'utf8').catch(() => '') !== HERMES_LOGIN_BRIDGE) await writeFile(script, HERMES_LOGIN_BRIDGE, 'utf8');
  return { command, script, cwd: config.profileDir, env: { ...acpEnvironment(config.profileDir, env.env, config.installedSession), PYTHONDONTWRITEBYTECODE: '1', PYTHONUNBUFFERED: '1' } };
}
function read(launch: Launch, args: string[], signal?: AbortSignal): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => execFile(launch.command, ['-B', '-u', launch.script, ...args], { cwd: launch.cwd, env: launch.env, encoding: 'utf8', windowsHide: true, timeout: 10_000, maxBuffer: 32 * 1024, signal }, (error, stdout) => {
    if (error) return reject(Error('No se pudo comprobar la conexión de Hermes.'));
    try { resolve(JSON.parse(stdout.trim())); } catch { reject(Error('Hermes no devolvió un estado de conexión válido.')); }
  }));
}

export async function hermesAuthMethods(config: AcpHarnessConfig, env: HostEnv, signal?: AbortSignal): Promise<NonNullable<HarnessInfo['authMethods']>> {
  const launch = await prepare(config, env);
  if (!launch || signal?.aborted) return [];
  const result = await read(launch, ['--capabilities'], signal).catch(() => undefined);
  return HERMES_LOGIN_METHODS.filter(method => Array.isArray(result?.methods) && result.methods.includes(method.id)).map(method => ({ ...method }));
}

export async function authenticateHermes(config: AcpHarnessConfig, env: HostEnv, methodId: string, signal: AbortSignal, hooks?: AuthHooks): Promise<boolean> {
  const launch = await prepare(config, env);
  if (!launch || !HERMES_LOGIN_METHODS.some(method => method.id === methodId)) throw Error('Ese método de conexión no está disponible para esta instalación de Hermes.');
  if (!(await hermesAuthMethods(config, env, signal)).some(method => method.id === methodId)) throw Error('Actualizá el componente de Hermes para conectar esa cuenta.');
  const verify = async () => (await read(launch, ['--status', methodId], signal)).loggedIn === true;
  if (await verify()) { hooks?.update({ phase: 'verifying', message: 'La sesión existente de Hermes está conectada.' }); return false; }
  hooks?.update({ phase: 'preparing', message: 'Preparando el enlace oficial para conectar Hermes…' });
  // These official device flows do not require a TUI or command entry. Keep
  // credentials in Python/Hermes, surface only the provider URL and user code.
  await runCliLogin({ provider: 'hermes', command: launch.command, args: ['-B', '-u', launch.script, '--login', methodId], cwd: launch.cwd, env: launch.env, signal, hooks, verify, timeoutMs: 15 * 60_000 });
  if (!await verify()) throw Error('Hermes no confirmó la sesión de la cuenta elegida.');
  return true;
}
