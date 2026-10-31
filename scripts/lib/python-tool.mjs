import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { installTool } from './toolchain.mjs';
import { GRAPHIFY_UV } from './graphify-setup.mjs';
import { managedGraphifyPython, GRAPHIFY_PYTHON_VERSION } from './graphify-paths.mjs';

/** Same pinned Python distribution already used by Graphify, in the app's
 * tools folder. No system PATH, executable links or registry registration. */
export function pythonToolPath(toolsRoot) { return managedGraphifyPython(toolsRoot); }
export async function ensurePythonTool(toolsRoot, options = {}) {
  const execute = options.execute ?? promisify(execFile);
  const env = { ...process.env, UV_PYTHON_INSTALL_DIR: join(toolsRoot, 'python'),
    UV_CACHE_DIR: join(toolsRoot, 'uv-cache'), UV_NO_CONFIG: '1', UV_NO_PROGRESS: '1' };
  const path = pythonToolPath(toolsRoot);
  const healthy = async () => {
    try {
      await execute(path, ['-c', `import sys, ssl, json; assert sys.version_info[:3] == (${GRAPHIFY_PYTHON_VERSION.split('.').join(', ')})`], { env, timeout: 10_000, windowsHide: true });
      return true;
    } catch { return false; }
  };
  if (await healthy()) return path;
  await (options.installTool ?? installTool)(toolsRoot, GRAPHIFY_UV);
  await execute(join(toolsRoot, 'uv', 'uv.exe'), ['python', 'install', '--no-bin', '--no-registry', '--install-dir', join(toolsRoot, 'python'), GRAPHIFY_PYTHON_VERSION],
    { env, timeout: 300_000, windowsHide: true, maxBuffer: 1024 * 1024 });
  if (!await healthy()) throw Error('Python no pasó la comprobación de ejecución. Reintentá desde Herramientas locales.');
  return path;
}
