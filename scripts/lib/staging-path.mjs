import { lstatSync, realpathSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

/** Validate the physical target before a stage script recursively replaces it. */
export function assertStagingDirectory(parent, target, name) {
  const absolute = resolve(target);
  const physicalParent = realpathSync(parent);
  if (basename(absolute) !== name || realpathSync(dirname(absolute)) !== physicalParent) {
    throw Error(`Refusing to replace ${name} outside the desktop staging directory.`);
  }
  let entry;
  try { entry = lstatSync(absolute); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (entry) {
    if (entry.isSymbolicLink() || !entry.isDirectory() || dirname(realpathSync(absolute)) !== physicalParent) {
      throw Error(`Refusing to replace a redirected ${name} staging directory.`);
    }
  }
  return absolute;
}
