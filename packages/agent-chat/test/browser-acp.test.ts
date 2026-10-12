import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { browserAcpHarness } from '../src/host/browser-acp';
import type { AcpHarnessConfig } from '../src/host/acp';
import type { HostEnv } from '../src/host/env';
import type { OpenOptions } from '../src/host/harness';
import type { HarnessInfo } from '../src/protocol';

// Launcher-only verification: no provider process, browser, account or inference.
const state = vi.hoisted(() => ({ configs: [] as AcpHarnessConfig[], status: 'ready' as HarnessInfo['status'], probe: vi.fn(), authenticate: vi.fn(), open: vi.fn(), login: vi.fn(async () => {}) }));
vi.mock('../src/host/acp', async () => {
  const actual = await vi.importActual<typeof import('../src/host/acp')>('../src/host/acp');
  return { ...actual, AcpHarness: class {
    private config: AcpHarnessConfig;
    constructor(config: AcpHarnessConfig) { this.config = config; state.configs.push(config); }
    async probe(env: HostEnv, signal: AbortSignal) { state.probe(env, signal); return { id: this.config.id, label: this.config.id, status: state.status, models: [], authMethods: [{ id: 'custom-method', label: 'Custom route method' }] }; }
    async authenticate(...args: unknown[]) { return state.authenticate(...args); }
    async open(...args: unknown[]) { return state.open(...args); }
  } };
});
vi.mock('../src/host/cli-login', () => ({ runCliLogin: state.login }));
const roots: string[] = [];
beforeEach(() => { vi.clearAllMocks(); state.configs = []; state.status = 'ready'; });
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function setup() { const root = await mkdtemp(join(tmpdir(), 'syka-cursor-acp-')); roots.push(root); return root; }
function host(root: string): HostEnv { return { env: { PATH: root, USERPROFILE: join(root, 'account'), HOME: join(root, 'account'), APPDATA: join(root, 'account', 'Roaming'), LOCALAPPDATA: join(root, 'account', 'Local') }, extraDirs: [] }; }
async function official(root: string, location = 'versions/2026.10.01-e373342') {
  const entry = join(root, location, 'index.js'), command = join(dirname(entry), 'node.exe');
  await mkdir(dirname(entry), { recursive: true }); await writeFile(entry, 'Cursor fixture only'); await writeFile(command, 'Node fixture only');
  return { command, entry };
}

describe('official Cursor Node package ACP and browser login routes', () => {
  it('uses the managed entrypoint override for ACP and login with the same adjacent Node', async () => {
    const root = await setup(), runtime = await official(root), environment = host(root), signal = new AbortController().signal;
    await writeFile(join(root, 'agent.exe'), 'different installation'); environment.env.SYKA_CURSOR_PATH = runtime.entry;
    const harness = browserAcpHarness('cursor', join(root, 'profiles'));
    expect((await harness.probe(environment, signal)).authMethods).toEqual([{ id: 'cursor-browser', label: 'Iniciar sesión con Cursor' }]);
    expect(state.configs[0]).toMatchObject({ command: runtime.command, args: [runtime.entry, 'acp'], installedSession: { userHome: environment.env.USERPROFILE, appData: environment.env.APPDATA, localAppData: environment.env.LOCALAPPDATA } });
    const hooks = { update: vi.fn(), requestCode: vi.fn() };
    await harness.authenticate!(environment, 'cursor-browser', signal, hooks);
    expect(state.login).toHaveBeenCalledWith(expect.objectContaining({ provider: 'cursor', command: runtime.command, args: [runtime.entry, 'login'], cwd: join(root, 'profiles', 'cursor'), signal, hooks, env: expect.objectContaining({ USERPROFILE: environment.env.USERPROFILE, HOME: environment.env.HOME, NO_OPEN_BROWSER: '1' }) }));
    expect(state.probe).toHaveBeenCalledTimes(2);
  });
  it.each(['entry', 'node', 'node-acp'] as const)('recognizes an explicit official %s route without duplicating acp or losing the login entrypoint', async route => {
    const root = await setup(), runtime = await official(root, 'dist-package'), signal = new AbortController().signal;
    const explicit = route === 'entry' ? { command: runtime.entry } : { command: runtime.command, args: [runtime.entry, ...(route === 'node-acp' ? ['acp'] : [])] };
    const harness = browserAcpHarness('cursor', join(root, 'profiles'), explicit);
    await harness.probe(host(root), signal); await harness.authenticate!(host(root), 'cursor-browser', signal);
    expect(state.configs[0]).toMatchObject({ command: runtime.command, args: [runtime.entry, 'acp'] });
    expect(state.login).toHaveBeenCalledWith(expect.objectContaining({ command: runtime.command, args: [runtime.entry, 'login'] }));
  });
  it('preserves custom runtime arguments and its announced authentication method', async () => {
    const root = await setup(), custom = join(root, 'custom', 'index.js'), environment = host(root), signal = new AbortController().signal;
    await mkdir(dirname(custom)); await writeFile(custom, 'Custom ACP fixture');
    const explicit = { command: process.execPath, args: [custom, '--custom-route'] }, harness = browserAcpHarness('cursor', join(root, 'profiles'), explicit);
    const info = await harness.probe(environment, signal);
    expect(state.configs[0]).toEqual({ ...explicit, id: 'cursor', profileDir: join(root, 'profiles', 'cursor') });
    expect(info.authMethods?.[0]?.id).toBe('custom-method');
    const hooks = { update: vi.fn(), requestCode: vi.fn() }; await harness.authenticate!(environment, 'custom-method', signal, hooks);
    expect(state.authenticate).toHaveBeenCalledWith(environment, 'custom-method', signal, hooks); expect(state.login).not.toHaveBeenCalled();
    await expect(harness.authenticate!(environment, 'cursor-browser', signal)).rejects.toThrow('Comprobá el componente');
  });
  it('does not replace an incomplete JS route with another installed Cursor or retain a stale launch', async () => {
    const root = await setup(), runtime = await official(root), environment = host(root), signal = new AbortController().signal;
    environment.env.SYKA_CURSOR_PATH = runtime.entry; await writeFile(join(root, 'agent.exe'), 'different installation');
    const harness = browserAcpHarness('cursor', join(root, 'profiles')); await harness.probe(environment, signal);
    await rm(runtime.command); expect((await harness.probe(environment, signal)).status).toBe('not-installed');
    expect(state.configs).toHaveLength(1);
    await expect(harness.authenticate!(environment, 'cursor-browser', signal)).rejects.toThrow('Comprobá el componente');
    await expect(harness.open({} as OpenOptions)).rejects.toThrow('Conectá este proveedor');
    expect(state.login).not.toHaveBeenCalled();
  });
  it.each(['cursor', 'grok'] as const)('keeps native %s ACP and login invocations intact', async id => {
    const root = await setup(), command = join(root, id === 'cursor' ? 'cursor-agent.exe' : 'grok.exe'), environment = host(root), signal = new AbortController().signal;
    await writeFile(command, 'Native fixture only'); environment.env[`SYKA_${id.toUpperCase()}_PATH`] = command;
    const harness = browserAcpHarness(id, join(root, 'profiles')); await harness.probe(environment, signal); await harness.authenticate!(environment, id + '-browser', signal);
    expect(state.configs[0]).toMatchObject({ command, args: id === 'cursor' ? ['acp'] : ['agent', 'stdio'] });
    expect(state.login).toHaveBeenCalledWith(expect.objectContaining({ provider: id, command, args: ['login'] }));
  });
});
