import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Preferences belong to the runtime, not a preview port or versioned app URL. */
export class UiPreferences {
  private values: Record<string, string>;
  private readonly file: string;
  constructor(file: string) {
    this.file = file;
    const raw = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Preferencias inválidas; se conserva el archivo.');
    this.values = Object.fromEntries(Object.entries(raw).filter(([key, value]) => this.validKey(key) && typeof value === 'string')) as Record<string, string>;
  }
  private validKey(key: unknown): key is string { return typeof key === 'string' && /^dspro\.ui\.[\w.-]{1,120}$/.test(key); }
  get(key: unknown): string | null {
    if (!this.validKey(key)) throw Error('Preferencia no permitida.');
    return this.values[key] ?? null;
  }
  set(key: unknown, value: unknown): void {
    if (!this.validKey(key) || value !== null && (typeof value !== 'string' || value.length > 256_000)) throw Error('Preferencia inválida.');
    const next = { ...this.values };
    if (value === null) delete next[key]; else next[key] = value as string;
    const data = JSON.stringify(next);
    if (data.length > 4_000_000) throw Error('Las preferencias superan el tamaño permitido.');
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    writeFileSync(temporary, data, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, this.file);
    this.values = next;
  }
}
