import { isAbsolute, join, resolve } from 'node:path';

/** Packaged application data belongs to the user, never the installation directory. */
export function runtimeDirectory(options: { packaged: boolean; appPath: string; userData: string; override?: string }): string {
  if (options.override) {
    if (!isAbsolute(options.override)) throw Error('SYKA_RUNTIME_ROOT debe ser una ruta absoluta.');
    return options.override;
  }
  return options.packaged ? options.userData : join(resolve(options.appPath, '../../..'), '.runtime', 'diffusion');
}
