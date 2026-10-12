import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import type { AcpHarnessConfig } from '../src/host/acp';
import type { AuthHooks } from '../src/host/harness';
import type { HostEnv } from '../src/host/env';

const mocks = vi.hoisted(() => ({ execFile: vi.fn(), runCliLogin: vi.fn() }));
vi.mock('node:child_process', async importOriginal => ({ ...await importOriginal<typeof import('node:child_process')>(), execFile: mocks.execFile }));
vi.mock('../src/host/cli-login', () => ({ runCliLogin: mocks.runCliLogin }));

import { authenticateHermes, hermesAuthMethods, HERMES_LOGIN_BRIDGE, HERMES_LOGIN_METHODS } from '../src/host/hermes-login';

const roots: string[] = [];
let ready: boolean, nativeMethods: string[];
const signal = () => new AbortController().signal;
const env: HostEnv = { env: { PATH: 'fixture-path', SYSTEMROOT: 'C:\\Windows', OPENAI_API_KEY: 'fixture-key-must-be-filtered', NODE_OPTIONS: 'fixture-unsafe' }, extraDirs: [] };

async function setup(): Promise<AcpHarnessConfig> {
  const root = await mkdtemp(join(tmpdir(), 'syka-hermes-login-test-')); roots.push(root);
  const installation = join(root, 'installed'), profileDir = join(root, 'syka-profile');
  await mkdir(installation);
  await writeFile(join(installation, process.platform === 'win32' ? 'python.exe' : 'python'), 'fixture executable never executed');
  return { id: 'hermes', command: join(installation, process.platform === 'win32' ? 'hermes-acp.exe' : 'hermes-acp'), profileDir };
}

beforeEach(() => {
  ready = false; nativeMethods = HERMES_LOGIN_METHODS.map(method => method.id);
  mocks.execFile.mockReset().mockImplementation((_command, args, _options, callback) => {
    const response = args.includes('--capabilities') ? { methods: nativeMethods } : { loggedIn: ready };
    callback(null, JSON.stringify(response), '');
    return {};
  });
  mocks.runCliLogin.mockReset().mockImplementation(async options => { ready = true; expect(await options.verify()).toBe(true); });
});
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !root.includes('syka-hermes-login-test-')) throw Error('Invalid cleanup');
    await rm(root, { recursive: true, force: true });
  }
});

describe('Hermes official device login', () => {
  it('discovers native capabilities without reading account status or launching authorization', async () => {
    const config = await setup();
    expect(await hermesAuthMethods(config, env, signal())).toEqual(HERMES_LOGIN_METHODS);
    expect(mocks.execFile).toHaveBeenCalledTimes(1);
    expect(mocks.execFile.mock.calls[0]?.[1]).toContain('--capabilities');
    expect(mocks.execFile.mock.calls[0]?.[1]).not.toContain('--status');
    expect(mocks.runCliLogin).not.toHaveBeenCalled();
    expect(await readFile(join(config.profileDir, 'syka-hermes-login-v1.py'), 'utf8')).toBe(HERMES_LOGIN_BRIDGE);
  });

  it('hides a method missing in the installed API and keeps custom ACP launchers untouched', async () => {
    const config = await setup(); nativeMethods = ['hermes-chatgpt-device'];
    expect(await hermesAuthMethods(config, env, signal())).toEqual([HERMES_LOGIN_METHODS[1]]);
    expect(await hermesAuthMethods({ ...config, command: process.execPath }, env, signal())).toEqual([]);
    expect(await hermesAuthMethods({ ...config, args: ['--custom'] }, env, signal())).toEqual([]);
    expect(mocks.execFile).toHaveBeenCalledTimes(1);
  });

  it('reuses a verified existing account without starting login or rotating its profile', async () => {
    const config = await setup(); ready = true;
    const hooks: AuthHooks = { update: vi.fn(), requestCode: vi.fn() };
    expect(await authenticateHermes(config, env, 'hermes-nous-device', signal(), hooks)).toBe(false);
    expect(mocks.runCliLogin).not.toHaveBeenCalled();
    expect(hooks.update).toHaveBeenCalledWith(expect.objectContaining({ phase: 'verifying' }));
    expect(mocks.execFile.mock.calls.at(-1)?.[1]).toEqual(expect.arrayContaining(['--status', 'hermes-nous-device']));
  });

  it('runs the chosen provider device flow in the proper isolated Hermes profile', async () => {
    const config = await setup(), loginSignal = signal();
    const hooks: AuthHooks = { update: vi.fn(), requestCode: vi.fn() };
    expect(await authenticateHermes(config, env, 'hermes-chatgpt-device', loginSignal, hooks)).toBe(true);
    const login = mocks.runCliLogin.mock.calls[0]?.[0];
    expect(login).toMatchObject({ provider: 'hermes', cwd: config.profileDir, signal: loginSignal, hooks, timeoutMs: 900000 });
    expect(login.args).toEqual(['-B', '-u', join(config.profileDir, 'syka-hermes-login-v1.py'), '--login', 'hermes-chatgpt-device']);
    expect(login.env.HERMES_HOME).toBe(join(config.profileDir, 'hermes'));
    expect(login.env.PYTHONDONTWRITEBYTECODE).toBe('1');
    expect(login.env.OPENAI_API_KEY).toBeUndefined();
    expect(login.env.NODE_OPTIONS).toBeUndefined();
    expect(login.terminal).toBeUndefined();
    expect(hooks.requestCode).not.toHaveBeenCalled();
  });

  it('reuses an explicitly discovered installed profile by path without copying its account', async () => {
    const config = await setup();
    const userHome = join(config.profileDir, 'fixture-user-home'), hermesHome = join(userHome, '.hermes');
    expect(await authenticateHermes({ ...config, installedSession: { userHome, hermesHome } }, env, 'hermes-nous-device', signal())).toBe(true);
    const login = mocks.runCliLogin.mock.calls[0]?.[0];
    expect(login.env.HERMES_HOME).toBe(hermesHome);
    expect(login.env.HOME).toBe(userHome);
    expect(login.env.TEMP).toBe(join(config.profileDir, 'tmp'));
    expect(login.args).not.toContain('setup');
    expect(login.args).not.toContain('model');
  });

  it('requires the selected provider to persist a valid account after the device flow', async () => {
    const config = await setup(); mocks.runCliLogin.mockResolvedValue(undefined);
    await expect(authenticateHermes(config, env, 'hermes-nous-device', signal())).rejects.toThrow('no confirmó');
    expect(mocks.runCliLogin).toHaveBeenCalledTimes(1);
  });

  it('rejects an unsupported method before starting a login subprocess', async () => {
    const config = await setup(); nativeMethods = [];
    await expect(authenticateHermes(config, env, 'hermes-nous-device', signal())).rejects.toThrow('Actualizá');
    await expect(authenticateHermes(config, env, 'unknown-method', signal())).rejects.toThrow('no está disponible');
    expect(mocks.runCliLogin).not.toHaveBeenCalled();
  });

  it('does not expose a native error containing account data', async () => {
    const config = await setup();
    mocks.execFile.mockImplementation((_command, _args, _options, callback) => { callback(Error('fixture-token-must-not-escape'), '', 'fixture-private-state'); return {}; });
    expect(await hermesAuthMethods(config, env, signal())).toEqual([]);
    await expect(authenticateHermes(config, env, 'hermes-nous-device', signal())).rejects.toThrow('Actualizá');
    expect(mocks.runCliLogin).not.toHaveBeenCalled();
  });
});
