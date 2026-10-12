import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import type { HarnessInfo } from '../protocol';
import type { AuthHooks } from './harness';
import type { OpenCodeRoute } from './opencode';
import { killTree } from './env';
import { openProviderLogin, validateProviderLoginUrl } from './browser-login';
import { loginDeviceCode } from './cli-login';

type LoginRoute = { route: OpenCodeRoute; cwd: string; env: Record<string, string>; signal: AbortSignal; timeoutMs?: number };
type AuthRequest = (path: string, body?: unknown) => Promise<unknown>;
type AuthServer = { request: AuthRequest; signal: AbortSignal; expiresAt: number };

const AUTH_TIMEOUT_MS = 360_000;
const DISCOVERY_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 20_000;
const METHODS_MAX_BYTES = 512 * 1024;
const AUTHORIZATION_MAX_BYTES = 64 * 1024;
const PROVIDERS_MAX_BYTES = 16 * 1024 * 1024;

function authError(message: string): Error {
  const error = Error(message);
  error.name = 'OpenCodeAuthError';
  return error;
}

function waitFor<T>(signal: AbortSignal, action: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(signal.reason); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => {
      signal.throwIfAborted();
      return action();
    }).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

async function readJson(response: Response, limit: number, signal: AbortSignal): Promise<unknown> {
  const size = Number(response.headers.get('content-length'));
  if (Number.isFinite(size) && size > limit) throw authError('La respuesta de conexión de OpenCode es demasiado grande.');
  if (!response.body) throw authError('OpenCode devolvió una respuesta de conexión vacía.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await waitFor(signal, () => reader.read());
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) throw authError('La respuesta de conexión de OpenCode es demasiado grande.');
      chunks.push(chunk.value);
    }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw authError('OpenCode no devolvió una respuesta de conexión JSON válida.'); }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function authMethods(value: unknown): Record<string, unknown> {
  if (!record(value)) throw authError('OpenCode no devolvió métodos de conexión válidos.');
  return value;
}

function oauthMethod(value: unknown): value is Record<string, unknown> & { type: 'oauth'; label: string } {
  return record(value) && value.type === 'oauth' && typeof value.label === 'string' && value.label.trim().length > 0;
}

function needsInputs(method: Record<string, unknown>): boolean {
  return method.prompts !== undefined && (!Array.isArray(method.prompts) || method.prompts.length > 0);
}

