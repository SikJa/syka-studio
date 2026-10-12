import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticateOpenCode, openCodeAuthMethods } from '../src/host/opencode-login';
import { openProviderLogin } from '../src/host/browser-login';
import type { AuthHooks } from '../src/host/harness';

vi.mock('../src/host/browser-login', async importOriginal => ({
  ...await importOriginal<typeof import('../src/host/browser-login')>(),
  openProviderLogin: vi.fn(async () => {}),
}));

const fixture = fileURLToPath(new URL('./fixtures/opencode-login.mjs', import.meta.url));
const tempPrefix = join(tmpdir(), 'syka-opencode-login-test-');
let root: string;
let eventsPath: string;
type Event = { type: string; pid?: number; args?: string[]; path?: string; method?: string; body?: unknown; authenticated?: boolean };

beforeEach(async () => {
  root = await mkdtemp(tempPrefix);
  eventsPath = join(root, 'events.jsonl');
  vi.mocked(openProviderLogin).mockReset().mockResolvedValue();
});

async function events(): Promise<Event[]> {
  try { return (await readFile(eventsPath, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as Event); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}

afterEach(async () => {
  const started = (await events()).find(item => item.type === 'start');
  let alive = false;
  if (started?.pid) { try { process.kill(started.pid, 0); alive = true; } catch { /* The owned server must be gone before the helper settles. */ } }
  if (alive && started?.pid) process.kill(started.pid, 'SIGKILL');
  if (!root.startsWith(tempPrefix)) throw Error('Unexpected cleanup path');
  await rm(root, { recursive: true, force: true });
  expect(alive, 'owned OpenCode auth server was left running').toBe(false);
});

function options(mode = 'auto', signal = new AbortController().signal, timeoutMs?: number, extra: Record<string, string> = {}) {
  const env: Record<string, string> = { SYKA_FAKE_MODE: mode, SYKA_FAKE_EVENTS: eventsPath, ...extra };
  for (const key of ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'windir', 'COMSPEC', 'PATHEXT']) if (process.env[key]) env[key] = process.env[key]!;
  return { route: { command: process.execPath, args: [fixture, 'acp'] }, cwd: join(root, 'cwd'), env, signal, ...(timeoutMs === undefined ? {} : { timeoutMs }) };
}

function hooks(): AuthHooks {
  return { update: vi.fn(), requestCode: vi.fn(async () => ' fixture-authorization-code ') };
}

async function waitForEvent(predicate: (event: Event) => boolean): Promise<void> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if ((await events()).some(predicate)) return;
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  throw Error('Fixture did not reach the expected stage');
}

