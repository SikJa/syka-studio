import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { isAbsolute, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { HarnessId } from '../protocol';
import type { AuthHooks } from './harness';
import { killTree } from './env';
import { openProviderLogin, validateProviderLoginUrl } from './browser-login';

type LoginTerminal = {
  write(value: string): void;
  kill(): void;
  onData(listener: (data: string) => void): { dispose(): void };
  onExit(listener: (event: { exitCode: number }) => void): { dispose(): void };
};
export type CliLoginOptions = {
  provider: HarnessId;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  signal: AbortSignal;
  hooks?: AuthHooks;
  terminal?: boolean;
  /** A TUI stays open after authorization; verify its own saved session. No inference. */
  verify?: () => Promise<boolean>;
  timeoutMs?: number;
};

export function cleanLoginOutput(value: string): string {
  return value.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '\n');
}
export function loginPageFromOutput(provider: HarnessId, output: string): string | undefined {
  // A provider may renew an expired authorization. Use the latest complete
  // official URL instead of keeping the first state's link forever.
  for (const match of [...cleanLoginOutput(output).matchAll(/https:\/\/[^\s<>"'\x00-\x1f]+/g)].reverse()) {
    const candidate = match[0].replace(/[).,;]+$/, '');
    if (candidate.length > 8192 || /\/docs(?:\/|$)|\/legal(?:\/|$)/i.test(candidate)) continue;
    try {
      const url = new URL(validateProviderLoginUrl(provider, candidate));
      const authPath = /(?:auth|login|signin|sign-in|device|activate|verify|connect)/i.test(url.pathname);
      const authQuery = [...url.searchParams.keys()].some(key => /^(?:client_id|redirect_uri|user_code|code|state|token)$/i.test(key));
      // A welcome message may mention the vendor homepage before its actual
      // sign-in URL. Only the authorization page should open automatically.
      if (authPath || authQuery) return url.href;
    } catch { /* Never open an arbitrary URL emitted by a program. */ }
  }
}
export function loginDeviceCode(output: string): string | undefined {
  return [...cleanLoginOutput(output).matchAll(/(?:user[ _-]?code|device[ _-]?code|enter(?: this)? code|c[oó]digo)\s*[:=]?\s*([A-Z0-9]{3,8}-[A-Z0-9]{3,8})\b/gi)].at(-1)?.[1];
}

/** Owns only the login subprocess. Credentials remain in the official provider's store. */
export async function runCliLogin(options: CliLoginOptions): Promise<void> {
  if (!isAbsolute(options.command) || !isAbsolute(options.cwd) || /\.(?:cmd|bat|ps1)$/i.test(options.command)) throw Error('No se encontró un componente oficial de conexión válido.');
  if (options.signal.aborted) throw Error('Conexión cancelada.');
  const timeout = options.timeoutMs ?? 360_000;
  const expiresAt = Date.now() + timeout;
  // Interactive tools reuse their native keyring at startup. Polling that
  // same old account cannot confirm a new login or an account replacement.
  if (options.terminal && options.verify && await options.verify()) throw Error('Este proveedor ya tiene una sesión activa. Volvé a comprobar la conexión; para cambiar de cuenta, elegila desde el proveedor.');
  if (options.signal.aborted) throw Error('Conexión cancelada.');
  await mkdir(options.cwd, { recursive: true });
  let terminal: LoginTerminal | undefined;
  let terminalExited = false, terminalClosed: Promise<void> | undefined, closedSubscription: { dispose(): void } | undefined;
  let child: ReturnType<typeof spawn> | undefined;
  if (options.terminal) {
    const moduleDir = options.env.SYKA_AUTH_TERMINAL_MODULE;
    if (!moduleDir || !isAbsolute(moduleDir)) throw Error('Falta preparar el componente de conexión. Volvé a conectar.');
    const native = createRequire(join(moduleDir, 'package.json'))(moduleDir);
    terminal = native.spawn(options.command, options.args, { name: 'xterm-256color', cols: 200, rows: 40, cwd: options.cwd, env: { ...options.env, TERM: 'xterm-256color' }, useConpty: true });
    terminalClosed = new Promise(resolve => { closedSubscription = terminal!.onExit(() => { terminalExited = true; resolve(); }); });
  } else {
    child = spawn(options.command, options.args, { cwd: options.cwd, env: options.env, stdio: 'pipe', windowsHide: true, shell: false });
    child.stdin!.on('error', () => {});
  }
  let shutdown: Promise<void> | undefined;
  try { await new Promise<void>((resolve, reject) => {
    let settled = false, killed = false, buffer = '', url: string | undefined, requestedCode = false, verifying = false;
    const streams: Record<string, string> = {};
    const dispose: Array<() => void> = [];
    const stop = () => { if (killed) return; killed = true; try { terminal?.kill(); } catch { /* Already exited. */ } if (child) shutdown = killTree(child); };
    const finish = (error?: Error) => {
      if (settled) return; settled = true;
      clearTimeout(timer); if (poll) clearInterval(poll);
      options.signal.removeEventListener('abort', abort); dispose.forEach(action => action()); stop();
      error ? reject(error) : resolve();
    };
    const abort = () => finish(Error('Conexión cancelada.'));
    const timer = setTimeout(() => finish(Error('El inicio de sesión venció. Volvé a conectar.')), Math.max(1, expiresAt - Date.now()));
    const verify = async () => {
      if (settled || verifying || !options.verify) return;
      verifying = true;
      try { if (await options.verify()) finish(); } catch { /* No saved account yet. */ }
      finally { verifying = false; }
    };
    // A normal command confirms completion by exiting. A TUI stays open;
    // its preflight established that there was no saved session to reuse.
    const poll = terminal && options.verify ? setInterval(() => void verify(), 2500) : undefined;
    const data = (chunk: string, source = 'terminal', ended = false) => {
      if (settled) return;
      buffer = (buffer + chunk).slice(-64 * 1024);
      const clean = cleanLoginOutput(buffer);
      streams[source] = ((streams[source] ?? '') + chunk).slice(-64 * 1024);
      const stream = cleanLoginOutput(streams[source]!);
      // Pipe/PTY chunks do not coincide with lines. Opening an unfinished URL
      // could lose OAuth state or launch the wrong page. Keep streams separate.
      const complete = ended ? stream : stream.slice(0, stream.lastIndexOf('\n') + 1);
      const found = loginPageFromOutput(options.provider, complete);
      if (found && found !== url) {
        url = found;
        const code = loginDeviceCode(clean);
        options.hooks?.update({ phase: 'waiting', message: code ? 'Abrí el enlace oficial e ingresá el código para vincular tu cuenta.' : 'Autorizá tu cuenta en el navegador y volvé a Syka.', url, ...(code ? { userCode: code } : {}), expiresAt });
        void openProviderLogin(options.provider, url).catch(() => {
          if (!settled) options.hooks?.update({ phase: 'waiting', message: 'Abrí el enlace oficial para completar la conexión.', url, expiresAt });
        });
      } else if (url) {
        const code = loginDeviceCode(clean);
        if (code) options.hooks?.update({ phase: 'waiting', message: 'Ingresá este código en la página del proveedor.', url, userCode: code, expiresAt });
      }
      if (!requestedCode && /(?:paste|enter|ingres[aá]|peg[aá]).{0,50}(?:authorization|authentication|verification|auth|autorizaci[oó]n|verificaci[oó]n)?\s*code\b|(?:peg[aá]|ingres[aá]).{0,30}c[oó]digo/i.test(clean) && !loginDeviceCode(clean)) {
        requestedCode = true;
        if (!options.hooks) return;
        void options.hooks.requestCode('Si el navegador te mostró un código de autorización, pegalo acá.').then(code => {
          if (settled || killed || options.signal.aborted) return;
          terminal ? terminal.write(code + '\r') : child!.stdin!.write(code + '\n');
        }).catch(error => finish(error instanceof Error ? error : Error('Conexión cancelada.')));
      }
      if (/authentication (?:failed|denied)|authorization denied|access_denied|invalid_grant/i.test(clean)) finish(Error('El proveedor rechazó la autorización. Volvé a conectar.'));
    };
    const exit = async (code: number | null) => {
      if (settled) return;
      killed = true; // The provider already exited; never close a ConPTY twice.
      for (const source of Object.keys(streams)) data('', source, true);
      if (code !== 0) return finish(Error('El componente de conexión no completó el login. Reintentá la conexión.'));
      if (options.verify) { try { if (!await options.verify()) return finish(Error('El proveedor no confirmó una sesión conectada.')); } catch { return finish(Error('No se pudo comprobar la cuenta después del login.')); } }
      finish();
    };
    options.signal.addEventListener('abort', abort, { once: true });
    if (options.signal.aborted) return abort();
    if (terminal) {
      const onData = terminal.onData(chunk => data(chunk)), onExit = terminal.onExit(event => void exit(event.exitCode));
      dispose.push(() => onData.dispose(), () => onExit.dispose());
    } else {
      // Keep stdin open: official login tools may ask for the browser's code.
      child!.stdout!.setEncoding('utf8'); child!.stderr!.setEncoding('utf8');
      child!.stdout!.on('data', chunk => data(chunk, 'stdout')); child!.stderr!.on('data', chunk => data(chunk, 'stderr'));
      child!.once('error', () => finish(Error('No se pudo iniciar el componente de conexión.')));
      child!.once('close', code => void exit(code));
    }
  }); } finally {
    await shutdown;
    if (terminalClosed && !terminalExited) {
      let closeTimer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([terminalClosed, new Promise<void>(resolve => { closeTimer = setTimeout(resolve, 2000); })]); }
      finally { if (closeTimer) clearTimeout(closeTimer); }
    }
    closedSubscription?.dispose();
  }
}