async function withAuthServer<T>(options: LoginRoute, defaultTimeoutMs: number, action: (server: AuthServer) => Promise<T>): Promise<T> {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw authError('El tiempo de conexión de OpenCode es inválido.');
  const controller = new AbortController();
  const abort = () => controller.abort(authError('La conexión de OpenCode fue cancelada.'));
  options.signal.addEventListener('abort', abort, { once: true });
  if (options.signal.aborted) abort();
  const expiresAt = Date.now() + timeoutMs;
  const timer = setTimeout(() => controller.abort(authError('La conexión de OpenCode agotó el tiempo de espera. Volvé a intentar.')), timeoutMs);
  let child: ReturnType<typeof spawn> | undefined;
  let closed: Promise<void> | undefined;
  let hasClosed = false;
  let shuttingDown = false;
  try {
    await waitFor(controller.signal, () => mkdir(options.cwd, { recursive: true }));
    controller.signal.throwIfAborted();
    const password = randomBytes(24).toString('base64url');
    const process = spawn(options.route.command, [...(options.route.args ?? []).filter(arg => arg !== 'acp'), 'serve', '--hostname', '127.0.0.1', '--port', '0'], {
      cwd: options.cwd,
      env: { ...options.env, OPENCODE_SERVER_USERNAME: 'syka', OPENCODE_SERVER_PASSWORD: password },
      stdio: 'pipe', windowsHide: true, shell: false,
    });
    child = process;
    closed = new Promise<void>(resolve => process.once('close', () => {
      hasClosed = true;
      resolve();
      if (!shuttingDown) controller.abort(authError('OpenCode cerró su servicio de conexión.'));
    }));
    process.on('error', () => controller.abort(authError('No se pudo iniciar el componente de OpenCode.')));
    process.stdin!.on('error', () => controller.abort(authError('OpenCode cerró su servicio de conexión.')));
    process.stdin!.end();
    process.stderr!.resume();
    const base = await new Promise<string>((resolve, reject) => {
      let output = '';
      const startupTimer = setTimeout(() => { cleanup(); reject(authError('No se pudo preparar la conexión de OpenCode.')); }, REQUEST_TIMEOUT_MS);
      const cancel = () => { cleanup(); reject(controller.signal.reason); };
      const cleanup = () => {
        clearTimeout(startupTimer);
        controller.signal.removeEventListener('abort', cancel);
        process.stdout!.off('data', data);
        process.stdout!.resume();
      };
      const data = (chunk: string) => {
        output = (output + chunk).slice(-8192);
        const match = /http:\/\/127\.0\.0\.1:(\d+)(?=[ \t\r\n])/.exec(output);
        if (!match || Number(match[1]) < 1 || Number(match[1]) > 65535) return;
        cleanup(); resolve(`http://127.0.0.1:${match[1]}`);
      };
      process.stdout!.setEncoding('utf8');
      process.stdout!.on('data', data);
      controller.signal.addEventListener('abort', cancel, { once: true });
      if (controller.signal.aborted) cancel();
    });
    const request: AuthRequest = async (path, body) => {
      if (!/^\/provider(?:\/auth|\/[a-z0-9_.-]{1,100}\/oauth\/(?:authorize|callback))?$/i.test(path)) throw authError('Ruta de conexión inválida.');
      const requestController = new AbortController();
      const cancel = () => requestController.abort(controller.signal.reason);
      controller.signal.addEventListener('abort', cancel, { once: true });
      if (controller.signal.aborted) cancel();
      // The auto callback waits for the browser authorization; its limit is the total auth deadline.
      const requestTimer = path.endsWith('/oauth/callback') ? undefined : setTimeout(() => requestController.abort(authError('OpenCode no respondió a tiempo durante la conexión.')), REQUEST_TIMEOUT_MS);
      try {
        const response = await waitFor(requestController.signal, () => fetch(base + path, {
          method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: requestController.signal,
          headers: { Authorization: 'Basic ' + Buffer.from('syka:' + password).toString('base64'), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }));
        if (!response.ok) throw authError('OpenCode no pudo completar este método de conexión. Elegí otro método o reintentá.');
        return await readJson(response, path === '/provider/auth' ? METHODS_MAX_BYTES : path === '/provider' ? PROVIDERS_MAX_BYTES : AUTHORIZATION_MAX_BYTES, requestController.signal);
      } catch (error) {
        if (requestController.signal.aborted) throw requestController.signal.reason;
        if (error instanceof Error && error.name === 'OpenCodeAuthError') throw error;
        throw authError('No se pudo leer la respuesta de conexión de OpenCode.');
      } finally {
        clearTimeout(requestTimer);
        controller.signal.removeEventListener('abort', cancel);
        requestController.abort();
      }
    };
    return await waitFor(controller.signal, () => action({ request, signal: controller.signal, expiresAt }));
  } finally {
    shuttingDown = true;
    clearTimeout(timer);
    options.signal.removeEventListener('abort', abort);
    if (child && closed) {
      await killTree(child);
      if (!hasClosed && child.pid && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      let closeTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([closed, new Promise<never>((_, reject) => { closeTimer = setTimeout(() => reject(authError('OpenCode no pudo cerrar su servicio de conexión.')), 2_000); })]);
      } finally { clearTimeout(closeTimer); }
    }
  }
}

export async function openCodeAuthMethods(options: LoginRoute): Promise<NonNullable<HarnessInfo['authMethods']>> {
  return withAuthServer(options, DISCOVERY_TIMEOUT_MS, async ({ request }) => {
    const methods = authMethods(await request('/provider/auth'));
    return Object.entries(methods).filter(([id, items]) => /^[a-z0-9_.-]{1,100}$/i.test(id) && Array.isArray(items)).flatMap(([id, items]) => (items as unknown[]).slice(0, 1000).flatMap((method, index) => oauthMethod(method) && !needsInputs(method) ? [{
      id: `opencode-oauth:${id}:${index}`,
      label: `${method.label.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120)} · ${id}`,
    }] : []));
  });
}

export async function authenticateOpenCode(options: LoginRoute, methodId: string, hooks?: AuthHooks): Promise<void> {
  const match = /^opencode-oauth:([a-z0-9_.-]{1,100}):(\d{1,3})$/i.exec(methodId);
  if (!match) throw authError('Método de conexión de OpenCode inválido.');
  const provider = match[1]!, method = Number(match[2]);
  await withAuthServer(options, AUTH_TIMEOUT_MS, async ({ request, signal, expiresAt }) => {
    const methods = authMethods(await request('/provider/auth'));
    const items = Object.hasOwn(methods, provider) ? methods[provider] : undefined;
    const selected = Array.isArray(items) ? items[method] : undefined;
    if (!oauthMethod(selected)) throw authError('Este método de conexión ya no está disponible en OpenCode.');
    if (needsInputs(selected)) throw authError('Este método de OpenCode pide datos adicionales. Elegí otro método de conexión.');
    const authorization = await request(`/provider/${provider}/oauth/authorize`, { method });
    if (!record(authorization) || typeof authorization.method !== 'string' || !['auto', 'code'].includes(authorization.method) || typeof authorization.url !== 'string' || typeof authorization.instructions !== 'string') throw authError('OpenCode no devolvió una autorización válida.');
    const url = validateProviderLoginUrl('opencode', authorization.url);
    const userCode = loginDeviceCode(authorization.instructions);
    signal.throwIfAborted();
    hooks?.update({ phase: 'waiting', message: 'Autorizá la cuenta seleccionada en el navegador y volvé a Syka.', url, ...(userCode ? { userCode } : {}), expiresAt });
    try { await waitFor(signal, () => openProviderLogin('opencode', url)); }
    catch (error) { signal.throwIfAborted(); if (!hooks) throw error; }
    const code = authorization.method === 'code' ? (await waitFor(signal, () => hooks?.requestCode('Pegá el código que mostró el proveedor para completar la conexión de OpenCode.') ?? Promise.resolve(''))).trim() : undefined;
    if (authorization.method === 'code' && (!code || code.length > 8192)) throw authError('Este método necesita un código de autorización válido.');
    const callback = await request(`/provider/${provider}/oauth/callback`, { method, ...(code ? { code } : {}) });
    if (callback !== true) throw authError('OpenCode no confirmó la autorización de la cuenta.');
    signal.throwIfAborted();
    hooks?.update({ phase: 'verifying', message: 'Comprobando la cuenta conectada en OpenCode…' });
    const status = await request('/provider');
    if (!record(status) || !Array.isArray(status.connected) || !status.connected.every(id => typeof id === 'string') || !status.connected.includes(provider)) throw authError('OpenCode no confirmó la cuenta seleccionada.');
  });
}
