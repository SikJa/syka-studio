import { randomUUID, createHash } from 'node:crypto';
import { open, realpath, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { lookup as dnsLookup } from 'node:dns';
import { Agent, fetch as storageFetch } from 'undici';
import { Input, FilePathSource, ALL_FORMATS } from 'mediabunny';
import { PublicationStore, validId } from './store';
import { postResult, ProviderError, safeMessage, ZernioClient, publicHttps } from './client';
import { ZernioOAuth } from './oauth';
import type { DraftChanges, PublicationDraft, PublicationMedia, PublicationOverview } from './types';

const MIME: Record<string, string> = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/x-m4v' };
const MAX_BYTES = 5 * 1024 ** 3;
export function validateChanges(c: DraftChanges) {
  if (!c || typeof c !== 'object' || (c.connectionId !== null && !validId(c.connectionId)) || typeof c.title !== 'string' || c.title.length > 100 || typeof c.text !== 'string' || c.text.length > 5000 ||
      !['private', 'unlisted', 'public'].includes(c.visibility) || typeof c.madeForKids !== 'boolean' || typeof c.syntheticMedia !== 'boolean' || !c.timing || !['now', 'schedule'].includes(c.timing.mode)) throw Error('El borrador contiene campos inválidos.');
  if (c.target && (!['youtube', 'instagram'].includes(c.target.platform) || typeof c.target.accountId !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(c.target.accountId) || typeof c.target.username !== 'string' || c.target.username.length > 120)) throw Error('Elegí un destino válido.');
  if (c.timing.mode === 'schedule') {
    if (typeof c.timing.atUtc !== 'string' || !c.timing.atUtc.endsWith('Z') || !Number.isFinite(Date.parse(c.timing.atUtc)) || typeof c.timing.timezone !== 'string' || c.timing.timezone.length > 80) throw Error('Elegí una fecha y una zona horaria válidas.');
    try { new Intl.DateTimeFormat('es', { timeZone: c.timing.timezone }); } catch { throw Error('Zona horaria inválida.'); }
  }
}
export function validateSubmission(d: PublicationDraft, now = Date.now()) {
  validateChanges(d);
  if (!d.connectionId || !d.target) throw Error('Elegí una conexión y una cuenta social.');
  if (d.media.size > MAX_BYTES) throw Error('Zernio admite uploads de hasta 5 GB.');
  if (d.timing.mode === 'schedule' && Date.parse(d.timing.atUtc) < now + 5 * 60_000) throw Error('Elegí un horario al menos cinco minutos adelante. No se publicó el video.');
  if (d.target.platform === 'youtube' && !d.title.trim()) throw Error('YouTube necesita un título.');
  if (d.target.platform === 'instagram') {
    if ([...d.text].length > 2200) throw Error('Instagram admite hasta 2.200 caracteres.');
    if (!['video/mp4', 'video/quicktime'].includes(d.media.mime) || d.media.videoCodec !== 'avc') throw Error('Para este Reel exportá un MP4 o MOV con video H.264.');
    if (d.media.duration == null || d.media.width == null || d.media.height == null) throw Error('No se pudieron verificar duración y dimensiones para este Reel.');
    if (d.media.duration < 3 || d.media.duration > 90 || d.media.size > 300 * 1024 ** 2 || Math.abs(d.media.width / d.media.height - 9 / 16) > 0.01) throw Error('Este Reel necesita formato 9:16, de 3–90 segundos y hasta 300 MB.');
  }
}
async function fingerprint(path: string) {
  const file = await open(path, 'r');
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size <= 0 || info.size > MAX_BYTES) throw Error('Elegí un video de hasta 5 GB.');
    const hash = createHash('sha256');
    for await (const chunk of file.createReadStream({ autoClose: false })) hash.update(chunk);
    const after = await file.stat();
    if (info.size !== after.size || info.mtimeMs !== after.mtimeMs) throw Error('El video cambió mientras se leía. Volvé a seleccionarlo.');
    return { size: info.size, sha256: hash.digest('hex') };
  } finally { await file.close(); }
}
export async function inspectMedia(path: string): Promise<PublicationMedia> {
  const resolved = await realpath(path), mime = MIME[extname(resolved).toLowerCase()];
  if (!mime) throw Error('Elegí un video MP4, MOV, M4V o WebM exportado.');
  const hash = await fingerprint(resolved);
  let duration: number | null = null, width: number | null = null, height: number | null = null, videoCodec: string | null = null;
  const input = new Input({ source: new FilePathSource(resolved), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw Error('El archivo no contiene un track de video.');
    const seconds = await input.computeDuration();
    if (Number.isFinite(seconds)) duration = seconds;
    width = track.displayWidth; height = track.displayHeight;
    videoCodec = await track.getCodec();
  } finally { input.dispose(); }
  return { path: resolved, name: basename(resolved), ...hash, mime, duration, width, height, videoCodec };
}
function isPublicAddress(ip: string) {
  if (ip.includes(':')) return !/^(::|fc|fd|fe[89ab])/i.test(ip) && !ip.toLowerCase().startsWith('::ffff:');
  const [a, b] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a! >= 224 || a === 169 && b === 254 || a === 172 && b! >= 16 && b! <= 31 || a === 192 && b === 168 || a === 100 && b! >= 64 && b! <= 127 || a === 198 && (b === 18 || b === 19));
}
async function putMedia(url: string, media: PublicationMedia, signal: AbortSignal) {
  const host = new URL(publicHttps(url)).hostname;
  if (!(host === 'media.zernio.com' || host.endsWith('.r2.cloudflarestorage.com') || host.endsWith('.s3.amazonaws.com'))) throw Error('Zernio devolvió un storage no reconocido.');
  const dispatcher = new Agent({ connect: { lookup(hostname, options, callback) {
    dnsLookup(hostname, { all: true }, (error, rows) => {
      const publicRows = rows?.filter(row => isPublicAddress(row.address)) ?? [];
      if (error || !publicRows.length) { callback(Error('El storage no resolvió una dirección pública.'), '', 0); return; }
      if (options.all) callback(null, publicRows); else callback(null, publicRows[0]!.address, publicRows[0]!.family);
    });
  } } });
  const file = await open(media.path, 'r');
  const stream = file.createReadStream({ autoClose: false });
  let lastActivity = Date.now();
  const controller = new AbortController();
  const combined = AbortSignal.any([signal, controller.signal, AbortSignal.timeout(55 * 60_000)]);
  const watch = setInterval(() => { if (Date.now() - lastActivity > 120_000) controller.abort(); }, 5000);
  const counter = new Transform({ transform(chunk, _encoding, done) { lastActivity = Date.now(); done(null, chunk); } });
  try {
    const response = await storageFetch(url, { method: 'PUT', headers: { 'Content-Type': media.mime, 'Content-Length': String(media.size) }, body: Readable.toWeb(stream.pipe(counter)) as any, duplex: 'half', redirect: 'error', dispatcher, signal: combined });
    await response.body?.cancel();
    if (!response.ok) throw Error(`El upload falló (HTTP ${response.status}).`);
  } finally { clearInterval(watch); stream.destroy(); counter.destroy(); await file.close(); await dispatcher.close(); }
}
type ServiceOptions = { fetcher?: typeof fetch; inspect?: typeof inspectMedia; upload?: typeof putMedia };

