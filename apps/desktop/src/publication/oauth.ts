import { createServer, type Server } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { auth, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import { OAuthTokensSchema } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { Credential, PublicationStore } from './store';
import { readJson } from './client';
export const MCP_ENDPOINT = 'https://mcp.zernio.com/mcp';
export const OAUTH_SCOPE = 'accounts:read posts:read posts:write';
export function trustedOAuthUrl(value: string | URL) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['zernio.com', 'mcp.zernio.com'].includes(url.hostname) || url.username || url.password || url.port) throw Error('El servidor OAuth devolvió un destino no autorizado.');
  return url;
}
export const oauthFetch: typeof fetch = async (input, init) => {
  trustedOAuthUrl(input instanceof Request ? input.url : String(input));
  return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });
};
export function validCallback(url: URL, expected: string, path: string) {
  const state = url.searchParams.get('state') || '';
  return url.pathname === path && Buffer.byteLength(state) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(state), Buffer.from(expected)) &&
    (!url.searchParams.has('iss') || url.searchParams.get('iss') === 'https://zernio.com');
}

/** Loopback callbacks, codes and PKCE verifier stay in main. */
export class ZernioOAuth {
  private pending = new Map<string, { server: Server; cancel(): void }>();
  private readonly store: PublicationStore;
  private readonly open: (url: string) => Promise<void>;
  private readonly completed: (id: string, error: string | null) => Promise<void>;
  constructor(store: PublicationStore, open: (url: string) => Promise<void>, completed: (id: string, error: string | null) => Promise<void>) { this.store = store; this.open = open; this.completed = completed; }
  isPending(id: string) { return this.pending.has(id); }
  cancel(id: string) { this.pending.get(id)?.cancel(); }
  close() { for (const id of this.pending.keys()) this.cancel(id); }
  async begin(id: string) {
    if (this.pending.has(id)) throw Error('Esta conexión ya tiene un inicio de sesión en curso.');
    const state = randomBytes(32).toString('hex');
    const callbackPath = `/callback/${randomBytes(16).toString('hex')}`;
    let verifier = '', handling = false, stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error: string | null) => {
      if (stopped) return; stopped = true;
      clearTimeout(timer); this.pending.delete(id); server.close();
      void this.completed(id, error).catch(() => {});
    };
    const server = createServer((request, response) => {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      response.setHeader('Cache-Control', 'no-store');
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (request.method !== 'GET' || !validCallback(url, state, callbackPath) || handling || stopped) { response.statusCode = 400; response.end('Respuesta de autorización inválida.'); return; }
      handling = true;
      if (url.searchParams.has('error') || !url.searchParams.get('code')) { response.end('Autorización cancelada. Podés volver a Syka.'); finish('No se completó la autorización de Zernio.'); return; }
      response.end('<html><body style="background:#181818;color:#ddd;font:16px system-ui;padding:48px">Volvé a Syka para ver el resultado de la conexión.</body></html>');
      void auth(provider, { serverUrl: MCP_ENDPOINT, authorizationCode: url.searchParams.get('code')!, scope: OAUTH_SCOPE, fetchFn: oauthFetch })
        .then(result => finish(result === 'AUTHORIZED' ? null : 'Zernio no confirmó la autorización.'))
        .catch(() => finish('No se pudo completar OAuth. Podés reintentar o usar una API key.'));
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); });
    const address = server.address();
    if (!address || typeof address === 'string') { server.close(); throw Error('No se pudo abrir el callback local.'); }
    const redirectUrl = `http://127.0.0.1:${address.port}${callbackPath}`;
    try { await this.store.saveCredential(id, { method: 'oauth', redirectUrl }); }
    catch (error) { server.close(); throw error; }
    const provider: OAuthClientProvider = {
      redirectUrl,
      clientMetadata: { client_name: 'Syka Studio', redirect_uris: [redirectUrl], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', scope: OAUTH_SCOPE },
      state: () => state,
      clientInformation: async () => (await this.oauthCredential(id)).client,
      saveClientInformation: async client => { const c = await this.oauthCredential(id); if (stopped) throw Error('OAuth cancelado.'); await this.store.saveCredential(id, { ...c, client }); },
      tokens: async () => (await this.oauthCredential(id)).tokens,
      saveTokens: async tokens => {
        if (stopped) throw Error('OAuth cancelado.');
        const c = await this.oauthCredential(id);
        if (stopped) throw Error('OAuth cancelado.');
        await this.store.saveCredential(id, { ...c, tokens, expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000 });
      },
      redirectToAuthorization: async url => { if (stopped) throw Error('OAuth cancelado.'); await this.open(trustedOAuthUrl(url).href); },
      saveCodeVerifier: value => { verifier = value; },
      codeVerifier: () => { if (!verifier || stopped) throw Error('La autorización expiró.'); return verifier; },
    };
    this.pending.set(id, { server, cancel: () => finish('Inicio de sesión cancelado. Podés reintentar con una conexión nueva.') });
    timer = setTimeout(() => finish('El inicio de sesión expiró. Volvé a conectar Zernio.'), 10 * 60_000);
    timer.unref();
    try { const result = await auth(provider, { serverUrl: MCP_ENDPOINT, scope: OAUTH_SCOPE, fetchFn: oauthFetch }); if (result === 'AUTHORIZED') finish(null); }
    catch { finish('No se pudo iniciar OAuth con Zernio. Podés usar una API key.'); }
  }
  private async oauthCredential(id: string): Promise<Extract<Credential, { method: 'oauth' }>> {
    const c = await this.store.credential(id); if (!c || c.method !== 'oauth') throw Error('Conexión OAuth no configurada.'); return c;
  }
  private refreshing = new Map<string, Promise<string>>();
  async token(id: string): Promise<string> {
    const c = await this.store.credential(id);
    if (!c) throw Error('Configurá una conexión de Zernio.');
    if (c.method === 'api_key') return c.key;
    if (!c.tokens) throw Error('Completá el inicio de sesión de Zernio.');
    if ((c.expiresAt ?? 0) > Date.now() + 60_000) return c.tokens.access_token;
    const current = this.refreshing.get(id); if (current) return current;
    const task = this.refresh(id, c).finally(() => this.refreshing.delete(id));
    this.refreshing.set(id, task); return task;
  }
  private async refresh(id: string, c: Extract<Credential, { method: 'oauth' }>) {
    if (!c.tokens?.refresh_token || !c.client) throw Error('La sesión de Zernio expiró. Volvé a iniciar sesión.');
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.tokens.refresh_token, client_id: c.client.client_id, resource: MCP_ENDPOINT });
    const response = await oauthFetch('https://zernio.com/api/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!response.ok) throw Error('La sesión de Zernio expiró o fue revocada. Volvé a conectar esta cuenta.');
    const tokens = OAuthTokensSchema.parse(await readJson(response));
    const previous = await this.oauthCredential(id);
    await this.store.saveCredential(id, { ...previous, tokens: { ...tokens, refresh_token: tokens.refresh_token ?? previous.tokens?.refresh_token }, expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000 });
    return tokens.access_token;
  }
}
