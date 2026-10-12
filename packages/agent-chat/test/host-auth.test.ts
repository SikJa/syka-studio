import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AgentHost, type AgentHostOptions } from '../src/host/host';
import { ChatStore } from '../src/host/store';
import type { Harness, HarnessSession, TurnOutcome } from '../src/host/harness';
import type { HarnessId, HarnessInfo, HostMsg } from '../src/protocol';

function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const fixtures: { host: AgentHost; root: string; release?: () => void }[] = [];
afterEach(async () => { for (const fixture of fixtures.splice(0)) { fixture.release?.(); await fixture.host.stop(); await rm(fixture.root, { recursive: true, force: true }); } });
const METHODS = [{ id: 'subscription', label: 'Cuenta de suscripción' }, { id: 'second', label: 'Otra cuenta' }];
const info = (id: HarnessId, status: HarnessInfo['status'] = 'ready', model = 'selected-model'): HarnessInfo => ({ id, label: id, status, models: status === 'ready' ? [{ id: model, label: model, efforts: ['low', 'high'], defaultEffort: 'high' }] : [], authMethods: METHODS });
function fixtureHarness(id: HarnessId, initial: HarnessInfo['status'] = 'ready') {
  const session: HarnessSession = { resume: { acp: { version: 1, harness: id, sessionId: 'fixture', profile: 'fixture' } }, send: vi.fn(async () => ({ status: 'completed' as const })), respond: vi.fn(), interrupt: vi.fn(async () => {}), close: vi.fn(async () => {}) };
  const harness: Harness = { id, probe: vi.fn(async () => info(id, initial)), open: vi.fn(async () => session), authMethods: vi.fn(async () => METHODS), authenticate: vi.fn(async () => {}) };
  return { harness, session };
}
async function setup(harnesses: Harness[], options: Partial<AgentHostOptions> = {}, waitProbe = true) {
  const root = await mkdtemp(join(tmpdir(), 'syka-host-auth-')), messages: HostMsg[] = [], connection = { send: (message: HostMsg) => { messages.push(message); } }, store = new ChatStore(root);
  const host = new AgentHost({ version: 'fixture', store, harnesses, env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null, probeMaxAgeMs: 0, ...options });
  const fixture = { host, root, release: undefined as (() => void) | undefined }; fixtures.push(fixture);
  host.connect(connection); await host.start(); if (waitProbe) await host.handle(connection, 'harnesses.list', { refresh: true });
  const read = async (id: HarnessId = harnesses[0]!.id) => (await host.handle(connection, 'harnesses.list', {})).find(value => value.id === id)!;
  const waitPhase = async (phase: NonNullable<HarnessInfo['authFlow']>['phase'], id: HarnessId = harnesses[0]!.id) => {
    let value!: HarnessInfo; await vi.waitFor(async () => { value = await read(id); expect(value.authFlow?.phase).toBe(phase); }); return value;
  };
  return { host, root, store, fixture, messages, connection, read, waitPhase };
}
async function warmSession(test: Awaited<ReturnType<typeof setup>>, id: HarnessId, model = 'selected-model', idleHost = true) {
  const created = await test.host.handle(test.connection, 'turn.send', { projectId: 'fixture-project', cwd: test.root, text: 'fixture turn', model: { harness: id, model } });
  await vi.waitFor(async () => { const snapshot = await test.host.handle(test.connection, 'chats.open', created); expect(snapshot.chat.status).toBe('idle'); if (idleHost) expect(test.host.isBusy()).toBe(false); });
  return created.chatId;
}

