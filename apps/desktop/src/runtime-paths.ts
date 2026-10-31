import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

type LaunchRoots = { runtimeRoot?: string; mediaRoot?: string };
const usable = (path: unknown): path is string => typeof path === 'string' && isAbsolute(path) && existsSync(path);

/**
 * Launches that skip the launcher (a notification, the .exe itself) must open
 * the same profile and projects: a different profile has a different
 * encryption key, so Groq/Zernio credentials and chats look lost. The first
 * explicit launch records its folders; later explicit launches never rewrite
 * them, so a QA copy with its own folders cannot hijack the real profile.
 */
export function applyLaunchRoots(pointer: string, env: NodeJS.ProcessEnv): void {
  let saved: LaunchRoots = {};
  try { saved = JSON.parse(readFileSync(pointer, 'utf8')); } catch { /* No pointer yet. */ }
  if (env.SYKA_RUNTIME_ROOT) {
    if (saved.runtimeRoot || !isAbsolute(env.SYKA_RUNTIME_ROOT)) return;
    try {
      mkdirSync(dirname(pointer), { recursive: true });
      const temporary = `${pointer}.${process.pid}.tmp`;
      writeFileSync(temporary, JSON.stringify({ runtimeRoot: env.SYKA_RUNTIME_ROOT, ...(env.SYKA_MEDIA_ROOT ? { mediaRoot: env.SYKA_MEDIA_ROOT } : {}) }, null, 2));
      renameSync(temporary, pointer);
    } catch { /* Remembering is best effort; this launch already has its folders. */ }
    return;
  }
  if (!usable(saved.runtimeRoot)) return;
  env.SYKA_RUNTIME_ROOT = saved.runtimeRoot;
  if (!env.SYKA_MEDIA_ROOT && usable(saved.mediaRoot)) env.SYKA_MEDIA_ROOT = saved.mediaRoot;
}

/** Packaged application data belongs to the user, never the installation directory. */
export function runtimeDirectory(options: { packaged: boolean; appPath: string; userData: string; override?: string }): string {
  if (options.override) {
    if (!isAbsolute(options.override)) throw Error('SYKA_RUNTIME_ROOT debe ser una ruta absoluta.');
    return options.override;
  }
  return options.packaged ? options.userData : join(resolve(options.appPath, '../../..'), '.runtime', 'diffusion');
}
