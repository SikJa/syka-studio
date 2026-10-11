import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { CodexHarness } from '../src/host/codex';
import { validateCodexLoginUrl } from '../src/host/browser-login';
const state = vi.hoisted(() => ({ mode: '', browser: [] as string[] }));
vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return { ...actual, spawn: () => actual.spawn(process.execPath, [fileURLToPath(new URL('./fixtures/codex-login.mjs', import.meta.url)), state.mode], { stdio: 'pipe', windowsHide: true }) };
});
vi.mock('../src/host/env', async () => {
  const actual = await vi.importActual<typeof import('../src/host/env')>('../src/host/env');
  return { ...actual, resolveBinary: () => process.execPath, killTree: async (child: { kill(): void }) => { child.kill(); } };
});
vi.mock('../src/host/browser-login', async () => {
  const actual = await vi.importActual<typeof import('../src/host/browser-login')>('../src/host/browser-login');
  return { ...actual, openCodexLogin: async (url: string) => { state.browser.push(actual.validateCodexLoginUrl(url)); } };
});
beforeEach(() => { state.mode = ''; state.browser = []; });
const env = { env: {}, extraDirs: [] };
describe('official browser login without opening a browser or calling a provider', () => {
  it('offers browser sign-in and checks the account after completion', async () => {
    const harness = new CodexHarness();
    const signal = new AbortController().signal;
    const info = await harness.probe(env, signal);
    expect(info.status).toBe('signed-out');
    expect(info.authMethods?.[0].id).toBe('chatgpt-browser');
    await harness.authenticate(env, 'chatgpt-browser', signal);
    expect(state.browser).toEqual(['https://auth.openai.com/authorize?state=fixture']);
  });
  it('rejects failed authorization and non-official URLs', async () => {
    state.mode = 'failed';
    await expect(new CodexHarness().authenticate(env, 'chatgpt-browser', new AbortController().signal)).rejects.toThrow('No se completó');
    state.mode = 'evil-url'; state.browser = [];
    await expect(new CodexHarness().authenticate(env, 'chatgpt-browser', new AbortController().signal)).rejects.toThrow('oficial');
    expect(state.browser).toEqual([]);
    expect(() => validateCodexLoginUrl('https://auth.openai.com.evil.invalid/a')).toThrow();
    expect(() => validateCodexLoginUrl('https://user:secret@auth.openai.com/a')).toThrow();
    expect(() => validateCodexLoginUrl('file:///a')).toThrow();
  });
  it('cancels and shuts down a waiting login process', async () => {
    state.mode = 'wait'; const controller = new AbortController();
    const login = new CodexHarness().authenticate(env, 'chatgpt-browser', controller.signal);
    setTimeout(() => controller.abort(), 150);
    await expect(login).rejects.toThrow('cancelada');
  });
});
