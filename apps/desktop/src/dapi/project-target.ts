import { isAbsolute, resolve } from 'node:path';
import { realpath } from 'node:fs/promises';
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

/** Queue physical folders, so a junction and its target cannot occupy two slots. */
export async function canonicalPreviewJob<T extends { project: DapiProjectTarget; tool: string; args: unknown }>(job: T): Promise<T> {
  const canonical = async (dir: string) => {
    try { return await realpath(dir); }
    catch { throw new DapiError('not-found', 'La carpeta del proyecto ya no está disponible. No se inició la revisión.'); }
  };
  const project = Object.freeze({ ...job.project, dir: await canonical(job.project.dir) });
  if (job.tool !== 'open') return { ...job, project };
  const args = job.args as { dir?: unknown } | null;
  if (!args || typeof args.dir !== 'string' || !isAbsolute(args.dir) || args.dir.includes('\0')) {
    throw new DapiError('invalid-input', 'Esta sesión necesita la carpeta absoluta de su propio proyecto.');
  }
  const dir = await canonical(args.dir);
  if (projectKey({ id: project.id, dir }) !== projectKey(project)) {
    throw new DapiError('invalid-input', 'Esta sesión solo puede abrir su propio proyecto.');
  }
  return { ...job, project, args: { ...args, dir: project.dir } };
}
