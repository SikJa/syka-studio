/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Keys of the model providers, encrypted with `safeStorage` (DPAPI on
 * Windows), from Syka Code's `main/provider-secrets.ts`. Only main decrypts
 * them; the agent host gets them in memory and the renderer never does.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface SecretCipher {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

type StoredFile = Record<string, Record<string, string>>;
const FIELD = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const PROVIDER = /^[a-z0-9][a-z0-9-]{0,62}$/;

export class ProviderSecretStore {
  readonly #path: string;
  readonly #cipher: SecretCipher;
  constructor(path: string, cipher: SecretCipher) { this.#path = path; this.#cipher = cipher; }

  #read(): StoredFile {
    try {
      const parsed = JSON.parse(readFileSync(this.#path, 'utf8')) as unknown;
      return typeof parsed === 'object' && parsed !== null ? parsed as StoredFile : {};
    } catch { return {}; }
  }
  #write(data: StoredFile): void {
    mkdirSync(dirname(this.#path), { recursive: true });
    const temporary = `${this.#path}.tmp`;
    writeFileSync(temporary, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
    renameSync(temporary, this.#path);
  }

  /** Several changes of one provider in one write: a string saves and `null` removes. */
  setMany(providerId: string, changes: Readonly<Record<string, string | null>>): void {
    if (!PROVIDER.test(providerId)) throw new Error('Identificador de proveedor no válido.');
    const data = this.#read();
    const entry = { ...data[providerId] };
    for (const [field, value] of Object.entries(changes)) {
      if (!FIELD.test(field)) throw new Error('Identificador de secreto no válido.');
      if (value === null || value === '') { delete entry[field]; continue; }
      if (!this.#cipher.isEncryptionAvailable()) throw new Error('El cifrado del sistema no está disponible: no se puede guardar la clave de forma segura.');
      entry[field] = this.#cipher.encryptString(value).toString('base64');
    }
    if (Object.keys(entry).length === 0) delete data[providerId]; else data[providerId] = entry;
    this.#write(data);
  }

  removeProvider(providerId: string): void {
    const data = this.#read();
    if (!(providerId in data)) return;
    delete data[providerId];
    this.#write(data);
  }

  /** Which fields each provider has saved, without decrypting anything. */
  fields(): Record<string, string[]> {
    return Object.fromEntries(Object.entries(this.#read()).map(([providerId, entry]) => [providerId, Object.keys(entry)]));
  }

  /** Everything decrypted, for the agent host. What cannot be decrypted is left out. */
  decryptAll(): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    for (const [providerId, entry] of Object.entries(this.#read())) {
      for (const [field, encrypted] of Object.entries(entry)) {
        // Encrypted by another Windows account or a damaged file: treated as missing.
        try { result[providerId] = { ...result[providerId], [field]: this.#cipher.decryptString(Buffer.from(encrypted, 'base64')) }; } catch { /* missing */ }
      }
    }
    return result;
  }
}
