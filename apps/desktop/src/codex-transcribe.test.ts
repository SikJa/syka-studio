import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => '', getAppPath: () => '', isPackaged: false }, safeStorage: {}, ipcMain: { handle: () => {} } }));

const { codexVoiceTarget, transcribeWithCodex, codexAuthFile } = await import('./codex-transcribe');

const jwt = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;

describe('codexVoiceTarget', () => {
  it('uses OpenAI with an API key', () => {
    expect(codexVoiceTarget(JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: 'sk-1' }))).toEqual({ style: 'openai', url: 'https://api.openai.com/v1/audio/transcriptions', credential: 'sk-1' });
    expect(codexVoiceTarget(JSON.stringify({ OPENAI_API_KEY: 'sk-2' }))?.style).toBe('openai');
  });
  it('uses ChatGPT with a session, taking the account from the token when missing', () => {
    const token = jwt({ 'https://api.openai.com/auth': { chatgpt_account_id: 'acc-9' } });
    expect(codexVoiceTarget(JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: token } }))).toEqual({ style: 'chatgpt', url: 'https://chatgpt.com/backend-api/transcribe', credential: token, account: 'acc-9' });
    expect(codexVoiceTarget(JSON.stringify({ tokens: { access_token: 'a.b.c', account_id: 'acc-1' } }))?.style).toBe('chatgpt');
  });
  it('returns null without a usable session', () => {
    expect(codexVoiceTarget(null)).toBeNull();
    expect(codexVoiceTarget('{')).toBeNull();
    expect(codexVoiceTarget(JSON.stringify({ auth_mode: 'apikey' }))).toBeNull();
    expect(codexVoiceTarget(JSON.stringify({ tokens: { access_token: 'no-claims' } }))).toBeNull();
  });
  it('reads auth.json from CODEX_HOME', () => {
    expect(codexAuthFile({ CODEX_HOME: 'C:\\codex' })).toMatch(/codex[\\/]auth\.json$/);
  });
});

describe('transcribeWithCodex', () => {
  it('sends the ChatGPT headers and returns the text', async () => {
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers['chatgpt-account-id']).toBe('acc');
      expect(headers.originator).toBe('syka');
      expect((init.body as FormData).get('model')).toBe('gpt-transcribe');
      return new Response(JSON.stringify({ text: ' hola mundo ' }), { status: 200 });
    });
    await expect(transcribeWithCodex({ style: 'chatgpt', url: 'https://chatgpt.com/backend-api/transcribe', credential: 't', account: 'acc' }, new Uint8Array(64), 'es', fetcher as never)).resolves.toBe('hola mundo');
  });
  it('explains a rejected session', async () => {
    const fetcher = async () => new Response('', { status: 401 });
    await expect(transcribeWithCodex({ style: 'openai', url: 'https://api.openai.com/v1/audio/transcriptions', credential: 'k' }, new Uint8Array(64), null, fetcher as never)).rejects.toThrow(/rechazó la sesión/);
  });
});