describe('provider Connect host lifecycle', () => {
  it('preserves a catalog/protocol error after successful authorization instead of reporting signed-out', async () => {
    const fixture = fixtureHarness('cursor', 'signed-out'); let authenticated = false;
    fixture.harness.probe = vi.fn(async () => ({ ...info('cursor', authenticated ? 'error' : 'signed-out'), detail: authenticated ? 'Fixture ACP catalog unavailable' : 'Connect account' }));
    fixture.harness.authenticate = vi.fn(async () => { authenticated = true; });
    const test = await setup([fixture.harness]);
    await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'cursor', methodId: 'subscription' });
    const state = await test.waitPhase('failed');
    expect(authenticated).toBe(true); expect(state.status).toBe('error'); expect(state.models).toEqual([]);
    expect(state.authFlow?.message).toBe('Fixture ACP catalog unavailable');
  });
  it('prepares a missing component, selects its announced method and completes the exact URL/code flow', async () => {
    const missing = fixtureHarness('hermes', 'not-installed'), prepared = fixtureHarness('hermes', 'signed-out'); let connected = false, received = '';
    prepared.harness.probe = vi.fn(async () => info('hermes', connected ? 'ready' : 'signed-out', 'GPT-6-Astra'));
    prepared.harness.authenticate = vi.fn(async (_env, method, _signal, hooks) => {
      expect(method).toBe('subscription');
      hooks!.update({ phase: 'waiting', message: 'Autorizá la cuenta.', url: 'https://auth.openai.com/fixture', userCode: 'FIXTURE-CODE' });
      received = await hooks!.requestCode('Pegá el código de autorización.'); connected = true;
    });
    const prepare = vi.fn(async (_id, _env, _signal, progress) => { progress('Preparando el componente oficial…'); return prepared.harness; });
    const test = await setup([missing.harness], { prepareProvider: prepare });
    await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'connect' });
    let state = await test.waitPhase('waiting'); expect(state.authFlow?.options).toEqual(METHODS); const flowId = state.authFlow!.id;
    await expect(test.host.handle(test.connection, 'harnesses.auth.respond', { harness: 'hermes', flowId: 'old-flow', code: 'subscription' })).rejects.toMatchObject({ code: 'no-request' });
    await expect(test.host.handle(test.connection, 'harnesses.auth.respond', { harness: 'hermes', flowId, code: 'unannounced' })).rejects.toMatchObject({ code: 'bad-request' });
    await test.host.handle(test.connection, 'harnesses.auth.respond', { harness: 'hermes', flowId, code: 'subscription' });
    await vi.waitFor(async () => { state = await test.read(); expect(state.authFlow?.inputPrompt).toBe('Pegá el código de autorización.'); });
    expect(state.authFlow?.id).toBe(flowId); expect(state.authFlow?.url).toBe('https://auth.openai.com/fixture'); expect(state.authFlow?.userCode).toBe('FIXTURE-CODE'); expect(state.authFlow?.options).toBeUndefined();
    await expect(test.host.handle(test.connection, 'harnesses.auth.respond', { harness: 'hermes', flowId, code: 'bad\ncode' })).rejects.toMatchObject({ code: 'bad-request' });
    await test.host.handle(test.connection, 'harnesses.auth.respond', { harness: 'hermes', flowId, code: ' fixture-answer ' });
    state = await test.waitPhase('connected'); expect(state.status).toBe('ready'); expect(state.models[0]?.id).toBe('GPT-6-Astra'); expect(received).toBe('fixture-answer');
    expect(prepare).toHaveBeenCalledTimes(1); expect(missing.harness.authenticate).not.toHaveBeenCalled(); expect(prepared.harness.open).not.toHaveBeenCalled();
    expect(await test.store.list()).toEqual([]);
    await expect(test.host.handle(test.connection, 'harnesses.auth.respond', { harness: 'hermes', flowId, code: 'late' })).rejects.toMatchObject({ code: 'no-request' });
    await expect(test.host.handle(test.connection, 'harnesses.auth.cancel', { harness: 'hermes', flowId })).rejects.toMatchObject({ code: 'no-request' });
  });
  it('reuses a verified existing account without login or closing its current session', async () => {
    const existing = fixtureHarness('hermes'), test = await setup([existing.harness]); await warmSession(test, 'hermes');
    await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'connect' }); const state = await test.waitPhase('connected');
    expect(state.status).toBe('ready'); expect(state.models).toEqual(info('hermes').models); expect(existing.harness.authenticate).not.toHaveBeenCalled(); expect(existing.session.close).not.toHaveBeenCalled();
  });
  it('discards a probe that started before login even when it finishes after login completed', async () => {
    const fixture = fixtureHarness('codex', 'signed-out'), old = deferred<HarnessInfo>(); let probes = 0, authenticated = false;
    fixture.harness.probe = vi.fn(async () => ++probes === 1 ? old.promise : info('codex', authenticated ? 'ready' : 'signed-out', 'new-model'));
    fixture.harness.authenticate = vi.fn(async () => { authenticated = true; });
    const test = await setup([fixture.harness], {}, false); test.fixture.release = () => old.resolve(info('codex', 'signed-out'));
    await vi.waitFor(() => expect(probes).toBe(1));
    await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'codex', methodId: 'connect' });
    await test.waitPhase('connected'); old.resolve(info('codex', 'signed-out')); await test.host.handle(test.connection, 'harnesses.list', { refresh: true });
    const state = await test.read(); expect(state.status).toBe('ready'); expect(state.models[0]?.id).toBe('new-model'); expect(state.authFlow?.phase).toBe('connected');
  });
  it.each(['failed', 'cancelled'] as const)('preserves the previous ready catalog, harness and open session when another-account login is %s', async phase => {
    const existing = fixtureHarness('hermes'), next = fixtureHarness('hermes', 'signed-out');
    next.harness.authenticate = phase === 'failed' ? vi.fn(async () => { throw Error('Fixture denied'); }) : vi.fn(async (_env, _method, _signal, hooks) => { await hooks!.requestCode('Fixture code'); });
    const test = await setup([existing.harness], { prepareProvider: async () => next.harness }); const chatId = await warmSession(test, 'hermes');
    await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'subscription' });
    if (phase === 'cancelled') { const state = await test.waitPhase('waiting'); await test.host.handle(test.connection, 'harnesses.auth.cancel', { harness: 'hermes', flowId: state.authFlow!.id }); await expect(test.host.handle(test.connection, 'harnesses.auth.respond', { harness: 'hermes', flowId: state.authFlow!.id, code: 'late' })).rejects.toMatchObject({ code: 'no-request' }); }
    const result = await test.waitPhase(phase); expect(result.status).toBe('ready'); expect(result.models).toEqual(info('hermes').models); expect(existing.session.close).not.toHaveBeenCalled();
    await test.host.handle(test.connection, 'turn.send', { chatId, projectId: 'fixture-project', cwd: test.root, text: 'continue old account', model: { harness: 'hermes', model: 'selected-model' } });
    await vi.waitFor(() => expect(existing.session.send).toHaveBeenCalledTimes(2)); expect(next.harness.open).not.toHaveBeenCalled();
  });
  it('closes the old account session only after the replacement login and probe have succeeded', async () => {
    const existing = fixtureHarness('hermes'), next = fixtureHarness('hermes', 'signed-out'), verifying = deferred<void>(), verified = deferred<HarnessInfo>(); let probes = 0;
    next.harness.probe = vi.fn(async () => ++probes === 1 ? info('hermes', 'signed-out') : (verifying.resolve(), verified.promise));
    const test = await setup([existing.harness], { prepareProvider: async () => next.harness }); test.fixture.release = () => verified.resolve(info('hermes', 'ready', 'replacement-model'));
    const chatId = await warmSession(test, 'hermes'); await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'subscription' }); await verifying.promise;
    expect((await test.read()).models).toEqual(info('hermes').models); expect(existing.session.close).not.toHaveBeenCalled();
    verified.resolve(info('hermes', 'ready', 'replacement-model')); await test.waitPhase('connected'); await vi.waitFor(() => expect(test.host.isBusy()).toBe(false)); expect(existing.session.close).toHaveBeenCalledTimes(1);
    await test.host.handle(test.connection, 'turn.send', { chatId, projectId: 'fixture-project', cwd: test.root, text: 'new account', model: { harness: 'hermes', model: 'replacement-model' } });
    await vi.waitFor(() => expect(next.harness.open).toHaveBeenCalledTimes(1)); expect(existing.session.send).toHaveBeenCalledTimes(1);
  });
  it('rejects a cancelled flow input or cancellation while a newer connection is waiting', async () => {
    const fixture = fixtureHarness('hermes', 'signed-out'); fixture.harness.authenticate = vi.fn(async (_env, _method, _signal, hooks) => { await hooks!.requestCode('Fixture code'); });
    const test = await setup([fixture.harness]); await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'subscription' }); const first = await test.waitPhase('waiting');
    await test.host.handle(test.connection, 'harnesses.auth.cancel', { harness: 'hermes', flowId: first.authFlow!.id }); await test.waitPhase('cancelled'); await vi.waitFor(() => expect(test.host.isBusy()).toBe(false));
    await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'subscription' }); const second = await test.waitPhase('waiting'); expect(second.authFlow!.id).not.toBe(first.authFlow!.id);
    await expect(test.host.handle(test.connection, 'harnesses.auth.respond', { harness: 'hermes', flowId: first.authFlow!.id, code: 'stale' })).rejects.toMatchObject({ code: 'no-request' });
    await expect(test.host.handle(test.connection, 'harnesses.auth.cancel', { harness: 'hermes', flowId: first.authFlow!.id })).rejects.toMatchObject({ code: 'no-request' });
    expect((await test.read()).authFlow?.id).toBe(second.authFlow!.id); await test.host.handle(test.connection, 'harnesses.auth.cancel', { harness: 'hermes', flowId: second.authFlow!.id }); await test.waitPhase('cancelled');
  });
  it('waits for a cancelled login process to finish its cleanup before stop resolves', async () => {
    const fixture = fixtureHarness('hermes', 'signed-out'), entered = deferred<void>(), aborted = deferred<void>(), closed = deferred<void>();
    fixture.harness.authenticate = vi.fn(async (_env, _method, signal) => { entered.resolve(); await new Promise<void>((_resolve, reject) => { signal.addEventListener('abort', () => { aborted.resolve(); void closed.promise.then(() => reject(Error('Fixture closed'))); }, { once: true }); }); });
    const test = await setup([fixture.harness]); test.fixture.release = () => closed.resolve(); await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'subscription' }); await entered.promise;
    expect(test.host.isBusy()).toBe(true); let stopped = false; const stop = test.host.stop().then(() => { stopped = true; }); await aborted.promise; await Promise.resolve(); expect(stopped).toBe(false);
    closed.resolve(); await stop; expect(stopped).toBe(true); expect(test.host.isBusy()).toBe(false);
  });
  it('bounds method discovery, aborts its adapter and waits for its actual cleanup on stop', async () => {
    const fixture = fixtureHarness('hermes'), entered = deferred<void>(), closed = deferred<void>(); let aborted = false;
    fixture.harness.authMethods = vi.fn(async (_env, signal) => { entered.resolve(); return new Promise<typeof METHODS>((_, reject) => { signal.addEventListener('abort', () => { aborted = true; void closed.promise.then(() => reject(Error('Fixture closed'))); }, { once: true }); }); });
    const test = await setup([fixture.harness], { authMethodsTimeoutMs: 20 }); test.fixture.release = () => closed.resolve();
    const methods = test.host.handle(test.connection, 'harnesses.auth.methods', { harness: 'hermes' }); const failed = expect(methods).rejects.toThrow('venció'); await entered.promise; await failed; expect(aborted).toBe(true);
    expect((await test.read()).status).toBe('ready'); let stopped = false; const stop = test.host.stop().then(() => { stopped = true; }); await Promise.resolve(); expect(stopped).toBe(false); closed.resolve(); await stop; expect(stopped).toBe(true);
  });
  it('keeps method discovery exclusive with auth and configuration only for the same provider', async () => {
    const hermes = fixtureHarness('hermes'), codex = fixtureHarness('codex'), lookup = deferred<typeof METHODS>();
    hermes.harness.authMethods = vi.fn(async () => lookup.promise);
    const settings = { configFile: 'fixture', profilesRoot: 'fixture', entries: [] }, save = vi.fn(async () => ({ settings, harness: hermes.harness }));
    const test = await setup([hermes.harness, codex.harness], { providerSettings: { read: async () => settings, save } }); test.fixture.release = () => lookup.resolve(METHODS);
    const query = test.host.handle(test.connection, 'harnesses.auth.methods', { harness: 'hermes' }); await vi.waitFor(() => expect(hermes.harness.authMethods).toHaveBeenCalledTimes(1));
    await expect(test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'connect' })).rejects.toMatchObject({ code: 'busy' });
    await expect(test.host.handle(test.connection, 'harnesses.configure', { id: 'hermes', command: 'fixture' })).rejects.toMatchObject({ code: 'busy' }); expect(save).not.toHaveBeenCalled();
    expect(await test.host.handle(test.connection, 'harnesses.auth.methods', { harness: 'codex' })).toEqual(METHODS);
    await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'codex', methodId: 'connect' }); await test.waitPhase('connected', 'codex');
    lookup.resolve(METHODS); expect(await query).toEqual(METHODS);
  });
  it('rejects method discovery during login and keeps another provider available', async () => {
    const hermes = fixtureHarness('hermes', 'signed-out'), codex = fixtureHarness('codex');
    hermes.harness.authenticate = vi.fn(async (_env, _method, _signal, hooks) => { await hooks!.requestCode('Fixture code'); });
    const test = await setup([hermes.harness, codex.harness]); await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'subscription' }); const waiting = await test.waitPhase('waiting');
    await expect(test.host.handle(test.connection, 'harnesses.auth.methods', { harness: 'hermes' })).rejects.toMatchObject({ code: 'busy' });
    const chatId = await warmSession(test, 'codex', 'selected-model', false); expect(chatId).toBeTruthy(); expect(codex.session.send).toHaveBeenCalledTimes(1);
    await test.host.handle(test.connection, 'harnesses.auth.cancel', { harness: 'hermes', flowId: waiting.authFlow!.id }); await test.waitPhase('cancelled');
  });
  it('keeps discovery and login exclusive with an active configuration without pausing another provider queue', async () => {
    const hermes = fixtureHarness('hermes'), codex = fixtureHarness('codex'), saving = deferred<void>(), saved = deferred<void>(), settings = { configFile: 'fixture', profilesRoot: 'fixture', entries: [] };
    const test = await setup([hermes.harness, codex.harness], { providerSettings: { read: async () => settings, save: async () => { saving.resolve(); await saved.promise; return { settings, harness: hermes.harness }; } } }); test.fixture.release = () => saved.resolve();
    const chatId = await warmSession(test, 'codex'), configuration = test.host.handle(test.connection, 'harnesses.configure', { id: 'hermes', command: 'fixture' }); await saving.promise;
    await expect(test.host.handle(test.connection, 'harnesses.auth.methods', { harness: 'hermes' })).rejects.toMatchObject({ code: 'busy' });
    await expect(test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'connect' })).rejects.toMatchObject({ code: 'busy' });
    expect(await test.host.handle(test.connection, 'harnesses.auth.methods', { harness: 'codex' })).toEqual(METHODS);
    await test.host.handle(test.connection, 'queue.add', { chatId, text: 'unrelated queued turn', model: { harness: 'codex', model: 'selected-model' } });
    await vi.waitFor(() => expect(codex.session.send).toHaveBeenCalledTimes(2)); expect(codex.session.interrupt).not.toHaveBeenCalled(); expect(codex.session.close).not.toHaveBeenCalled();
    saved.resolve(); expect(await configuration).toEqual(settings);
  });
  it('installs and probes a changed route while an unrelated startup probe is still pending', async () => {
    const hermes = fixtureHarness('hermes'), next = fixtureHarness('hermes'), codex = fixtureHarness('codex'), oldProbe = deferred<HarnessInfo>(), started = deferred<void>();
    codex.harness.probe = vi.fn(async () => { started.resolve(); return oldProbe.promise; });
    next.harness.probe = vi.fn(async () => info('hermes', 'ready', 'new-route-model'));
    const settings = { configFile: 'fixture', profilesRoot: 'fixture', entries: [] }, save = vi.fn(async () => ({ settings, harness: next.harness }));
    const test = await setup([hermes.harness, codex.harness], { providerSettings: { read: async () => settings, save } }, false); test.fixture.release = () => oldProbe.resolve(info('codex'));
    await started.promise;
    const changed = test.host.handle(test.connection, 'harnesses.configure', { id: 'hermes', command: 'fixture' });
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce()); await expect(changed).resolves.toEqual(settings);
    expect((await test.read('hermes')).models[0]?.id).toBe('new-route-model'); expect(next.harness.probe).toHaveBeenCalledOnce();
    expect(codex.session.close).not.toHaveBeenCalled(); expect(codex.session.interrupt).not.toHaveBeenCalled();
    oldProbe.resolve(info('codex')); await test.host.handle(test.connection, 'harnesses.list', { refresh: true }); expect((await test.read('hermes')).models[0]?.id).toBe('new-route-model');
  });
  it('reserves a provider while its accepted turn is still writing initial metadata', async () => {
    const hermes = fixtureHarness('hermes'), codex = fixtureHarness('codex'), writing = deferred<void>(), written = deferred<void>(), test = await setup([hermes.harness, codex.harness]);
    test.fixture.release = () => written.resolve(); const writeMeta = test.store.writeMeta.bind(test.store); vi.spyOn(test.store, 'writeMeta').mockImplementationOnce(async meta => { writing.resolve(); await written.promise; await writeMeta(meta); });
    const turn = test.host.handle(test.connection, 'turn.send', { projectId: 'fixture-project', cwd: test.root, text: 'accepted turn', model: { harness: 'hermes', model: 'selected-model' } }); await writing.promise;
    expect(hermes.harness.open).not.toHaveBeenCalled(); await expect(test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'connect' })).rejects.toMatchObject({ code: 'busy' });
    await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'codex', methodId: 'connect' }); await test.waitPhase('connected', 'codex');
    written.resolve(); await turn; await vi.waitFor(() => expect(hermes.session.send).toHaveBeenCalledTimes(1));
  });
  it('blocks switching the provider with a running turn while allowing a different provider login', async () => {
    const codex = fixtureHarness('codex'), hermes = fixtureHarness('hermes'), turn = deferred<TurnOutcome>();
    codex.session.send = vi.fn(async () => turn.promise); codex.session.interrupt = vi.fn(async () => turn.resolve({ status: 'interrupted' }));
    const test = await setup([codex.harness, hermes.harness]); await test.host.handle(test.connection, 'turn.send', { projectId: 'fixture-project', cwd: test.root, text: 'held turn', model: { harness: 'codex', model: 'selected-model' } });
    await vi.waitFor(() => expect(codex.session.send).toHaveBeenCalledTimes(1));
    await expect(test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'codex', methodId: 'connect' })).rejects.toMatchObject({ code: 'busy' });
    await test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'connect' }); await test.waitPhase('connected', 'hermes'); expect(codex.session.interrupt).not.toHaveBeenCalled(); expect(codex.session.close).not.toHaveBeenCalled();
    turn.resolve({ status: 'completed' });
  });
  it('rejects unsupported login methods before preparing a component', async () => {
    const fixture = fixtureHarness('hermes'), prepare = vi.fn(async () => fixture.harness), test = await setup([fixture.harness], { prepareProvider: prepare });
    await expect(test.host.handle(test.connection, 'harnesses.authenticate', { harness: 'hermes', methodId: 'not-advertised' })).rejects.toMatchObject({ code: 'bad-request' }); expect(prepare).not.toHaveBeenCalled(); expect(fixture.harness.authenticate).not.toHaveBeenCalled();
  });
});
