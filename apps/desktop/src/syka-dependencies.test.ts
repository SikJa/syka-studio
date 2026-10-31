import { afterAll, beforeEach, expect, it, vi } from 'vitest';
const resources = Object.getOwnPropertyDescriptor(process, 'resourcesPath');
Object.defineProperty(process, 'resourcesPath', { value: 'C:/fixture/resources', configurable: true });
afterAll(() => { if (resources) Object.defineProperty(process, 'resourcesPath', resources); else Reflect.deleteProperty(process, 'resourcesPath'); });
const state = vi.hoisted(() => ({ install: vi.fn(), emit: vi.fn(), complete: false, handlers: new Map<string, Function>() }));
vi.mock('../../../scripts/lib/python-tool.mjs',()=>({ensurePythonTool:async()=> 'C:/fixture/python.exe',pythonToolPath:(root:string)=>root+'/python/python.exe'}));
vi.mock('electron', () => ({ app: { getPath: () => 'C:/fixture', getAppPath: () => 'C:/fixture/app' }, BrowserWindow: { getAllWindows: () => [{}] } }));
vi.mock('./app-mode', () => ({ isPackagedBuild: () => true }));
vi.mock('../../../packages/agent-chat/src/host/env', () => ({ knownDirs: () => [] }));
vi.mock('../../../packages/agent-chat/src/host/local-tools', () => ({
  detectLocalTools: () => ['node','ffmpeg','ffprobe','yt-dlp'].map(name => ({ name, source: state.complete ? 'managed' : 'missing', path: state.complete ? 'C:/fixture/'+name+'.exe' : null })),
  addToolDirectories: (env: unknown) => env, resolveLocalTool: () => ({ path: null }),
}));
vi.mock('../../../scripts/lib/toolchain.mjs', () => ({ windowsTools: [
  { id: 'node', names: ['node'] }, { id: 'ffmpeg', names: ['ffmpeg','ffprobe'] }, { id: 'yt-dlp', names: ['yt-dlp'] },
], installTool: state.install, toolComplete: async () => state.complete }));
import { ensurePackagedTools, registerSykaDependencies } from './syka-dependencies';
import { MAIN_CHANNELS } from './main-channels';
beforeEach(() => { state.install.mockReset(); state.emit.mockClear(); state.complete = false; });
it.skipIf(process.platform !== 'win32' || process.arch !== 'x64')('keeps preparing other tools after one download fails and reports the missing tool', async () => {
  registerSykaDependencies({ handle: (key: string, handler: Function) => state.handlers.set(key, handler), emit: state.emit } as never);
  state.install.mockImplementation(async (_root, tool) => { if (tool.id === 'ffmpeg') throw Error('offline fixture'); });
  await Promise.all([ensurePackagedTools(), ensurePackagedTools()]);
  expect(state.install.mock.calls.map(call => call[1].id)).toEqual(['node','ffmpeg','yt-dlp']);
  const status = await state.handlers.get(MAIN_CHANNELS.SYKA_DEPENDENCIES)!({});
  expect(status.setup.phase).toBe('error');
  expect(status.setup.message).toContain('ffmpeg');
  state.install.mockResolvedValue(undefined);
  await ensurePackagedTools();
  expect(state.emit.mock.calls.at(-1)?.[2]).toEqual({ phase: 'ready' });
});
it.skipIf(process.platform !== 'win32' || process.arch !== 'x64')('does not download managed tools again when their integrity check passes', async () => {
  state.complete = true;
  await ensurePackagedTools();
  expect(state.install).not.toHaveBeenCalled();
});
