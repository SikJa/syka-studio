import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID, createHash } from 'node:crypto';
import { PublicationStore } from './store';
import { PublicationService } from './service';
import { publicHttps, safeMessage, ZernioClient } from './client';
import { MCP_ENDPOINT, OAUTH_SCOPE, ZernioOAuth, trustedOAuthUrl, validCallback } from './oauth';
import type { DraftChanges } from './types';

const folders: string[] = [];
const testTempRoot = resolve(tmpdir());
afterEach(async () => {
  vi.useRealTimers(); vi.unstubAllGlobals();
  await Promise.all(folders.splice(0).map(path => {
    const target = resolve(path);
    if (dirname(target) !== testTempRoot || !basename(target).startsWith('syka-publication-')) throw Error('La limpieza de QA salió de su carpeta temporal.');
    return rm(target, { recursive: true, force: true });
  }));
});
const key = `sk_${'a'.repeat(64)}`;
async function setup(options: { responseLost?: boolean; status?: number; conflictCode?: string; ownerChanged?: boolean; upload?: () => Promise<void>; canPost?: boolean } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'syka-publication-')); folders.push(dir);
  const encryptionKey = randomBytes(32);
  const codec = {
    available: () => true,
    encrypt: (text: string) => { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv); const bytes = Buffer.concat([cipher.update(text), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), bytes]); },
    decrypt: (bytes: Buffer) => { const cipher = createDecipheriv('aes-256-gcm', encryptionKey, bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(12, 28)); return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString(); },
  };
  const store = new PublicationStore(join(dir, 'data'), codec);
  const file = join(dir, 'video.mp4'); await writeFile(file, 'synthetic-fixture-no-real-media');
  const payloads: { key: string | null; body: unknown }[] = [];
  let lost = !!options.responseLost, reads = 0;
  const fetcher = vi.fn(async (url: any, init: any) => {
    const path = new URL(String(url)).pathname;
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (path.endsWith('/auth/verify')) return json({ valid: true, userId: options.ownerChanged && reads++ > 0 ? 'owner-b' : 'owner-a', name: 'Fixture owner' });
    if (path.endsWith('/accounts/health')) return json({ accounts: [{ accountId: 'channel', platform: 'youtube', status: 'healthy', canPost: options.canPost ?? true }, { accountId: 'reels', platform: 'instagram', status: 'healthy', canPost: true }] });
    if (path.endsWith('/accounts')) return json({ accounts: [{ _id: 'channel', platform: 'youtube', username: 'fixture-channel', isActive: true }, { _id: 'reels', platform: 'instagram', username: 'fixture-reels', isActive: true }] });
    if (path.endsWith('/media/presign')) return json({ uploadUrl: 'https://fixture.r2.cloudflarestorage.com/video.mp4?signature=fixture', publicUrl: 'https://media.zernio.com/temp/video.mp4' });
    if (path.endsWith('/posts') && init?.method === 'POST') {
      payloads.push({ key: init.headers['Idempotency-Key'], body: JSON.parse(init.body) });
      if (lost) { lost = false; throw Error('lost response'); }
      if (options.status === 400) return json({ error: 'Fix the content' }, 400);
      if (options.status === 409) return new Response(JSON.stringify({ code: options.conflictCode ?? 'idempotency_conflict', error: 'Processing' }), { status: 409, headers: { 'retry-after': '10' } });
      const target = JSON.parse(init.body).platforms[0];
      return json({ post: { _id: 'provider-post', status: options.status === 207 ? 'failed' : 'published', platforms: [{ platform: target.platform, accountId: target.accountId, status: options.status === 207 ? 'failed' : 'published', ...(options.status === 207 ? { errorMessage: 'Platform refused' } : { platformPostUrl: 'https://www.youtube.com/watch?v=fixture' }) }] } }, options.status ?? 201);
    }
    if (path.endsWith('/posts/provider-post')) return json({ post: { _id: 'provider-post', status: 'published', platforms: [{ platform: 'youtube', accountId: 'channel', status: 'published' }] } });
    throw Error(`Unexpected path ${path}`);
  }) as unknown as typeof fetch;
  const upload = vi.fn(options.upload ?? (async () => {}));
  const service = new PublicationService(store, async () => {}, { fetcher, inspect: async path => ({ path, name: 'video.mp4', size: 31, mime: 'video/mp4', sha256: createHash('sha256').update(await readFile(path)).digest('hex'), duration: 15, width: 1080, height: 1920, videoCodec: 'avc' }), upload });
  return { service, store, codec, dir, file, fetcher, payloads, upload };
}
async function prepared(fixture: Awaited<ReturnType<typeof setup>>) {
  const id = await fixture.service.addConnection('Fixture', key); await fixture.service.sync(id); await fixture.service.createDraft(fixture.file);
  const d = (await fixture.store.snapshot()).drafts[0]!;
  const changes: DraftChanges = { connectionId: id, target: { accountId: 'channel', platform: 'youtube', username: 'fixture-channel' }, title: 'Fixture', text: 'A reviewed caption', timing: { mode: 'now' }, visibility: 'private', madeForKids: false, syntheticMedia: false };
  await fixture.service.saveDraft(d.id, d.revision, changes);
  return (await fixture.store.snapshot()).drafts[0]!;
}

