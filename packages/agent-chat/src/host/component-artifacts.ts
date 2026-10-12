/* MPL-2.0. Download official components without npm hooks or global changes. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, open, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createBrotliDecompress, createGunzip } from 'node:zlib';
import extractZip from 'extract-zip';

export type Artifact = { url: string; hash?: { algorithm: 'sha256' | 'sha512'; value: string; encoding?: 'hex' | 'base64' }; format: 'binary' | 'tgz' | 'zip' };
export const DOWNLOAD_LIMIT = 512 * 1024 * 1024;
const UNPACK_LIMIT = 768 * 1024 * 1024;
const ALLOWED_HOSTS = new Set(['registry.npmjs.org', 'downloads.claude.ai', 'antigravity-cli-auto-updater-974169037036.us-central1.run.app', 'storage.googleapis.com', 'cursor.com', 'downloads.cursor.com']);

export function officialUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !ALLOWED_HOSTS.has(url.hostname)) throw Error('La descarga no pertenece a un distribuidor oficial permitido.');
  if (url.hostname === 'storage.googleapis.com' && !url.pathname.startsWith('/antigravity-public/antigravity-cli/')) throw Error('La descarga de Antigravity tiene una ruta inválida.');
  return url;
}
export function childPath(root: string, part: string): string {
  const target = resolve(root, part), rel = relative(resolve(root), target);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw Error('Ruta de componente inválida.');
  return target;
}

/** Redirects are validated individually before making the next request. */
export async function officialFetch(url: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Response> {
  let current = url;
  for (let redirects = 0; redirects <= 5; redirects++) {
    officialUrl(current); signal.throwIfAborted();
    const response = await fetcher(current, { signal, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location) throw Error('El distribuidor devolvió una redirección inválida.');
      current = new URL(location, current).href; continue;
    }
    if (!response.ok) throw Error(`No se pudo descargar el componente oficial (HTTP ${response.status}).`);
    if (response.url) officialUrl(response.url);
    return response;
  }
  throw Error('El distribuidor devolvió demasiadas redirecciones.');
}
export async function officialText(url: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<string> {
  const response = await officialFetch(url, signal, fetcher);
  const reader = response.body?.getReader(); if (!reader) throw Error('El distribuidor devolvió una respuesta vacía.');
  const chunks: Uint8Array[] = []; let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); }; signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) { const { done, value } = await reader.read(); signal.throwIfAborted(); if (done) break; size += value.length; if (size > 2 * 1024 * 1024) throw Error('El manifiesto del componente es demasiado grande.'); chunks.push(value); }
  } finally { signal.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks).toString('utf8');
}
export async function downloadArtifact(artifact: Artifact, output: string, signal: AbortSignal, fetcher: typeof fetch = fetch, progress?: (received: number, size?: number) => void): Promise<string> {
  const response = await officialFetch(artifact.url, signal, fetcher);
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > DOWNLOAD_LIMIT) { await response.body?.cancel(); throw Error('El componente supera el límite de descarga.'); }
  const reader = response.body?.getReader(); if (!reader) throw Error('La descarga oficial está vacía.');
  const sha256 = createHash('sha256'), check = artifact.hash ? createHash(artifact.hash.algorithm) : undefined;
  const file = await open(output, 'wx', 0o600).catch(async error => { await reader.cancel().catch(() => {}); throw error; }); let received = 0;
  const abort = () => { void reader.cancel().catch(() => {}); }; signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read(); signal.throwIfAborted(); if (done) break;
      received += value.length;
      if (received > DOWNLOAD_LIMIT) throw Error('El componente supera el límite de descarga.');
      sha256.update(value); check?.update(value); await file.write(value); progress?.(received, declared || undefined);
    }
    if (!received || declared && received !== declared) throw Error('La descarga del componente quedó incompleta.');
    if (check && artifact.hash && check.digest(artifact.hash.encoding ?? 'hex') !== artifact.hash.value) throw Error('La integridad del componente oficial no coincide.');
    return sha256.digest('hex');
  } finally { signal.removeEventListener('abort', abort); await file.close(); await reader.cancel().catch(() => {}); }
}

