import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEFAULT_STORAGE_POLICY, normalizeStoragePolicy, type StoragePolicyState } from './types';

/** Atomic, serialized, revision-checked preferences; malformed settings disable cleanup. */
export class StoragePolicyStore {
  private tail: Promise<unknown> = Promise.resolve();
  readonly file: string;
  constructor(file: string) { this.file = file; }
  async get(): Promise<StoragePolicyState> {
    try {
      const info = await lstat(this.file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 16_384) throw Error('Archivo de configuración no válido.');
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      if (data.version !== 1 || !Number.isSafeInteger(data.revision) || data.revision < 0) throw Error('Versión de configuración no válida.');
      return { revision: data.revision, policy: normalizeStoragePolicy(data.policy) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { revision: 0, policy: { ...DEFAULT_STORAGE_POLICY } };
      throw Error('No se pudo leer la configuración. La limpieza se detuvo y el archivo original se conserva.', { cause: error });
    }
  }
  save(expectedRevision: number, raw: unknown): Promise<StoragePolicyState> {
    const operation = this.tail.catch(() => undefined).then(async () => {
      const policy = normalizeStoragePolicy(raw), current = await this.get();
      if (!Number.isSafeInteger(expectedRevision) || current.revision !== expectedRevision) throw Error('La configuración cambió en otra ventana. Actualizá antes de guardar.');
      await mkdir(dirname(this.file), { recursive: true });
      const next = { version: 1, revision: current.revision + 1, policy };
      const pending = `${this.file}.${randomUUID()}.tmp`;
      try {
        const file = await open(pending, 'wx');
        try { await file.writeFile(JSON.stringify(next, null, 2)); await file.sync(); } finally { await file.close(); }
        await rename(pending, this.file);
      } finally { await unlink(pending).catch(() => {}); }
      return { revision: next.revision, policy };
    });
    this.tail = operation;
    return operation;
  }
}
