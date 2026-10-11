import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { PublicationDraft, ZernioConnection } from './types';

export type Credential = { method: 'api_key'; key: string } | {
  method: 'oauth'; tokens?: OAuthTokens; expiresAt?: number;
  client?: OAuthClientInformationMixed; redirectUrl?: string;
};
type State = { version: 1; connections: Omit<ZernioConnection, 'configured' | 'pending'>[]; drafts: PublicationDraft[] };
export type SecureCodec = { available(): boolean; encrypt(value: string): Buffer; decrypt(value: Buffer): string };
export const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);

export async function atomicWrite(path: string, bytes: Buffer | string) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(bytes); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(() => {}); }
}

/** One serialized writer; a corrupt file is preserved and surfaced. */
export class PublicationStore {
  private chain: Promise<unknown> = Promise.resolve();
  readonly root: string;
  readonly codec: SecureCodec;
  constructor(root: string, codec: SecureCodec) { this.root = root; this.codec = codec; }
  secure() { return this.codec.available(); }
  private async read(): Promise<State> {
    try {
      const bytes = await readFile(join(this.root, 'state.json'));
      if (bytes.length > 8 * 1024 * 1024) throw Error('El historial de publicación excedió el tamaño permitido.');
      const value = JSON.parse(bytes.toString('utf8')) as State;
      if (value.version !== 1 || !Array.isArray(value.connections) || !Array.isArray(value.drafts) ||
          value.connections.length > 50 || value.drafts.length > 500 ||
          value.connections.some(c => !validId(c.id) || typeof c.label !== 'string' || !['api_key', 'oauth'].includes(c.method) || !Array.isArray(c.accounts)) ||
          value.drafts.some(d => !validId(d.id) || !Number.isInteger(d.revision) || !d.media || typeof d.media.path !== 'string' || !Array.isArray(d.results) || !['local_draft', 'uploading', 'submitting_unknown', 'remote', 'error'].includes(d.phase))) {
        throw Error('El historial de publicación está dañado o usa otra versión. Se conservó el archivo.');
      }
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, connections: [], drafts: [] };
      if (error instanceof SyntaxError) throw Error('El historial de publicación está dañado. Se conservó el archivo.');
      throw error;
    }
  }
  async snapshot() { await this.chain; return this.read(); }
  mutate<T>(operation: (state: State) => T | Promise<T>): Promise<T> {
    const task = this.chain.then(async () => {
      const state = await this.read();
      const result = await operation(state);
      if (state.connections.length > 50 || state.drafts.length > 500) throw Error('Se alcanzó el límite local de conexiones o borradores.');
      await mkdir(this.root, { recursive: true });
      const data = JSON.stringify(state);
      if (Buffer.byteLength(data) > 8 * 1024 * 1024) throw Error('El historial de publicación está lleno.');
      await atomicWrite(join(this.root, 'state.json'), data);
      return result;
    });
    this.chain = task.catch(() => {});
    return task;
  }
  private credentialPath(id: string) {
    if (!validId(id)) throw Error('Conexión inválida.');
    return join(this.root, `${id}.credential`);
  }
  async credential(id: string): Promise<Credential | null> {
    const path = this.credentialPath(id);
    if (!this.secure()) return null;
    try {
      const bytes = await readFile(path);
      if (bytes.length > 64 * 1024) throw Error('Credencial local inválida.');
      return JSON.parse(this.codec.decrypt(bytes)) as Credential;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw Error('No se pudo leer la credencial cifrada de esta conexión.'); }
  }
  async saveCredential(id: string, value: Credential) {
    const path = this.credentialPath(id);
    if (!this.secure()) throw Error('El almacenamiento seguro del sistema no está disponible.');
    await mkdir(this.root, { recursive: true });
    await atomicWrite(path, this.codec.encrypt(JSON.stringify(value)));
  }
  async forgetCredential(id: string) { await unlink(this.credentialPath(id)).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