describe('publication boundaries and persistence (local fixtures only)', () => {
  it('saving credentials never calls the provider and never persists the key in plaintext', async () => {
    const f = await setup(); const id = await f.service.addConnection('Brand A', key);
    expect(f.fetcher).not.toHaveBeenCalled();
    expect(await readFile(join(f.dir, 'data', 'state.json'), 'utf8')).not.toContain(key);
    expect((await readFile(join(f.dir, 'data', `${id}.credential`))).includes(Buffer.from(key))).toBe(false);
    expect(await f.store.credential(id)).toMatchObject({ key });
    expect(JSON.stringify(await f.service.overview())).not.toContain(key);
  });
  it('blocks credential saving without secure storage, including any plaintext fallback', async () => {
    const f = await setup(); const store = new PublicationStore(join(f.dir, 'blocked'), { ...f.codec, available: () => false });
    await expect(new PublicationService(store, async () => {}).addConnection('A', key)).rejects.toThrow('seguro');
  });
  it('keeps a credential in place while a verification request is still running', async () => {
    const f = await setup(), id = await f.service.addConnection('Fixture', key);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(f.fetcher).mockImplementationOnce(async () => { await gate; return new Response(JSON.stringify({ valid: true, userId: 'owner-a', name: 'Fixture' })); });
    const reading = f.service.sync(id);
    try {
      await vi.waitFor(() => expect(f.fetcher).toHaveBeenCalled());
      await expect(f.service.disconnect(id)).rejects.toThrow('termine'); expect(await f.store.credential(id)).toMatchObject({ key });
    } finally { release(); await reading; }
    await f.service.disconnect(id); expect(await f.store.credential(id)).toBeNull();
  });
  it('separates connections even when social account ids match, and persists local drafts across restart', async () => {
    const f = await setup(); await prepared(f); const second = await f.service.addConnection('Brand B', `zrk_${'b'.repeat(64)}`); await f.service.sync(second);
    const reloaded = new PublicationService(new PublicationStore(join(f.dir, 'data'), f.codec), async () => {}, { fetcher: f.fetcher });
    const data = await reloaded.overview(); expect(data.connections).toHaveLength(2); expect(data.drafts).toHaveLength(1);
    expect(data.drafts[0]!.connectionId).not.toBe(second); expect(data.drafts[0]!.externalPostId).toBeNull(); expect(f.payloads).toHaveLength(0); expect(f.upload).not.toHaveBeenCalled();
  });
  it('rejects stale edits and forged destination bindings without altering the media path', async () => {
    const f = await setup(); const d = await prepared(f);
    await expect(f.service.submit(d.id, undefined as any)).rejects.toThrow('revisión'); expect(f.payloads).toHaveLength(0);
    await expect(f.service.saveDraft(d.id, d.revision - 1, d)).rejects.toThrow('cambió');
    await expect(f.service.saveDraft(d.id, d.revision, { ...d, target: { accountId: 'another', platform: 'youtube', username: 'other' } })).rejects.toThrow('pertenece');
    await f.service.saveDraft(d.id, d.revision, { ...d, media: { path: 'evil' }, phase: 'remote', externalPostId: 'forged' } as any);
    const current = (await f.store.snapshot()).drafts[0]!; expect(current.media.path).toBe(f.file); expect(current.externalPostId).toBeNull();
    await expect(f.service.deleteDraft(d.id, d.revision)).rejects.toThrow('cambió');
  });
  it('preserves a corrupt store instead of resetting data', async () => {
    const f = await setup(); await f.service.addConnection('Fixture', key); const path = join(f.dir, 'data', 'state.json'); await writeFile(path, '{broken');
    await expect(f.store.snapshot()).rejects.toThrow('dañado'); expect(await readFile(path, 'utf8')).toBe('{broken');
  });
  it('replays the same durable payload and key after response loss and a new service instance', async () => {
    const f = await setup({ responseLost: true }); let d = await prepared(f); d.media.size = (await readFile(f.file)).length; await f.store.mutate(s => { s.drafts[0]!.media.size = d.media.size; });
    await expect(f.service.submit(d.id, d.revision)).rejects.toThrow('confirmar');
    const failed = (await f.store.snapshot()).drafts[0]!; expect(failed.phase).toBe('submitting_unknown'); expect(failed.attempt?.key).toBeTruthy();
    const reloaded = new PublicationService(f.store, async () => {}, { fetcher: f.fetcher, upload: f.upload });
    await reloaded.submit(failed.id, failed.revision);
    expect(f.payloads).toHaveLength(2); expect(f.payloads[0]).toEqual(f.payloads[1]); expect(f.upload).toHaveBeenCalledTimes(1);
    const result = (await reloaded.overview()).drafts[0]!; expect(result.externalPostId).toBe('provider-post'); expect(result.attempt?.key).toBe('');
  });
  it('retains an ambiguous original attempt when authentication fails before a replay', async () => {
    const f = await setup({ responseLost: true }), d = await prepared(f);
    await expect(f.service.submit(d.id, d.revision)).rejects.toThrow('confirmar');
    const original = (await f.store.snapshot()).drafts[0]!;
    vi.mocked(f.fetcher).mockImplementationOnce(async () => new Response(JSON.stringify({ error: 'Expired token' }), { status: 401 }));
    await expect(f.service.submit(original.id, original.revision)).rejects.toThrow('credencial');
    const current = (await f.store.snapshot()).drafts[0]!;
    expect(current.phase).toBe('submitting_unknown'); expect(current.attempt).toEqual(original.attempt); expect(f.payloads).toHaveLength(1);
  });
  it('treats HTTP 207 as a provider failure and records per-destination errors', async () => {
    const f = await setup({ status: 207 }); const d = await prepared(f); await f.store.mutate(s => { s.drafts[0]!.media.size = 31; });
    await f.service.submit(d.id, d.revision); const current = (await f.service.overview()).drafts[0]!;
    expect(current.providerStatus).toBe('failed'); expect(current.results[0]!.error).toBe('Platform refused'); expect(current.externalPostId).toBeTruthy();
  });
  it('uses the documented automatic Reel behavior and rejects incompatible media before upload', async () => {
    const f = await setup(), d = await prepared(f);
    await f.service.saveDraft(d.id, d.revision, { ...d, target: { accountId: 'reels', platform: 'instagram', username: 'fixture-reels' } });
    let current = (await f.store.snapshot()).drafts[0]!;
    await f.store.mutate(s => { s.drafts[0]!.media.videoCodec = 'vp9'; });
    await expect(f.service.submit(current.id, current.revision)).rejects.toThrow('H.264'); expect(f.upload).not.toHaveBeenCalled();
    await f.store.mutate(s => { s.drafts[0]!.media.videoCodec = 'avc'; s.drafts[0]!.media.width = 1080; s.drafts[0]!.media.height = 1350; });
    current = (await f.store.snapshot()).drafts[0]!;
    await expect(f.service.submit(current.id, current.revision)).rejects.toThrow('9:16'); expect(f.upload).not.toHaveBeenCalled();
    await f.store.mutate(s => { s.drafts[0]!.media.height = 1920; }); current = (await f.store.snapshot()).drafts[0]!;
    await f.service.submit(current.id, current.revision);
    expect(f.payloads[0]!.body).toMatchObject({ platforms: [{ platform: 'instagram', accountId: 'reels', platformSpecificData: { shareToFeed: true } }] });
    expect(JSON.stringify(f.payloads[0]!.body)).not.toContain('contentType');
  });
  it('blocks a changed export before presign or post creation', async () => {
    const f = await setup(); const d = await prepared(f); await writeFile(f.file, 'changed');
    await expect(f.service.submit(d.id, d.revision)).rejects.toThrow('cambió'); expect(f.upload).not.toHaveBeenCalled(); expect(f.payloads).toHaveLength(0);
  });
  it('blocks sending when the owner changed or posting permissions are unknown', async () => {
    const f = await setup({ ownerChanged: true }); const d = await prepared(f);
    await expect(f.service.submit(d.id, d.revision)).rejects.toThrow('identidad'); expect(f.payloads).toHaveLength(0);
    const other = await setup({ canPost: false }); const blocked = await prepared(other); await expect(other.service.submit(blocked.id, blocked.revision)).rejects.toThrow('permiso');
  });
  it('revalidates scheduling after upload so a passed date cannot silently publish now', async () => {
    const f = await setup({ upload: async () => { vi.setSystemTime(Date.now() + 11 * 60_000); } }); const d = await prepared(f);
    await f.store.mutate(s => { s.drafts[0]!.media.size = 31; s.drafts[0]!.timing = { mode: 'schedule', atUtc: new Date(Date.now() + 10 * 60_000).toISOString(), timezone: 'America/Buenos_Aires' }; });
    vi.useFakeTimers({ toFake: ['Date'] }); await expect(f.service.submit(d.id, d.revision)).rejects.toThrow('cinco minutos'); expect(f.upload).toHaveBeenCalledTimes(1); expect(f.payloads).toHaveLength(0);
  });
  it('prevents concurrent double submission and permits cancellation while uploading', async () => {
    let release!: () => void;
    const f = await setup({ upload: async () => new Promise(resolve => { release = resolve; }) }); const d = await prepared(f); await f.store.mutate(s => { s.drafts[0]!.media.size = 31; });
    const first = f.service.submit(d.id, d.revision); await vi.waitFor(() => expect(f.upload).toHaveBeenCalled());
    await expect(f.service.submit(d.id, d.revision)).rejects.toThrow('en curso'); f.service.cancelUpload(d.id); release(); await expect(first).rejects.toThrow('cancelado'); expect(f.payloads).toHaveLength(0);
  });
  it('keeps the idempotency attempt on 409 in-progress and respects its retry time', async () => {
    const f = await setup({ status: 409 }); const d = await prepared(f); await f.store.mutate(s => { s.drafts[0]!.media.size = 31; });
    await expect(f.service.submit(d.id, d.revision)).rejects.toThrow(); const current = (await f.store.snapshot()).drafts[0]!;
    expect(current.phase).toBe('submitting_unknown'); expect(current.attempt).not.toBeNull(); expect(current.retryAfterAt).toBeGreaterThan(Date.now());
    await expect(f.service.submit(current.id, current.revision)).rejects.toThrow('esperar'); expect(f.payloads).toHaveLength(1);
  });
  it('preserves the attempt when a 409 cannot be classified safely', async () => {
    const f = await setup({ status: 409, conflictCode: 'unknown_conflict' }); const d = await prepared(f);
    await expect(f.service.submit(d.id, d.revision)).rejects.toThrow(); const current = (await f.store.snapshot()).drafts[0]!;
    expect(current.phase).toBe('submitting_unknown'); expect(current.attempt).not.toBeNull();
  });
  it('allows correcting a definitive 400 but refuses to edit an ambiguous attempt', async () => {
    const f = await setup({ status: 400 }); const d = await prepared(f); await f.store.mutate(s => { s.drafts[0]!.media.size = 31; }); await expect(f.service.submit(d.id, d.revision)).rejects.toThrow();
    const current = (await f.store.snapshot()).drafts[0]!; expect(current.attempt).toBeNull(); await f.service.saveDraft(d.id, current.revision, { ...d, title: 'Corrected' });
    const lost = await setup({ responseLost: true }); const unknown = await prepared(lost); await lost.store.mutate(s => { s.drafts[0]!.media.size = 31; }); await expect(lost.service.submit(unknown.id, unknown.revision)).rejects.toThrow();
    const pending = (await lost.store.snapshot()).drafts[0]!; await expect(lost.service.saveDraft(pending.id, pending.revision, pending)).rejects.toThrow('empezó');
  });
});
describe('OAuth and HTTP boundaries', () => {
  it('registers a public client, exchanges PKCE through a checked loopback callback and encrypts its tokens', async () => {
    const f = await setup(), id = randomUUID(), localFetch = globalThis.fetch;
    const open = vi.fn(async (_url: string) => {}), completed = vi.fn(async (_id: string, _error: string | null) => {});
    const oauth = new ZernioOAuth(f.store, open, completed);
    const requests: { url: URL; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input)); requests.push({ url, init });
      const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
      if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) return json({ resource: MCP_ENDPOINT, authorization_servers: ['https://zernio.com'], scopes_supported: OAUTH_SCOPE.split(' ') });
      if (url.pathname === '/.well-known/oauth-authorization-server') return json({ issuer: 'https://zernio.com', authorization_endpoint: 'https://zernio.com/oauth/authorize', token_endpoint: 'https://zernio.com/api/oauth/token', registration_endpoint: 'https://zernio.com/api/oauth/register', response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'] });
      if (url.pathname === '/api/oauth/register') return json({ ...JSON.parse(String(init?.body)), client_id: 'fixture-client' });
      if (url.pathname === '/api/oauth/token') return json({ access_token: 'fixture-access', token_type: 'Bearer', refresh_token: 'fixture-refresh', expires_in: 3600, scope: OAUTH_SCOPE });
      throw Error(`Unexpected OAuth fixture request: ${url.pathname}`);
    }));
    try {
      await oauth.begin(id); expect(oauth.isPending(id)).toBe(true); expect(open).toHaveBeenCalledTimes(1);
      const authorization = new URL(open.mock.calls[0]![0]);
      expect(authorization.searchParams.get('scope')).toBe(OAUTH_SCOPE); expect(authorization.searchParams.get('resource')).toBe(MCP_ENDPOINT);
      expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
      const callback = new URL(authorization.searchParams.get('redirect_uri')!);
      expect(callback.hostname).toBe('127.0.0.1');
      callback.searchParams.set('state', 'wrong'); callback.searchParams.set('code', 'fixture-code');
      expect((await localFetch(callback)).status).toBe(400); expect(requests.filter(r => r.url.pathname === '/api/oauth/token')).toHaveLength(0);
      callback.searchParams.set('state', authorization.searchParams.get('state')!); callback.searchParams.set('iss', 'https://zernio.com');
      expect((await localFetch(callback)).status).toBe(200);
      await vi.waitFor(() => expect(completed).toHaveBeenCalledWith(id, null));
      expect(oauth.isPending(id)).toBe(false); expect(await oauth.token(id)).toBe('fixture-access');
      const tokenRequest = requests.find(r => r.url.pathname === '/api/oauth/token')!;
      const body = new URLSearchParams(String(tokenRequest.init!.body));
      expect(body.get('code')).toBe('fixture-code'); expect(body.get('redirect_uri')).toBe(authorization.searchParams.get('redirect_uri'));
      expect(createHash('sha256').update(body.get('code_verifier')!).digest('base64url')).toBe(authorization.searchParams.get('code_challenge'));
      expect((await readFile(join(f.dir, 'data', `${id}.credential`))).includes(Buffer.from('fixture-access'))).toBe(false);
    } finally { oauth.close(); }
  });
  it('rotates refresh tokens once for concurrent calls and retains a token when no replacement is returned', async () => {
    const f = await setup(), id = randomUUID(), open = vi.fn(async () => {});
    const oauth = new ZernioOAuth(f.store, open, async () => {});
    await f.store.saveCredential(id, { method: 'oauth', client: { client_id: 'fixture-client' }, tokens: { access_token: 'expired', token_type: 'Bearer', refresh_token: 'refresh-a' }, expiresAt: 0 });
    const fetcher = vi.fn(async (_input: string, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body)); expect(body.get('resource')).toBe(MCP_ENDPOINT); expect(body.get('client_id')).toBe('fixture-client');
      return new Response(JSON.stringify({ access_token: 'new-access', token_type: 'Bearer', expires_in: 3600, ...(body.get('refresh_token') === 'refresh-a' ? { refresh_token: 'refresh-b' } : {}) }));
    });
    vi.stubGlobal('fetch', fetcher);
    expect(await Promise.all([oauth.token(id), oauth.token(id)])).toEqual(['new-access', 'new-access']); expect(fetcher).toHaveBeenCalledTimes(1);
    const first = await f.store.credential(id); expect(first).toMatchObject({ tokens: { refresh_token: 'refresh-b' } });
    await f.store.saveCredential(id, { ...first as Extract<NonNullable<typeof first>, { method: 'oauth' }>, expiresAt: 0 });
    await oauth.token(id); expect(await f.store.credential(id)).toMatchObject({ tokens: { refresh_token: 'refresh-b' } }); expect(open).not.toHaveBeenCalled();
    fetcher.mockImplementationOnce(async () => new Response('{}', { status: 401 }));
    const current = await f.store.credential(id); await f.store.saveCredential(id, { ...current as Extract<NonNullable<typeof current>, { method: 'oauth' }>, expiresAt: 0 });
    await expect(oauth.token(id)).rejects.toThrow('expiró'); expect(open).not.toHaveBeenCalled();
  });
  it('requires the exact callback path, state and issuer without throwing on Unicode input', () => {
    const state = 'a'.repeat(64), path = '/callback/test';
    expect(validCallback(new URL(`http://127.0.0.1${path}?state=${state}&iss=https://zernio.com`), state, path)).toBe(true);
    for (const url of [`http://127.0.0.1/else?state=${state}`, `http://127.0.0.1${path}?state=${'á'.repeat(64)}`, `http://127.0.0.1${path}?state=${state}&iss=https://evil.test`]) expect(validCallback(new URL(url), state, path)).toBe(false);
  });
  it('rejects credential-bearing, private and non-HTTPS destinations', () => {
    for (const url of ['http://example.com', 'https://localhost/file', 'https://127.0.0.1/file', 'https://user:pass@example.com/file']) expect(() => publicHttps(url)).toThrow();
    expect(() => trustedOAuthUrl('https://evil.test/token')).toThrow();
    expect(safeMessage(`error Bearer secret ${key} https://example.com/?token=secret`)).not.toContain(key);
  });
  it('waits on rate-limit responses and never sends a second request during the cooldown', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'slow down' }), { status: 429, headers: { 'retry-after': '30' } }));
    const client = new ZernioClient(async () => key, fetcher); await expect(client.request('GET', '/accounts')).rejects.toThrow(); await expect(client.request('GET', '/accounts')).rejects.toThrow('esperar'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
