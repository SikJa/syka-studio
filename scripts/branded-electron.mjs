// Development uses a private Electron copy with the same Windows identity as
// the packaged app. Never patch the shared node_modules executable in place.
import { createHash, randomUUID } from 'node:crypto';
import { cp, copyFile, mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
// Cache folders contain a dotted Electron version followed by randomUUID().
// Check that exact shape; a blanket alphanumeric check rejects our own cache.
export function isManagedElectronDirectory(directory, electronVersion) {
  const prefix = `${electronVersion}-`;
  return typeof directory === 'string' && directory.startsWith(prefix)
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(directory.slice(prefix.length));
}

export async function brandedElectron(root, runtime) {
  const original = require('electron');
  if (process.platform !== 'win32') return original;
  const icon = join(root, 'apps', 'desktop', 'syka-assets', 'icon.ico');
  const version = JSON.parse(await readFile(join(root, 'apps/desktop/package.json'), 'utf8')).version;
  const electronVersion = JSON.parse(await readFile(require.resolve('electron/package.json'), 'utf8')).version;
  const digest = createHash('sha256').update(await readFile(icon)).update(version).update(electronVersion).update('identity-v1').digest('hex');
  const parent = resolve(runtime, 'electron-dev');
  await mkdir(parent, { recursive: true });
  const pointer = join(parent, 'current.json');
  try {
    const saved = JSON.parse(await readFile(pointer, 'utf8'));
    // A local cache pointer may never select an executable outside this folder.
    if (saved.digest === digest && isManagedElectronDirectory(saved.directory, electronVersion)) {
      const directory = join(parent, saved.directory);
      const directoryInfo = await lstat(directory);
      if (directoryInfo.isDirectory() && !directoryInfo.isSymbolicLink()) {
        const binary = join(directory, 'Syka Studio.exe');
        const binaryInfo = await lstat(binary);
        if (binaryInfo.isFile() && !binaryInfo.isSymbolicLink()) return binary;
      }
    }
  } catch { /* First launch or incomplete cache: stage another private copy. */ }
  const directory = `${electronVersion}-${randomUUID()}`;
  const target = join(parent, directory), binary = join(target, 'Syka Studio.exe');
  await cp(dirname(original), target, { recursive: true, filter: path => path !== original });
  await copyFile(original, binary);
  // This is exactly the resource editor used by the installed Forge packager.
  const { resedit } = require(join(dirname(require.resolve('@electron/packager')), 'resedit.js'));
  await resedit(binary, { iconPath: icon, fileVersion: version, productVersion: version, productName: 'Syka Studio',
    win32Metadata: { CompanyName: 'Syka Studio', ProductName: 'Syka Studio', FileDescription: 'Syka Studio', InternalName: 'Syka Studio', OriginalFilename: 'Syka Studio.exe' } });
  await writeFile(pointer, JSON.stringify({ digest, directory, electronVersion, version }, null, 2));
  return binary;
}
