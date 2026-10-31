import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCatalogCache, providerProbeFailure, retainDisplayCatalog, saveCatalogCache } from '../src/host/provider-probe';
import { AgentHost } from '../src/host/host';
import { ChatStore } from '../src/host/store';
import type { Harness } from '../src/host/harness';
import type { HarnessInfo } from '../src/protocol';

const ready: HarnessInfo = { id: 'grok', label: 'Grok', status: 'ready', models: [{ id: 'native', label: 'Native model' }], authMethods: [{ id: 'login', label: 'Login' }] };
describe('provider display catalog recovery', () => {
  it.each(['ACP: tiempo agotado en session/new.', 'ETIMEDOUT', 'request timed out', 'ECONNRESET'])('classifies a known transport failure: %s', message => {
    expect(providerProbeFailure(Error(message))).toBe('transient');
  });
  it.each(['authentication timeout', '401 unauthorized', 'invalid configuration', 'No such file ENOENT', 'provider returned no models'])('does not mask an auth/configuration failure: %s', message => {
    expect(providerProbeFailure(Error(message))).toBeUndefined();
  });
  it('preserves models only and clears cached provenance as soon as a live probe succeeds', () => {
    const cached = retainDisplayCatalog(ready, { id: 'grok', label: 'Grok', status: 'error', models: [], probeFailure: 'transient' });
    expect(cached).toMatchObject({ status: 'error', catalogSource: 'cache', models: ready.models });
    expect(cached.authMethods).toBeUndefined();
    expect(retainDisplayCatalog(cached, ready)).toEqual(ready);
  });
  it.each(['signed-out', 'not-installed', 'error'] as const)('does not retain models for %s without a known transient failure', status => {
    expect(retainDisplayCatalog(ready, { id: 'grok', label: 'Grok', status, models: [] }).models).toEqual([]);
  });
});

describe('startup catalog cache', () => {
  it('stores models only and reloads them as a pending check', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-catalog-'));
    try {
      const path = join(root, 'catalogs.json');
      await saveCatalogCache(path, [{ ...ready, detail: 'cuenta@example.com', version: '1.0.0' }]);
      expect(await readFile(path, 'utf8')).not.toMatch(/cuenta@|authMethods|1\.0\.0/);
      expect((await loadCatalogCache(path)).get('grok')).toEqual({ id: 'grok', label: 'Grok', models: ready.models, status: 'checking', catalogSource: 'cache', detail: 'Comprobando la conexión…' });
      expect((await loadCatalogCache(join(root, 'missing.json'))).size).toBe(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('rechecks only stale providers: a ready one is not relaunched on every refresh', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-probe-age-'));
    const readyProbe = vi.fn(async () => ready);
    const failing = vi.fn(async (): Promise<HarnessInfo> => ({ id: 'cursor', label: 'Cursor', status: 'signed-out', models: [] }));
    const harnesses = [{ id: 'grok', probe: readyProbe, open: vi.fn() }, { id: 'cursor', probe: failing, open: vi.fn() }] as unknown as Harness[];
    const host = new AgentHost({ version: 'fixture', store: new ChatStore(join(root, 'data')), harnesses, env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null });
    const connection = { send() {} };
    try {
      host.connect(connection as any); await host.start();
      await host.handle(connection as any, 'harnesses.list', { refresh: true });
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + 2 * 60_000);
      await host.handle(connection as any, 'harnesses.list', { refresh: true });
      expect(readyProbe).toHaveBeenCalledTimes(1);
      expect(failing).toHaveBeenCalledTimes(2);
      await host.handle(connection as any, 'harnesses.list', { refresh: true, force: true });
      expect(readyProbe).toHaveBeenCalledTimes(2);
    } finally { vi.restoreAllMocks(); await host.stop(); await rm(root, { recursive: true, force: true }); }
  });

  it('runs provider checks in a small pool and lets a send jump the queue', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-probe-pool-'));
    const gates = new Map<string, () => void>();
    let active = 0, peak = 0;
    const started: string[] = [];
    const make = (id: string) => ({ id, open: vi.fn(async () => ({ resume: null, isClosed: false, send: async () => ({ status: 'completed' as const }), respond() {}, interrupt: async () => {}, close: async () => {} })),
      probe: async () => { started.push(id); active++; peak = Math.max(peak, active); await new Promise<void>(resolve => gates.set(id, resolve)); active--; return { ...ready, id, label: id }; } });
    const harnesses = ['grok', 'cursor', 'opencode', 'hermes'].map(make) as unknown as Harness[];
    const host = new AgentHost({ version: 'fixture', store: new ChatStore(join(root, 'data')), harnesses, env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null });
    const connection = { send() {} };
    try {
      host.connect(connection as any); await host.start();
      await vi.waitFor(() => expect(started).toHaveLength(2));
      expect(started).not.toContain('hermes');
      const sending = host.handle(connection as any, 'turn.send', { projectId: 'p', cwd: root, text: 'hola', model: { harness: 'hermes', model: 'native' } });
      await vi.waitFor(() => expect(started).toContain('hermes'));
      for (const id of ['hermes', 'grok', 'cursor', 'opencode']) { await vi.waitFor(() => expect(gates.has(id)).toBe(true)); gates.get(id)!(); }
      await sending;
      expect(peak).toBeLessThanOrEqual(3);
    } finally { for (const release of gates.values()) release(); await host.stop(); await rm(root, { recursive: true, force: true }); }
  });

  it('shows the cached catalog before a slow probe and waits for that probe before sending', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-catalog-host-'));
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const open = vi.fn(async () => ({ resume: null, isClosed: false, send: async () => ({ status: 'completed' as const }), respond() {}, interrupt: async () => {}, close: async () => {} }));
    const slow: Harness = { id: 'grok', probe: async () => { await gate; return ready; }, open } as unknown as Harness;
    const path = join(root, 'catalogs.json');
    await saveCatalogCache(path, [ready]);
    const host = new AgentHost({ version: 'fixture', store: new ChatStore(join(root, 'data')), harnesses: [slow], env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null, catalogCacheFile: path });
    const connection = { send() {} };
    try {
      host.connect(connection as any); await host.start();
      const listed = (await host.handle(connection as any, 'harnesses.list', {}))[0]!;
      expect(listed).toMatchObject({ status: 'checking', catalogSource: 'cache', models: ready.models });
      const sending = host.handle(connection as any, 'turn.send', { projectId: 'p', cwd: root, text: 'hola', model: { harness: 'grok', model: 'native' } });
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(open).not.toHaveBeenCalled();
      release();
      await sending;
      await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    } finally { release(); await host.stop(); await rm(root, { recursive: true, force: true }); }
  });
});
