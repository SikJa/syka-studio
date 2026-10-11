import { isIP } from 'node:net';
import type { PublicationResult, ZernioAccount } from './types';
export const API = 'https://zernio.com/api/v1';
type Json = Record<string, any>;
export function safeMessage(value: unknown) {
  return (typeof value === 'string' ? value : 'No se pudo completar la operación con Zernio.')
    .replace(/\b(?:sk_|zrk_)[A-Za-z0-9_-]+|Bearer\s+\S+/gi, '[credencial oculta]')
    .replace(/https?:\/\/\S+/gi, '[enlace omitido]').replace(/[A-Za-z0-9+/_=-]{48,}/g, '[dato omitido]').slice(0, 500);
}
export class ProviderError extends Error {
  readonly status: number; readonly code: string | null; readonly retryAt: number | null; readonly existingPostId: string | null;
  constructor(message: string, status = 0, code: string | null = null, retryAt: number | null = null, existingPostId: string | null = null) { super(safeMessage(message)); this.status = status; this.code = code; this.retryAt = retryAt; this.existingPostId = existingPostId; }
}
export async function readJson(response: Response): Promise<Json> {
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  if (reader) { try { for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 2 * 1024 * 1024) throw Error('Respuesta del proveedor demasiado grande.'); chunks.push(next.value); } } finally { await reader.cancel().catch(() => {}); } }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Json; }
  catch { throw new ProviderError('Zernio devolvió una respuesta inválida.', response.status); }
}
export function publicHttps(value: unknown): string {
  if (typeof value !== 'string' || value.length > 8192) throw Error('Zernio no devolvió un enlace válido.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(url.hostname) || url.hostname === 'localhost' || !url.hostname.includes('.') || url.hostname.endsWith('.local')) throw Error('Zernio no devolvió un enlace HTTPS público.');
  return url.href;
}
export class ZernioClient {
  private blockedUntil = 0;
  private active = 0;
  get isBusy() { return this.active > 0; }
  private readonly token: () => Promise<string>; private readonly fetcher: typeof fetch;
  constructor(token: () => Promise<string>, fetcher: typeof fetch = fetch) { this.token = token; this.fetcher = fetcher; }
  async request(method: 'GET' | 'POST', path: string, body?: Json, idempotencyKey?: string): Promise<Json> {
    this.active++;
    try { return await this.send(method, path, body, idempotencyKey); }
    finally { this.active--; }
  }
  private async send(method: 'GET' | 'POST', path: string, body?: Json, idempotencyKey?: string): Promise<Json> {
    if (!/^\/[a-z0-9/?=&_-]+$/i.test(path)) throw Error('Endpoint inválido.');
    if (Date.now() < this.blockedUntil) throw new ProviderError('Zernio pidió esperar antes de volver a intentar.', 429, 'rate_limit', this.blockedUntil);
    let response: Response;
    try {
      response = await this.fetcher(`${API}${path}`, {
        method, headers: { Authorization: `Bearer ${await this.token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(method === 'POST' ? 180_000 : 30_000),
      });
    } catch (error) { if (error instanceof ProviderError) throw error; throw new ProviderError('No se pudo confirmar la respuesta de Zernio. Revisá la conexión antes de reintentar.'); }
    const wait = response.headers.get('retry-after');
    const retryAt = wait ? (Number.isFinite(Number(wait)) ? Date.now() + Number(wait) * 1000 : Date.parse(wait)) : null;
    if (response.status === 429) this.blockedUntil = retryAt && Number.isFinite(retryAt) ? retryAt : Date.now() + 60_000;
    const data = await readJson(response);
    if (!response.ok) {
      const defaults: Record<number, string> = { 401: 'Zernio rechazó la credencial. Volvé a conectar esta cuenta.', 403: 'La credencial no tiene permiso para esta operación.', 402: 'Zernio requiere revisar la facturación de esta conexión.', 429: 'Se alcanzó un límite de Zernio. Esperá antes de reintentar.' };
      throw new ProviderError(defaults[response.status] || safeMessage(data.error || `Zernio respondió HTTP ${response.status}.`), response.status, typeof data.code === 'string' ? data.code : null, retryAt && Number.isFinite(retryAt) ? retryAt : null, data.details?.existingPostId || data.existingPostId || null);
    }
    // 207 is HTTP success but can contain failed platform targets.
    return data;
  }
  async accounts(): Promise<ZernioAccount[]> {
    const data = await this.request('GET', '/accounts');
    const rows = Array.isArray(data) ? data : data.accounts;
    if (!Array.isArray(rows) || rows.length > 2000) throw Error('Zernio devolvió una lista de cuentas inválida.');
    return rows.map((a: Json) => {
      const id = a._id ?? a.id;
      if (typeof id !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(id) || typeof a.platform !== 'string') throw Error('Zernio devolvió una cuenta sin identificación válida.');
      return { id, platform: a.platform, username: String(a.username || a.displayName || a.platform).slice(0, 120), profileId: typeof a.profileId === 'string' ? a.profileId : a.profileId?._id ?? null, active: a.isActive !== false, canPost: null, health: null };
    });
  }
  async uploadUrl(media: { name: string; mime: string; size: number }) {
    const data = await this.request('POST', '/media/presign', { filename: media.name, contentType: media.mime, size: media.size });
    return { uploadUrl: publicHttps(data.uploadUrl), publicUrl: publicHttps(data.publicUrl) };
  }
  async post(id: string) { return this.request('GET', `/posts/${id}`); }
}
export function postResult(data: Json): { id: string; status: string; results: PublicationResult[] } {
  const post = data.post;
  const id = post?._id ?? post?.id ?? data.postId;
  if (typeof id !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(id)) throw new ProviderError('Zernio no devolvió el ID del post. El resultado todavía necesita verificación.');
  return { id, status: typeof post?.status === 'string' ? post.status : 'unknown', results: (Array.isArray(post?.platforms) ? post.platforms : []).map((p: Json) => ({ platform: String(p.platform).slice(0, 40), accountId: String(p.accountId?._id ?? p.accountId ?? '').slice(0, 64), status: String(p.status || 'unknown').slice(0, 40), url: typeof p.platformPostUrl === 'string' && /^https:\/\//.test(p.platformPostUrl) ? p.platformPostUrl : null, error: p.errorMessage ? safeMessage(p.errorMessage) : null })) };
}
