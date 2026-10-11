import { isPackagedBuild } from './app-mode';
import { app, BrowserWindow } from 'electron';
import { join, resolve, delimiter } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { knownDirs } from '../../../packages/agent-chat/src/host/env';
import { addToolDirectories, detectLocalTools, resolveLocalTool, type LocalToolName } from '../../../packages/agent-chat/src/host/local-tools';
import { MAIN_CHANNELS } from './main-channels';
import type { mainBridge } from './main-manager';
import { windowsTools, installTool, toolComplete } from '../../../scripts/lib/toolchain.mjs';
import type { DependencyProgress, DependencyStatus } from './dependency-types';

let setup: DependencyProgress = { phase: 'idle' };
let installing: Promise<void> | null = null;
let events: typeof mainBridge | null = null;
function updateSetup(value: DependencyProgress) {
  setup = value;
  for (const window of BrowserWindow.getAllWindows()) events?.emit(window, MAIN_CHANNELS.SYKA_DEPENDENCIES_CHANGED, value);
}

export function toolSearch() {
  const runtime = process.env.SYKA_RUNTIME_ROOT || app.getPath('userData');
  return {
    env: Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    roots: [join(runtime, 'tools'), ...(isPackagedBuild() ? [join(process.resourcesPath, 'runtime'), join(process.resourcesPath, 'tools'), process.resourcesPath]
      : [resolve(app.getAppPath(), '../../../tools')])],
    extraDirs: knownDirs(),
  };
}
export function localToolPath(name: LocalToolName): string | undefined { return resolveLocalTool(name, toolSearch()).path ?? undefined; }
export function agentToolEnvironment(): Record<string, string> {
  const search = toolSearch(), env = addToolDirectories(search.env, detectLocalTools(search));
  const root = join(process.env.SYKA_RUNTIME_ROOT || app.getPath('userData'), 'tools');
  // Keep the managed paths in an existing host's environment after a first-run
  // offline failure; a successful repair then works without restarting it.
  env.PATH = [join(root, 'node'), join(root, 'ffmpeg', 'bin'), join(root, 'yt-dlp'), env.PATH].join(delimiter);
  return env;
}
async function adequateSystemTool(id: string, path: string): Promise<boolean> {
  try {
    const { stdout } = await promisify(execFile)(path, [id === 'ffmpeg' ? '-version' : '--version'], { timeout: 5000, maxBuffer: 4096, windowsHide: true });
    if (id === 'node') { const found = /v(\d+)\.(\d+)/.exec(stdout); return !!found && (Number(found[1]) > 22 || Number(found[1]) === 22 && Number(found[2]) >= 12); }
    if (id === 'ffmpeg') { const found = /ffmpeg version n?(\d+)\./.exec(stdout); return !!found && Number(found[1]) >= 7; }
    return /^\s*2026\.(?:0[8-9]|1[0-2])\.|^\s*20(?:2[7-9]|[3-9]\d)\./.test(stdout);
  } catch { return false; }
}
function dependencyStatus(): DependencyStatus {
  return {
    tools: detectLocalTools(toolSearch()),
    runtime: process.env.SYKA_RUNTIME_ROOT || app.getPath('userData'),
    packaged: isPackagedBuild(),
    setup,
  };
}
/** Configure missing packaged tools without changing PATH, accounts or global installations. */
export function ensurePackagedTools(): Promise<void> {
  if (!isPackagedBuild() || process.platform !== 'win32' || process.arch !== 'x64') return Promise.resolve();
  if (installing) return installing;
  const root = join(process.env.SYKA_RUNTIME_ROOT || app.getPath('userData'), 'tools');
  installing = (async () => {
    try {
      for (const tool of windowsTools) {
        // Use a verified managed installation or existing local tools. Never
        // replace an explicit override or a global provider installation.
        const current = detectLocalTools(toolSearch());
        if (tool.names.some(name => current.find(item => item.name === name)?.issue)) throw Error('Invalid configured tool path.');
        const available = tool.names.every(name => current.find(item => item.name === name)?.path);
        const managed = tool.names.some(name => current.find(item => item.name === name)?.source === 'managed');
        if (available && (managed ? await toolComplete(root, tool) : await adequateSystemTool(tool.id, current.find(item => item.name === tool.id)!.path!))) continue;
        updateSetup({ phase: 'installing', tool: tool.id, percent: 0 });
        let previous = -1;
        await installTool(root, tool, { progress(received, size) {
          const percent = size ? Math.floor(received * 100 / size) : undefined;
          if (percent !== previous) { previous = percent ?? -1; updateSetup({ phase: 'installing', tool: tool.id, percent }); }
        } });
      }
      updateSetup({ phase: 'ready' });
    } catch { updateSetup({ phase: 'error', message: 'No se pudieron configurar las herramientas. Revisá tu conexión y volvé a intentar desde Configuración.' }); }
  })().finally(() => { installing = null; });
  return installing;
}
export function dependenciesBusy(): boolean { return installing !== null; }
export function registerSykaDependencies(bridge: typeof mainBridge, busy: () => boolean | Promise<boolean> = () => false): void {
  events = bridge;
  bridge.handle(MAIN_CHANNELS.SYKA_DEPENDENCIES, async request => {
    if (request?.action === 'install') {
      if (!installing && await busy()) throw Error('Hay tareas en curso. Esperá a que terminen antes de configurar las herramientas.');
      await ensurePackagedTools();
    }
    return dependencyStatus();
  });
}