describe('OpenCode OAuth via its owned official server', () => {
  it('lists only supported OAuth methods with the original provider and method indexes', async () => {
    const value = await openCodeAuthMethods(options());
    expect(value).toEqual([
      { id: 'opencode-oauth:openai:1', label: 'ChatGPT subscription · openai' },
      { id: 'opencode-oauth:openai:4', label: 'x'.repeat(120) + ' · openai' },
      { id: 'opencode-oauth:anthropic:0', label: 'Claude subscription · anthropic' },
    ]);
    expect((await events()).find(item => item.type === 'start')?.args).toEqual(['serve', '--hostname', '127.0.0.1', '--port', '0']);
    expect((await events()).filter(item => item.type === 'request')).toEqual([{ type: 'request', path: '/provider/auth', method: 'GET', authenticated: true }]);
    expect(openProviderLogin).not.toHaveBeenCalled();
  });

  it('completes auto OAuth only after callback=true and the selected account is connected', async () => {
    const startedAt = Date.now(), flow = hooks();
    await authenticateOpenCode(options(), 'opencode-oauth:openai:1', flow);
    expect(openProviderLogin).toHaveBeenCalledExactlyOnceWith('opencode', 'https://auth.openai.com/codex/device');
    expect(flow.requestCode).not.toHaveBeenCalled();
    expect(flow.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ phase: 'waiting', userCode: 'ABCD-EFGH', url: 'https://auth.openai.com/codex/device' }));
    const waiting = vi.mocked(flow.update).mock.calls[0]![0];
    expect(waiting.expiresAt).toBeGreaterThanOrEqual(startedAt + 359_000);
    expect(waiting.expiresAt).toBeLessThanOrEqual(startedAt + 361_000);
    expect(flow.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ phase: 'verifying' }));
    expect((await events()).filter(item => item.type === 'request').map(item => [item.path, item.body])).toEqual([
      ['/provider/auth', undefined], ['/provider/openai/oauth/authorize', { method: 1 }],
      ['/provider/openai/oauth/callback', { method: 1 }], ['/provider', undefined],
    ]);
  });

  it('waits for the complete startup URL instead of accepting a port at a chunk boundary', async () => {
    const value = await openCodeAuthMethods(options('startup-split-url'));
    expect(value.some(item => item.id === 'opencode-oauth:openai:1')).toBe(true);
    expect((await events()).filter(item => item.type === 'request')).toHaveLength(1);
  });

  it('submits a pasted code to the selected provider and the selected method', async () => {
    const flow = hooks();
    await authenticateOpenCode(options(), 'opencode-oauth:anthropic:0', flow);
    expect(openProviderLogin).toHaveBeenCalledExactlyOnceWith('opencode', 'https://claude.ai/oauth/authorize');
    expect(flow.requestCode).toHaveBeenCalledOnce();
    expect((await events()).find(item => item.path === '/provider/anthropic/oauth/callback')?.body).toEqual({ method: 0, code: 'fixture-authorization-code' });
  });

  it.each([
    'https://auth.openai.com.evil.test/authorize', 'http://auth.openai.com/authorize',
    'https://user:password@auth.openai.com/authorize', 'https://auth.openai.com:1234/authorize',
  ])('rejects a nonofficial authorization URL before opening it: %s', async url => {
    await expect(authenticateOpenCode(options('auto', undefined, undefined, { SYKA_FAKE_URL: url }), 'opencode-oauth:openai:1', hooks())).rejects.toThrow('página de inicio de sesión oficial');
    expect(openProviderLogin).not.toHaveBeenCalled();
    expect((await events()).some(item => item.path?.endsWith('/oauth/callback'))).toBe(false);
  });

  it.each(['invalid-authorization', 'invalid-authorization-array', 'invalid-authorization-instructions'])('validates the installed authorization response schema before opening a URL: %s', async mode => {
    await expect(authenticateOpenCode(options(mode), 'opencode-oauth:openai:1', hooks())).rejects.toThrow('autorización válida');
    expect(openProviderLogin).not.toHaveBeenCalled();
  });

  it('rejects callback=false even when the provider would claim to be connected', async () => {
    const flow = hooks();
    await expect(authenticateOpenCode(options('callback-false'), 'opencode-oauth:openai:1', flow)).rejects.toThrow('no confirmó la autorización');
    expect((await events()).some(item => item.path === '/provider')).toBe(false);
    expect(flow.update).toHaveBeenCalledOnce();
  });

  it.each(['connected-missing', 'connected-invalid', 'connected-null'])('requires a valid selected connected account: %s', async mode => {
    await expect(authenticateOpenCode(options(mode), 'opencode-oauth:openai:1', hooks())).rejects.toThrow('no confirmó la cuenta seleccionada');
  });

  it.each(['opencode-oauth:openai:0', 'opencode-oauth:openai:999', 'opencode-oauth:missing-provider:0'])('rejects an unavailable or API method before authorization: %s', async method => {
    await expect(authenticateOpenCode(options(), method, hooks())).rejects.toThrow('ya no está disponible');
    expect((await events()).some(item => item.path?.endsWith('/oauth/authorize'))).toBe(false);
  });

  it('rejects a method needing unsupported inputs before starting OAuth', async () => {
    await expect(authenticateOpenCode(options(), 'opencode-oauth:openai:3', hooks())).rejects.toThrow('pide datos adicionales');
    expect((await events()).some(item => item.path?.endsWith('/oauth/authorize'))).toBe(false);
  });

  it.each(['methods-oversized-length', 'methods-oversized-stream'])('bounds method discovery JSON without relying on content-length: %s', async mode => {
    await expect(openCodeAuthMethods(options(mode))).rejects.toThrow('demasiado grande');
  });

  it.each(['methods-invalid-json', 'methods-array', 'methods-null', 'methods-redirect'])('rejects a malformed or redirected method response: %s', async mode => {
    await expect(openCodeAuthMethods(options(mode))).rejects.toThrow(/JSON válida|métodos de conexión válidos|leer la respuesta/);
  });

  it('does not spawn or create a profile for an already cancelled flow', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(authenticateOpenCode(options('auto', controller.signal), 'opencode-oauth:openai:1', hooks())).rejects.toThrow('cancelada');
    expect(await events()).toEqual([]);
    await expect(readFile(join(root, 'cwd'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['startup-hang', 'methods-hang', 'methods-body-hang', 'authorize-hang', 'callback-hang', 'code-wait', 'browser-wait'])('cancels promptly and awaits its server shutdown during %s', async stage => {
    const controller = new AbortController(), flow = hooks();
    if (stage === 'code-wait') vi.mocked(flow.requestCode).mockImplementation(() => new Promise(() => {}));
    if (stage === 'browser-wait') vi.mocked(openProviderLogin).mockImplementation(() => new Promise(() => {}));
    const pending = authenticateOpenCode(options(stage === 'code-wait' ? 'code' : stage, controller.signal), 'opencode-oauth:openai:1', flow);
    const rejection = expect(pending).rejects.toThrow('cancelada');
    if (stage === 'startup-hang') await waitForEvent(item => item.type === 'start');
    else if (stage.startsWith('methods')) await waitForEvent(item => item.path === '/provider/auth');
    else if (stage === 'callback-hang') await waitForEvent(item => item.path?.endsWith('/oauth/callback') === true);
    else await waitForEvent(item => item.path?.endsWith('/oauth/authorize') === true);
    if (stage === 'code-wait') await vi.waitFor(() => expect(flow.requestCode).toHaveBeenCalled());
    if (stage === 'browser-wait') await vi.waitFor(() => expect(openProviderLogin).toHaveBeenCalled());
    const cancelledAt = Date.now(); controller.abort();
    await rejection;
    expect(Date.now() - cancelledAt).toBeLessThan(3000);
    expect((await events()).some(item => item.path === '/provider')).toBe(false);
    if (stage === 'code-wait' || stage === 'browser-wait') expect((await events()).some(item => item.path?.endsWith('/oauth/callback'))).toBe(false);
  });

  it.each(['startup-hang', 'methods-hang', 'methods-body-hang', 'callback-hang', 'code-wait', 'browser-wait'])('enforces the total deadline and closes its owned process during %s', async stage => {
    const flow = hooks(), startedAt = Date.now();
    if (stage === 'code-wait') vi.mocked(flow.requestCode).mockImplementation(() => new Promise(() => {}));
    if (stage === 'browser-wait') vi.mocked(openProviderLogin).mockImplementation(() => new Promise(() => {}));
    await expect(authenticateOpenCode(options(stage === 'code-wait' ? 'code' : stage, undefined, 600), 'opencode-oauth:openai:1', flow)).rejects.toThrow('agotó el tiempo');
    expect(Date.now() - startedAt).toBeLessThan(3000);
    expect((await events()).some(item => item.path === '/provider')).toBe(false);
  });

  it('also bounds discovery without a caller cancellation', async () => {
    await expect(openCodeAuthMethods(options('methods-hang', undefined, 500))).rejects.toThrow('agotó el tiempo');
  });

  it('handles a server that exits while fetching methods', async () => {
    await expect(openCodeAuthMethods(options('server-exit'))).rejects.toThrow(/cerró su servicio|leer la respuesta/);
  });

  it('handles a missing executable without waiting for the startup timer', async () => {
    const config = options(); config.route.command = join(root, 'missing-opencode.exe');
    await expect(openCodeAuthMethods(config)).rejects.toThrow('iniciar el componente');
  });

  it('allows using the shown official URL if the browser opener fails and hooks are available', async () => {
    vi.mocked(openProviderLogin).mockRejectedValue(Error('Browser unavailable'));
    await expect(authenticateOpenCode(options('code'), 'opencode-oauth:openai:1', hooks())).resolves.toBeUndefined();
  });

  it('does not run callback without the required pasted code', async () => {
    const flow = hooks(); vi.mocked(flow.requestCode).mockResolvedValue('   ');
    await expect(authenticateOpenCode(options('code'), 'opencode-oauth:openai:1', flow)).rejects.toThrow('código de autorización válido');
    expect((await events()).some(item => item.path?.endsWith('/oauth/callback'))).toBe(false);
  });
});
