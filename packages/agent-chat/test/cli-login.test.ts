import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCliLogin, loginPageFromOutput, antigravityGoogleLoginPrompt } from '../src/host/cli-login';
import type { CliLoginOptions } from '../src/host/cli-login';

const browser = vi.hoisted(() => ({ opened: [] as string[] }));
vi.mock('../src/host/browser-login', async () => {
  const actual = await vi.importActual<typeof import('../src/host/browser-login')>('../src/host/browser-login');
  return { ...actual, openProviderLogin: async (provider: Parameters<typeof actual.validateProviderLoginUrl>[0], url: string) => { browser.opened.push(actual.validateProviderLoginUrl(provider, url)); } };
});
let cwd: string;
beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), 'syka-cli-login-test-')); browser.opened = []; });
afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });
const fixture = fileURLToPath(new URL('./fixtures/cli-login.mjs', import.meta.url));
function options(mode: string, extra: Partial<CliLoginOptions> = {}): CliLoginOptions {
  return { provider: 'codex', command: process.execPath, args: [fixture, mode, join(cwd, 'receipt.txt')], cwd, env: process.env as Record<string, string>, signal: new AbortController().signal, timeoutMs: 5000, ...extra };
}
describe('official CLI login subprocess', () => {
  it('recognizes the official Google choice without accepting a Cloud or workspace prompt', () => {
    expect(antigravityGoogleLoginPrompt('Select login method:\r\n > 1. Google OAuth\r\n   2. Use a Google Cloud project\r\n\r\n   ↑/↓ Navigate · enter Select')).toBe(true);
    expect(antigravityGoogleLoginPrompt('Select login method:\n 1. Google OAuth\n > 2. Use a Google Cloud project\n ↑/↓ Navigate · enter Select')).toBe(false);
    expect(antigravityGoogleLoginPrompt('Trust this workspace? > 1. Yes\n enter Select')).toBe(false);
  });
  it('advances the hidden Antigravity OAuth selector once and exposes its real URL', async () => {
    const moduleDir=join(cwd,'google-terminal'); await mkdir(moduleDir);
    await writeFile(join(moduleDir,'package.json'),'{"main":"index.cjs"}');
    await writeFile(join(moduleDir,'index.cjs'), `
      const {writeFileSync}=require('node:fs');
      const screen='Select login method:\\r\\n > 1. Google OAuth\\r\\n   2. Use a Google Cloud project\\r\\n   ↑/↓ Navigate · enter Select';
      exports.spawn=()=>{ let data, exits=new Set(), keys=[];
        return {write(key){keys.push(key);writeFileSync(${JSON.stringify(join(cwd,'keys.json'))},JSON.stringify(keys));setTimeout(()=>{data(screen);data('\\nhttps://accounts.google.com/o/oauth2/v2/auth?state=fixture\\n');},5);},
          kill(){for(const fn of [...exits])fn({exitCode:0});},
          onData(fn){data=fn;setTimeout(()=>{fn(screen.slice(0,40));fn(screen.slice(40));},10);return {dispose(){}};},
          onExit(fn){exits.add(fn);return {dispose(){exits.delete(fn);}};}};
      };`);
    const update=vi.fn(), verify=vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    await runCliLogin(options('wait',{provider:'antigravity',terminal:true,env:{...process.env,SYKA_AUTH_TERMINAL_MODULE:moduleDir} as Record<string,string>,verify,hooks:{update,requestCode:vi.fn()}}));
    expect(JSON.parse(await readFile(join(cwd,'keys.json'),'utf8'))).toEqual(['\r']);
    expect(browser.opened).toEqual(['https://accounts.google.com/o/oauth2/v2/auth?state=fixture']);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({phase:'waiting',url:browser.opened[0]}));
  });
  it('waits for a complete URL across chunks and keeps stderr separate', async () => {
    const update = vi.fn();
    await runCliLogin(options('split', { hooks: { update, requestCode: vi.fn() } }));
    expect(browser.opened).toEqual(['https://auth.openai.com/authorize?state=fixture-complete']);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ userCode: 'ABCD-EFGH' }));
  });
  it('opens renewed authorization links and codes without extending the deadline', async () => {
    const update = vi.fn();
    await runCliLogin(options('renew', { hooks: { update, requestCode: vi.fn() } }));
    expect(browser.opened).toEqual(['https://auth.openai.com/authorize?state=old', 'https://auth.openai.com/authorize?state=new']);
    const messages = update.mock.calls.map(([message]) => message);
    expect(messages.at(-1)).toMatchObject({ url: 'https://auth.openai.com/authorize?state=new', userCode: 'NEW1-CODE' });
    expect(new Set(messages.map(message => message.expiresAt)).size).toBe(1);
  });
  it('does not mistake an existing TUI session for a newly completed login', async () => {
    const verify = vi.fn(async () => true);
    await expect(runCliLogin(options('wait', { terminal: true, verify }))).rejects.toThrow('sesión activa');
    expect(verify).toHaveBeenCalledOnce();
    expect(browser.opened).toEqual([]);
  });
  it('waits for a newly saved TUI session and closes its owned terminal before returning', async () => {
    const moduleDir = join(cwd, 'terminal');
    await mkdir(moduleDir);
    await writeFile(join(moduleDir, 'package.json'), '{"main":"index.cjs"}');
    await writeFile(join(moduleDir, 'index.cjs'), `
      const { writeFileSync } = require('node:fs');
      exports.spawn = () => {
        const exits = new Set();
        return { write() {}, kill() { setTimeout(() => { writeFileSync(${JSON.stringify(join(cwd, 'closed.txt'))}, 'closed'); for (const fn of [...exits]) fn({exitCode: 0}); }, 80); },
          onData() { return { dispose() {} }; }, onExit(fn) { exits.add(fn); return { dispose() { exits.delete(fn); } }; } };
      };`);
    const verify = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    await runCliLogin(options('wait', { terminal: true, env: { ...process.env, SYKA_AUTH_TERMINAL_MODULE: moduleDir } as Record<string, string>, verify }));
    expect(verify).toHaveBeenCalledTimes(2);
    expect(await readFile(join(cwd, 'closed.txt'), 'utf8')).toBe('closed');
  });
  it('accepts a browser code in Syka and writes it literally to the provider stdin', async () => {
    const code = 'fixture-code-$literal-command';
    const requestCode = vi.fn(async () => code);
    await runCliLogin(options('code', { provider: 'claude', hooks: { update: vi.fn(), requestCode } }));
    expect(requestCode).toHaveBeenCalledOnce();
    expect(await readFile(join(cwd, 'receipt.txt'), 'utf8')).toBe(code);
    expect(browser.opened).toEqual(['https://claude.com/cai/oauth/authorize?state=fixture']);
  });
  it('only opens official authentication hosts and skips docs', () => {
    expect(loginPageFromOutput('codex', 'https://auth.openai.com.evil.invalid/a\nhttps://auth.openai.com/docs/login\n')).toBeUndefined();
    expect(loginPageFromOutput('claude', 'https://user:secret@claude.ai/oauth\n')).toBeUndefined();
    expect(loginPageFromOutput('claude', 'https://claude.com.evil.invalid/cai/oauth/authorize\n')).toBeUndefined();
    expect(loginPageFromOutput('claude', 'https://claude.com/cai/oauth/authorize?state=fixture\n')).toBe('https://claude.com/cai/oauth/authorize?state=fixture');
    expect(loginPageFromOutput('opencode', 'https://claude.com/cai/oauth/authorize?state=fixture\n')).toBe('https://claude.com/cai/oauth/authorize?state=fixture');
    expect(loginPageFromOutput('codex', 'https://auth.openai.com/codex/device\n')).toBe('https://auth.openai.com/codex/device');
    expect(loginPageFromOutput('cursor', 'Learn about https://cursor.com/cli\nOpen https://cursor.com/login?state=fixture\n')).toBe('https://cursor.com/login?state=fixture');
  });
  it('rejects a denied authorization and closes its own subprocess', async () => {
    await expect(runCliLogin(options('failed'))).rejects.toThrow('rechazó');
  });
  it('cancels a waiting subprocess and handles an already aborted request', async () => {
    const controller = new AbortController();
    const pending = runCliLogin(options('wait', { signal: controller.signal }));
    setTimeout(() => controller.abort(), 150);
    await expect(pending).rejects.toThrow('cancelada');
    await expect(runCliLogin(options('wait', { signal: controller.signal }))).rejects.toThrow('cancelada');
  });
  it('expires a stalled login', async () => {
    await expect(runCliLogin(options('wait', { timeoutMs: 150 }))).rejects.toThrow('venció');
  });
  it('rejects an unsuccessful command even when an older account exists', async () => {
    const verify = vi.fn(async () => true);
    await expect(runCliLogin(options('nonzero', { verify }))).rejects.toThrow('no completó');
    expect(verify).not.toHaveBeenCalled();
  });
  it('waits for the new login command to finish before checking an existing account', async () => {
    const verify = vi.fn(async () => true);
    await runCliLogin(options('existing-account', { provider: 'claude', verify }));
    expect(verify).toHaveBeenCalledOnce();
    expect(await readFile(join(cwd, 'receipt.txt'), 'utf8')).toBe('new-login-completed');
  });
  it('rejects shell shims and an unprepared terminal without starting a login', async () => {
    await expect(runCliLogin(options('wait', { command: join(cwd, 'login.cmd') }))).rejects.toThrow('oficial');
    await expect(runCliLogin(options('wait', { terminal: true, env: {} }))).rejects.toThrow('preparar');
  });
});