export class PublicationService {
  readonly oauth: ZernioOAuth;
  private clients = new Map<string, ZernioClient>();
  private busy = new Map<string, AbortController>();
  readonly store: PublicationStore;
  private readonly options: ServiceOptions;
  constructor(store: PublicationStore, openBrowser: (url: string) => Promise<void>, options: ServiceOptions = {}) {
    this.store = store; this.options = options;
    this.oauth = new ZernioOAuth(store, openBrowser, async (id, error) => {
      await store.mutate(s => { const c = s.connections.find(c => c.id === id); if (c) c.error = error; });
      if (!error) await this.sync(id).catch(() => {});
    });
  }
  close() { this.oauth.close(); for (const c of this.busy.values()) c.abort(); }
  async recover() {
    await this.store.mutate(s => { for (const d of s.drafts) if (d.phase === 'uploading') { d.phase = 'error'; d.error = 'El upload se interrumpió. Podés volver a intentar.'; d.revision++; } });
  }
  async overview(): Promise<PublicationOverview> {
    const s = await this.store.snapshot();
    const connections = await Promise.all(s.connections.map(async c => {
      const key = await this.store.credential(c.id);
      return { ...c, configured: !!key && (key.method === 'api_key' || !!key.tokens), pending: this.oauth.isPending(c.id) };
    }));
    // Payloads and idempotency keys are main-only, even though stored records use one type.
    return { connections, drafts: s.drafts.map(d => ({ ...d, attempt: d.attempt ? { key: '', startedAt: d.attempt.startedAt, payload: {} } : null, upload: null })), secureStorage: this.store.secure() };
  }
  async addConnection(label: string, key?: string) {
    if (typeof label !== 'string' || !label.trim() || label.trim().length > 80 || /[\x00-\x1f]/.test(label)) throw Error('Escribí un nombre de hasta 80 caracteres.');
    if (!this.store.secure()) throw Error('El almacenamiento seguro no está disponible.');
    if (key !== undefined && (typeof key !== 'string' || !/^(sk_|zrk_)[a-f0-9]{64}$/i.test(key.trim()))) throw Error('La API key no tiene un formato válido de Zernio (sk_ o zrk_).');
    const id = randomUUID();
    try {
      if (key !== undefined) await this.store.saveCredential(id, { method: 'api_key', key: key.trim() });
      await this.store.mutate(s => { s.connections.push({ id, label: label.trim(), method: key === undefined ? 'oauth' : 'api_key', owner: null, accounts: [], checkedAt: null, error: null }); });
    } catch (error) { await this.store.forgetCredential(id); throw error; }
    if (key === undefined) await this.oauth.begin(id);
    return id;
  }
  private client(id: string) {
    if (!validId(id)) throw Error('Conexión inválida.');
    let client = this.clients.get(id); if (!client) { client = new ZernioClient(() => this.oauth.token(id), this.options.fetcher); this.clients.set(id, client); } return client;
  }
  async sync(id: string) {
    const snapshot = await this.store.snapshot(); const c = snapshot.connections.find(c => c.id === id);
    if (!c) throw Error('Esta conexión ya no existe.');
    try {
      const api = this.client(id), identity = await api.request('GET', '/auth/verify');
      if (identity.valid !== true || typeof identity.userId !== 'string') throw Error('Zernio no confirmó la identidad de esta conexión.');
      if (c.owner && c.owner.id !== identity.userId) throw Error('La identidad de Zernio cambió. Creá una conexión nueva para esta cuenta.');
      const accounts = await api.accounts();
      const health = await api.request('GET', '/accounts/health');
      if (!Array.isArray(health.accounts)) throw Error('Zernio no devolvió el estado de las cuentas.');
      for (const account of accounts) {
        const h = health.accounts.find((row: { accountId?: string }) => row.accountId === account.id);
        account.health = typeof h?.status === 'string' ? h.status : null;
        account.canPost = typeof h?.canPost === 'boolean' ? h.canPost && h.needsReconnect !== true : null;
      }
      await this.store.mutate(s => { const row = s.connections.find(c => c.id === id); if (row) Object.assign(row, { owner: { id: identity.userId, name: String(identity.name || 'Cuenta de Zernio').slice(0, 120) }, accounts, checkedAt: new Date().toISOString(), error: null }); });
    } catch (error) {
      await this.store.mutate(s => { const row = s.connections.find(c => c.id === id); if (row) row.error = safeMessage((error as Error).message); });
      throw error;
    }
  }
  async disconnect(id: string) {
    if (this.busy.size || this.clients.get(id)?.isBusy || this.oauth.isPending(id)) throw Error('Esperá a que termine la operación o cancelá el inicio de sesión.');
    await this.store.forgetCredential(id); this.clients.delete(id);
    await this.store.mutate(s => { s.connections = s.connections.filter(c => c.id !== id); });
  }
  async createDraft(path: string) {
    const media = await (this.options.inspect ?? inspectMedia)(path), now = new Date().toISOString();
    await this.store.mutate(s => { s.drafts.unshift({ id: randomUUID(), revision: 1, connectionId: null, media, target: null, title: basename(media.name, extname(media.name)).slice(0, 100), text: '', visibility: 'private', madeForKids: false, syntheticMedia: false, timing: { mode: 'now' }, phase: 'local_draft', createdAt: now, updatedAt: now, externalPostId: null, providerStatus: null, results: [], error: null, retryAfterAt: null, attempt: null, upload: null }); });
  }
  private async draft(id: string, revision?: number) {
    const d = (await this.store.snapshot()).drafts.find(d => d.id === id);
    if (!d) throw Error('No se encontró el borrador.');
    if (revision !== undefined && d.revision !== revision) throw Error('El borrador cambió. Actualizá la vista antes de continuar.');
    return d;
  }
  async saveDraft(id: string, revision: number, changes: DraftChanges) {
    validateChanges(changes);
    await this.store.mutate(s => {
      const d = s.drafts.find(d => d.id === id);
      if (!d || d.revision !== revision) throw Error('El borrador cambió. Actualizá la vista.');
      if (this.busy.has(id) || d.attempt || d.externalPostId) throw Error('Este envío ya empezó. Verificá su resultado antes de cambiar el contenido.');
      if (changes.connectionId) { const c = s.connections.find(c => c.id === changes.connectionId); if (!c || changes.target && !c.accounts.some(a => a.id === changes.target!.accountId && a.platform === changes.target!.platform)) throw Error('El destino no pertenece a la conexión elegida.'); }
      // Never accept extra renderer fields (phase, media path, post id, credentials).
      Object.assign(d, { connectionId: changes.connectionId, target: changes.target ? { accountId: changes.target.accountId, platform: changes.target.platform, username: changes.target.username } : null, title: changes.title, text: changes.text, visibility: changes.visibility, madeForKids: changes.madeForKids, syntheticMedia: changes.syntheticMedia, timing: changes.timing.mode === 'now' ? { mode: 'now' } : { mode: 'schedule', atUtc: changes.timing.atUtc, timezone: changes.timing.timezone }, revision: d.revision + 1, updatedAt: new Date().toISOString(), phase: 'local_draft', error: null, upload: changes.connectionId === d.connectionId ? d.upload : null });
    });
  }
  async deleteDraft(id: string, revision: number) {
    await this.store.mutate(s => {
      const d = s.drafts.find(d => d.id === id);
      if (!d || d.revision !== revision) throw Error('El borrador cambió. Actualizá la vista.');
      if (this.busy.has(id) || d.attempt || d.externalPostId) throw Error('Sólo se pueden eliminar borradores locales sin un envío iniciado.');
      s.drafts = s.drafts.filter(d => d.id !== id);
    });
  }
  cancelUpload(id: string) { this.busy.get(id)?.abort(); }
  private async change(id: string, patch: Partial<PublicationDraft>) {
    await this.store.mutate(s => { const row = s.drafts.find(d => d.id === id); if (!row) throw Error('Borrador no encontrado.'); Object.assign(row, patch, { revision: row.revision + 1, updatedAt: new Date().toISOString() }); });
  }
  async submit(id: string, revision: number) {
    if (!validId(id) || !Number.isSafeInteger(revision) || revision < 1) throw Error('La publicación requiere la revisión guardada del borrador.');
    if (this.busy.has(id)) throw Error('Este video ya tiene una operación en curso.');
    const controller = new AbortController(); this.busy.set(id, controller);
    let replay = false, posting = false;
    try {
      let d = await this.draft(id, revision);
      replay = !!d.attempt;
      if (d.externalPostId) throw Error('Este post ya existe en Zernio. Actualizá su estado.');
      validateSubmission(d);
      if (d.retryAfterAt && d.retryAfterAt > Date.now()) throw Error('Zernio pidió esperar antes de reintentar.');
      if (d.attempt && Date.now() - d.attempt.startedAt >= 24 * 3600_000) throw Error('Terminó la ventana segura de reintento. Verificá el post en Zernio antes de iniciar otro.');
      await this.sync(d.connectionId!);
      const conn = (await this.store.snapshot()).connections.find(c => c.id === d.connectionId);
      const account = conn?.accounts.find(a => a.id === d.target!.accountId && a.platform === d.target!.platform);
      if (!account?.active || account.canPost !== true) throw Error('No se pudo comprobar permiso de publicación para esta cuenta. Revisá la conexión.');
      const api = this.client(d.connectionId!);
      if (!d.attempt) {
        const hash = await fingerprint(d.media.path);
        if (hash.sha256 !== d.media.sha256 || hash.size !== d.media.size) throw Error('El export cambió. Creá un borrador con el archivo actualizado.');
        if (!d.upload || Date.now() - d.upload.at >= 7 * 86_400_000) {
          await this.change(id, { phase: 'uploading', error: null });
          const before = await stat(d.media.path);
          const links = await api.uploadUrl(d.media);
          await (this.options.upload ?? putMedia)(links.uploadUrl, d.media, controller.signal);
          const after = await stat(d.media.path);
          if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw Error('El archivo cambió durante el upload. No se creó un post.');
          await this.change(id, { upload: { publicUrl: links.publicUrl, at: Date.now() } });
        }
        if (controller.signal.aborted) throw Error('Upload cancelado. No se envió el post.');
        d = await this.draft(id); validateSubmission(d);
        const payload: Record<string, unknown> = {
          content: d.text, mediaItems: [{ type: 'video', url: d.upload!.publicUrl }],
          platforms: [{ platform: d.target!.platform, accountId: d.target!.accountId, platformSpecificData: d.target!.platform === 'youtube' ? { title: d.title, visibility: d.visibility, madeForKids: d.madeForKids, containsSyntheticMedia: d.syntheticMedia } : { shareToFeed: true } }],
          ...(d.timing.mode === 'now' ? { publishNow: true } : { scheduledFor: d.timing.atUtc, timezone: d.timing.timezone }),
        };
        await this.change(id, { phase: 'submitting_unknown', attempt: { key: randomUUID(), startedAt: Date.now(), payload }, error: null });
        d = await this.draft(id);
      }
      // Exact durable payload and key survive response loss and restart.
      posting = true;
      const data = await api.request('POST', '/posts', d.attempt!.payload, d.attempt!.key);
      const result = postResult(data);
      await this.change(id, { externalPostId: result.id, providerStatus: result.status, results: result.results, phase: 'remote', error: data.error ? safeMessage(data.error) : null, retryAfterAt: null });
    } catch (error) {
      const current = await this.draft(id).catch(() => null);
      if (current) {
        // A rejected replay or a failed preflight cannot prove the original post was never created.
        const definiteRejection = posting && !replay && error instanceof ProviderError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 409 && !error.existingPostId;
        const ambiguous = !!current.attempt && !definiteRejection;
        await this.change(id, { phase: current.externalPostId ? 'remote' : ambiguous ? 'submitting_unknown' : 'error', error: safeMessage((error as Error).message), retryAfterAt: error instanceof ProviderError ? error.retryAt : null, ...(definiteRejection ? { attempt: null } : {}) });
        if (posting && error instanceof ProviderError && error.existingPostId && current.connectionId) await this.adoptPost(id, current.connectionId, error.existingPostId).catch(() => {});
      }
      throw error;
    } finally { this.busy.delete(id); }
  }
  private async adoptPost(id: string, connection: string, externalId: string) {
    const result = postResult(await this.client(connection).post(externalId));
    const d = await this.draft(id);
    if (result.id !== externalId || !result.results.some(r => r.accountId === d.target?.accountId && r.platform === d.target.platform)) throw Error('El post devuelto no coincide con el destino del borrador. Verificá el resultado en Zernio.');
    await this.change(id, { externalPostId: result.id, providerStatus: result.status, results: result.results, phase: 'remote', error: null });
  }
  async refreshPost(id: string, revision: number) {
    if (!validId(id) || !Number.isSafeInteger(revision) || revision < 1) throw Error('Actualizá la vista para comprobar la revisión del borrador.');
    const d = await this.draft(id, revision);
    if (!d.externalPostId || !d.connectionId) throw Error('Este borrador todavía no tiene un post confirmado.');
    await this.adoptPost(id, d.connectionId, d.externalPostId);
  }
}
