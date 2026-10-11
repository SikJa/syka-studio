import { isAbsolute, resolve } from 'node:path';
import { DapiError } from '@diffusionstudio/dapi';
import type { DapiProjectTarget } from '@diffusionstudio/dapi';

/** Bound once at MCP initialization; subsequent requests cannot retarget a session. */
export function projectTarget(url: URL): DapiProjectTarget | undefined {
  const id = url.searchParams.get('projectId');
  const dir = url.searchParams.get('projectDir');
  if (id === null && dir === null) return undefined;
  if (!id || id.length > 200 || !dir || dir.length > 4096 || dir.includes('\0') || !isAbsolute(dir)) {
    throw new DapiError('invalid-input', 'La sesión de revisión necesita un projectId y una carpeta absoluta válidos.');
  }
  return Object.freeze({ id, dir: resolve(dir) });
}

export function projectKey(target: DapiProjectTarget): string {
  const dir = resolve(target.dir);
  return process.platform === 'win32' ? dir.toLowerCase() : dir;
}
