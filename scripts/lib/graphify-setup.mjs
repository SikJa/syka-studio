import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rename, rm, lstat, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { childPath, installTool } from './toolchain.mjs';
import { rebaseGraphifyConfig, managedGraphifyPython, GRAPHIFY_PYTHON_VERSION } from './graphify-paths.mjs';

export const GRAPHIFY_VERSION = '0.9.76';
export const GRAPHIFY_UV = Object.freeze({ id: 'uv', names: ['uv'], version: '0.11.28', format: 'zip',
  url: 'https://github.com/astral-sh/uv/releases/download/0.11.28/uv-x86_64-pc-windows-msvc.zip',
  sha256: '0a23463216d09c6a72ff80ef5dc5a795f07dc1575cb84d24596c2f124a441b7b',
  prefix: '', files: ['uv.exe'], license: 'MIT OR Apache-2.0' });
const execute = promisify(execFile);
const running = new Map();
const pythonIn = dir => join(dir, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const probe = `from importlib.metadata import version; import graphify.extract, graphify.build, graphify.cluster; assert version('graphifyy') == '${GRAPHIFY_VERSION}'`;
async function healthy(dir, env, log = () => {}) {
  try {
    await execute(pythonIn(dir), ['-c', probe], { env, timeout: 60_000, windowsHide: true });
    await execute(join(dir, process.platform === 'win32' ? 'Scripts/graphify.exe' : 'bin/graphify'), ['--help'], { env, timeout: 20_000, windowsHide: true });
    return true;
  } catch (error) { log(`Comprobación de Graphify: ${String(error.stderr || error.message).slice(0, 600)}`); return false; }
}
/** Only called for an explicitly configured source-code index, never video projects. */
export function ensureGraphifyRuntime(root, log = () => {}) {
  root = resolve(root);
  if (running.has(root)) return running.get(root);
  const task = prepare(root, log).finally(() => running.delete(root));
  running.set(root, task);
  return task;
}
async function prepare(root, log) {
  const runtime = join(root, '.runtime'), destination = join(runtime, 'graphify');
  const configPath = join(destination, 'pyvenv.cfg');
  const config = await readFile(configPath, 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; return ''; });
  const rebased = process.platform === 'win32' ? rebaseGraphifyConfig(config, runtime) : config;
  // Existing environments must work before they can be considered installed.
  if (config === rebased && await healthy(destination, process.env)) return pythonIn(destination);
  if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('Graphify requiere reparar su entorno Python local en esta plataforma.');
  await mkdir(runtime, { recursive: true });
  const physicalRuntime = await realpath(runtime);
  if ((await lstat(runtime)).isSymbolicLink()) throw Error('La carpeta runtime de Graphify está redirigida.');
  const lock = childPath(runtime, 'graphify-setup.lock');
  try { await mkdir(lock); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const owner = await readFile(join(lock, 'owner.json'), 'utf8').then(JSON.parse).catch(() => null);
    let alive = true;
    if (owner?.pid) try { process.kill(owner.pid, 0); } catch (error) { alive = error.code !== 'ESRCH'; }
    if (!alive) {
      // Preserve stale lock evidence and let the next attempt repair the runtime.
      await rename(lock, childPath(runtime, `graphify-setup.stale-${randomUUID()}`));
    }
    throw Error('La preparación de Graphify ya está en curso; se reintentará en un minuto.');
  }
  await writeFile(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid }));
  const stage = childPath(runtime, `graphify-stage-${randomUUID()}`);
  const backup = childPath(runtime, `graphify-previous-${randomUUID()}`);
  const env = { ...process.env, UV_PYTHON_INSTALL_DIR: join(runtime, 'python'), UV_CACHE_DIR: join(runtime, 'uv-cache'),
    UV_NO_CONFIG: '1', UV_NO_PROGRESS: '1', PYTHONUTF8: '1' };
  let backedUp = false, promoted = false;
  try {
    if (config !== rebased) {
      // A copied runtime can be repaired offline, even if the old drive still exists.
      const base = managedGraphifyPython(runtime);
      const info = await lstat(base).catch(() => null);
      if (info?.isFile() && !info.isSymbolicLink() && !(await lstat(destination)).isSymbolicLink()) {
        const version = await execute(base, ['--version'], { env, windowsHide: true, timeout: 10_000 });
        if (version.stdout.trim() === `Python ${GRAPHIFY_PYTHON_VERSION}`) {
          await writeFile(join(destination, `pyvenv.cfg.before-relocation-${randomUUID()}`), config);
          const temp = join(destination, `pyvenv.cfg-${randomUUID()}.tmp`);
          await writeFile(temp, rebased);
          await rename(temp, configPath);
          log('Rutas de Graphify adaptadas a la ubicación actual, sin descargar dependencias.');
        }
      }
    }
    if (await healthy(destination, env)) return pythonIn(destination);
    log('Preparando Graphify y Python locales…');
    await installTool(runtime, GRAPHIFY_UV);
    const uv = join(runtime, 'uv', 'uv.exe');
    await execute(uv, ['venv', '--relocatable', '--managed-python', '--python', GRAPHIFY_PYTHON_VERSION, stage], { env, timeout: 300_000, windowsHide: true });
    await execute(uv, ['pip', 'install', '--python', pythonIn(stage), '--index-url', 'https://pypi.org/simple', `graphifyy==${GRAPHIFY_VERSION}`], { env, timeout: 300_000, maxBuffer: 1024 * 1024, windowsHide: true });
    if (!await healthy(stage, env, log)) throw Error('El entorno nuevo de Graphify no pasó la comprobación.');
    if (await realpath(runtime) !== physicalRuntime) throw Error('La carpeta runtime cambió durante la instalación.');
    const current = await lstat(destination).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
    if (current?.isSymbolicLink()) throw Error('El entorno de Graphify está redirigido.');
    if (current) { await rename(destination, backup); backedUp = true; }
    await rename(stage, destination); promoted = true;
    if (!await healthy(destination, env, log)) throw Error('Graphify no funciona desde su ruta definitiva.');
    log('Graphify listo; se conserva el entorno anterior para recuperación.');
    return pythonIn(destination);
  } catch (error) {
    if (promoted) await rename(destination, stage);
    if (backedUp) await rename(backup, destination);
    throw error;
  } finally {
    // No project/index data is removed; failed stages and previous installs remain recoverable.
    await rm(lock, { recursive: true, force: true });
  }
}