function archivePath(raw: string): string {
  if (raw.startsWith('/') || /[\\:\0]/.test(raw) || raw.split('/').some(part => part === '..')) throw Error('El archivo del componente contiene una ruta insegura.');
  return raw.replace(/^\.\//, '').replace(/\/$/, '');
}
/** Some official native packages ship a Brotli binary instead of an npm hook. */
export async function unpackBrotliBinary(archive: string, destination: string, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const output = await open(destination, 'wx', 0o700);
  const input = createReadStream(archive), decoder = createBrotliDecompress();
  input.on('error', error => decoder.destroy(error)); input.pipe(decoder);
  const abort = () => { input.destroy(); decoder.destroy(signal.reason instanceof Error ? signal.reason : Error('Preparación cancelada.')); };
  signal.addEventListener('abort', abort, { once: true });
  let size = 0;
  try {
    signal.throwIfAborted();
    for await (const chunk of decoder) {
      signal.throwIfAborted(); size += chunk.length;
      if (size > DOWNLOAD_LIMIT) throw Error('El ejecutable descomprimido supera el límite permitido.');
      await output.write(chunk);
    }
    if (!size) throw Error('El ejecutable comprimido está vacío.');
  } finally { signal.removeEventListener('abort', abort); input.destroy(); decoder.destroy(); await output.close(); }
}
/** A streaming tar reader: no shell extraction, links or unbounded inflation. */
export async function unpackTarGzip(archive: string, destination: string, signal: AbortSignal): Promise<void> {
  const input = createReadStream(archive), gzip = createGunzip(); input.pipe(gzip);
  input.on('error', error => gzip.destroy(error));
  const iterator = gzip[Symbol.asyncIterator](); let buffer = Buffer.alloc(0), total = 0, entries = 0;
  const abort = () => { input.destroy(); gzip.destroy(signal.reason instanceof Error ? signal.reason : Error('Preparación cancelada.')); };
  signal.addEventListener('abort', abort, { once: true });
  async function read(size: number): Promise<Buffer> {
    while (buffer.length < size) { signal.throwIfAborted(); const next = await iterator.next(); if (next.done) throw Error('El archivo del componente está truncado.'); const chunk = Buffer.from(next.value); buffer = Buffer.concat([buffer, chunk]); }
    const result = buffer.subarray(0, size); buffer = buffer.subarray(size); return result;
  }
  const string = (block: Buffer, start: number, length: number) => block.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
  let longName: string | undefined, paxPath: string | undefined;
  try {
    while (true) {
      const header = await read(512); if (header.every(byte => byte === 0)) break;
      if (++entries > 10_000) throw Error('El archivo del componente contiene demasiadas entradas.');
      const stored = Number.parseInt(string(header, 148, 8).trim(), 8);
      let checksum = 0; for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i]!;
      if (checksum !== stored) throw Error('La cabecera del componente tiene una integridad inválida.');
      const size = Number.parseInt(string(header, 124, 12).trim() || '0', 8), type = string(header, 156, 1);
      if (!Number.isSafeInteger(size) || size < 0 || size > DOWNLOAD_LIMIT || (total += size) > UNPACK_LIMIT) throw Error('El contenido del componente supera el límite permitido.');
      let name = paxPath ?? longName ?? [string(header, 345, 155), string(header, 0, 100)].filter(Boolean).join('/');
      paxPath = undefined; longName = undefined;
      if (type === 'L' || type === 'x' || type === 'g') {
        if (size > 64 * 1024) throw Error('Metadatos del componente demasiado grandes.');
        const text = (await read(size)).toString('utf8');
        if (type === 'L') longName = text.replace(/\0.*$/s, '').trimEnd();
        else { const match = /(?:^|\n)\d+ path=([^\n]*)/.exec(text); if (match) paxPath = match[1]; }
      } else {
        name = archivePath(name);
        if (name !== 'package' && !name.startsWith('package/')) throw Error('El archivo no tiene la estructura de un paquete oficial.');
        const part = name === 'package' ? '' : name.slice('package/'.length);
        if (!['', '0', '5'].includes(type)) throw Error('El componente contiene enlaces o tipos de archivo no permitidos.');
        if (type === '5') { if (size !== 0) throw Error('Directorio del componente inválido.'); if (part) await mkdir(childPath(destination, part), { recursive: true }); }
        else {
          if (!part) throw Error('Archivo del componente sin nombre.');
          const target = childPath(destination, part); await mkdir(dirname(target), { recursive: true });
          const file = await open(target, 'wx', 0o600);
          try { for (let left = size; left > 0;) { const chunk = await read(Math.min(left, 64 * 1024)); await file.write(chunk); left -= chunk.length; } }
          finally { await file.close(); }
          if (process.platform !== 'win32') await chmod(target, Number.parseInt(string(header, 100, 8).trim() || '644', 8) & 0o777);
        }
      }
      const padding = (512 - size % 512) % 512; if (padding) await read(padding);
    }
    // Drain to validate gzip's trailer instead of accepting a truncated stream.
    while (!(await iterator.next()).done) signal.throwIfAborted();
  } finally { signal.removeEventListener('abort', abort); input.destroy(); gzip.destroy(); }
}
export async function unpackZip(archive: string, destination: string, signal: AbortSignal): Promise<void> {
  let total = 0, entries = 0;
  await extractZip(archive, { dir: destination, onEntry(entry) {
    signal.throwIfAborted(); archivePath(entry.fileName);
    if ((entry.externalFileAttributes >>> 16 & 0o170000) === 0o120000) throw Error('El componente contiene enlaces no permitidos.');
    if (++entries > 10_000 || (total += entry.uncompressedSize) > UNPACK_LIMIT) throw Error('El contenido del componente supera el límite permitido.');
  } });
  signal.throwIfAborted();
}
export async function fileHash(path: string): Promise<string> {
  const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex');
}
export async function componentFileHashes(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error('El componente contiene enlaces no permitidos.');
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) result[relative(root, path).split(sep).join('/')] = await fileHash(path);
    }
  }
  await walk(root); return result;
}
export async function npmArtifact(name: string, version: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<{ artifact: Artifact; metadata: Record<string, any> }> {
  if (!/^(?:@[a-z0-9-]+\/)?[a-z0-9-]+$/.test(name) || !/^(?:latest|\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?)$/.test(version)) throw Error('Versión de paquete inválida.');
  const metadata = JSON.parse(await officialText(`https://registry.npmjs.org/${name}/${version}`, signal, fetcher));
  if (metadata.name !== name || !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(metadata.version ?? '') || version !== 'latest' && metadata.version !== version) throw Error('El registro devolvió otro paquete o versión.');
  const integrity = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(metadata.dist?.integrity ?? '');
  const url = officialUrl(metadata.dist?.tarball ?? ''), packageBase = name.split('/').at(-1)!;
  if (!integrity || url.hostname !== 'registry.npmjs.org' || url.pathname !== `/${name}/-/${packageBase}-${metadata.version}.tgz`) throw Error('El paquete oficial no ofrece una integridad válida.');
  return { metadata, artifact: { url: url.href, format: 'tgz', hash: { algorithm: 'sha512', value: integrity[1]!, encoding: 'base64' } } };
}
