import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { UpdateRequest, UpdateState } from './update-types';

const mocks = vi.hoisted(() => ({
  app: { isPackaged: true, getAppPath: vi.fn(), getVersion: vi.fn(() => '0.208.0'), relaunch: vi.fn(), quit: vi.fn() },
  autoUpdater: { on: vi.fn(), removeListener: vi.fn(), setFeedURL: vi.fn(), checkForUpdates: vi.fn(), quitAndInstall: vi.fn() },
  showMessageBox: vi.fn(async () => ({ response: 1 })), openExternal: vi.fn(), agentBusy: vi.fn(async () => false),
  handle: vi.fn(), emit: vi.fn(),
}));
vi.mock('electron', () => ({ app: mocks.app, autoUpdater: mocks.autoUpdater,
  dialog: { showMessageBox: mocks.showMessageBox }, shell: { openExternal: mocks.openExternal } }));
vi.mock('./main-manager', () => ({ mainBridge: { handle: mocks.handle, emit: mocks.emit } }));
vi.mock('./agent-chat', () => ({ isAgentChatBusy: mocks.agentBusy }));
import { registerUpdates } from './updates';

const appPath = fileURLToPath(new URL('../', import.meta.url));
const stops: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  mocks.app.isPackaged = true; mocks.app.getAppPath.mockReturnValue(appPath);
  mocks.showMessageBox.mockResolvedValue({ response: 1 }); mocks.agentBusy.mockResolvedValue(false);
  vi.stubEnv('SYKA_DEV_RUN', '1'); vi.stubEnv('SYKA_UPDATE_DEMO', '1');
  vi.stubEnv('SYKA_UPDATE_DEMO_APPLIED', '');
  vi.stubEnv('SYKA_RUNTIME_ROOT', resolve(appPath, '../../.runtime/update-demo'));
  vi.stubGlobal('process', Object.assign(Object.create(process), { defaultApp: true }));
});
afterEach(() => { for (const stop of stops.splice(0)) stop(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
async function ready(filesBusy = () => false) {
  stops.push(registerUpdates(() => null, filesBusy));
  const request = mocks.handle.mock.calls.at(-1)![1] as (request: UpdateRequest) => Promise<UpdateState>;
  const checking = request({ action: 'check' }); await vi.advanceTimersByTimeAsync(900); await checking;
  await request({ action: 'download' }); await vi.advanceTimersByTimeAsync(5000);
  expect((await request({ action: 'status' })).phase).toBe('ready');
  return request;
}
describe('update IPC safety and native confirmation', () => {
  it('keeps Later as the default and never touches the native updater in the demo', async () => {
    const request = await ready();
    expect((await request({ action: 'install', locale: 'es' })).phase).toBe('ready');
    expect(mocks.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({ defaultId: 1, cancelId: 1,
      buttons: ['Reiniciar e instalar', 'Después'], detail: expect.stringContaining('Simulación local') }));
    expect(mocks.app.relaunch).not.toHaveBeenCalled();
    expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(mocks.autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    expect(mocks.emit.mock.calls.at(-1)![2]).toMatchObject({ phase: 'ready', simulation: 'preview' });
  });
  it('restarts only after acceptance and keeps the marker for the next launch', async () => {
    const request = await ready(); mocks.showMessageBox.mockResolvedValue({ response: 0 });
    await request({ action: 'install', locale: 'pt-BR' });
    expect(mocks.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({ buttons: ['Reiniciar e instalar', 'Depois'] }));
    expect(mocks.app.relaunch).toHaveBeenCalledTimes(1); expect(mocks.app.quit).toHaveBeenCalledTimes(1);
    expect(process.env.SYKA_UPDATE_DEMO_APPLIED).toBe('0.208.0:0.209.0');
  });
  it('blocks restart during file work or an agent task and checks again after confirmation', async () => {
    let busy = false; const request = await ready(() => busy);
    busy = true; await expect(request({ action: 'install' })).rejects.toThrow('tareas en curso');
    busy = false; mocks.agentBusy.mockResolvedValue(true);
    await expect(request({ action: 'install' })).rejects.toThrow('tareas en curso');
    expect(mocks.showMessageBox).not.toHaveBeenCalled();
    mocks.agentBusy.mockResolvedValue(false);
    mocks.showMessageBox.mockImplementationOnce(async () => { busy = true; return { response: 0 }; });
    await expect(request({ action: 'install' })).rejects.toThrow('Empezó una tarea');
    expect(mocks.app.relaunch).not.toHaveBeenCalled();
  });
  it('rejects the reset action outside the dedicated developer profile', async () => {
    vi.stubEnv('SYKA_RUNTIME_ROOT', resolve('real-user-profile'));
    stops.push(registerUpdates(() => null, () => false));
    const request = mocks.handle.mock.calls.at(-1)![1];
    await expect(request({ action: 'demo-reset' })).rejects.toThrow('no está habilitada');
    expect((await request({ action: 'status' })).simulation).toBeUndefined();
    expect(mocks.app.relaunch).not.toHaveBeenCalled();
  });
});
