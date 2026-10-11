import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { npm } from '../../../scripts/lib/npm.mjs';

// Staged native dependencies match the build host. Build separately on Apple
// Silicon and Intel: a Windows artifact cannot validate a Mac release.
if (process.platform !== 'darwin') {
  console.error('El instalador de Mac se compila en macOS. Ejecutá este comando en una Mac Intel o Apple Silicon.');
  process.exit(1);
}
if (!['arm64', 'x64'].includes(process.arch)) {
  console.error(`Arquitectura de Mac no compatible: ${process.arch}`);
  process.exit(1);
}
const args = process.argv.slice(2);
if (args.some(argument => argument !== '--unsigned')) {
  console.error('Uso: npm run make:mac o npm run make:mac:unsigned. Compila para la arquitectura de esta Mac.');
  process.exit(1);
}
const desktopDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, ...(args.includes('--unsigned') ? { SKIP_SIGN: '1' } : {}) };
npm(['run', 'make', '--', '--platform=darwin', `--arch=${process.arch}`], { cwd: desktopDir, env });
