import { afterEach, describe, expect, it, vi } from 'vitest';
const electron = vi.hoisted(() => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { sendSync: vi.fn(() => ({ok:false,error:'Editor preferences are private'})), send: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
  webUtils: {getPathForFile:vi.fn()},
}));
vi.mock('electron', () => electron);
afterEach(() => {vi.unstubAllGlobals();vi.clearAllMocks();vi.resetModules();});
describe('preview preload isolation', () => {
  it('does not expose editor preferences to the internal renderer but keeps tool IPC', async () => {
    vi.stubGlobal('window',{location:{pathname:'/resources/app/web/preview-worker.html'}});
    await import('./preload');
    const bridge=electron.contextBridge.exposeInMainWorld.mock.calls[0][1];
    expect(bridge.preferences).toBeUndefined();
    bridge.send('dapi:preview-ready',{});
    expect(electron.ipcRenderer.send).toHaveBeenCalledWith('dapi:preview-ready',{});
    expect(electron.ipcRenderer.sendSync).not.toHaveBeenCalled();
  }, 15000);
  it('preserves durable editor preferences and does not swallow authorization failures', async () => {
    vi.stubGlobal('window',{location:{pathname:'/resources/app/web/index.html'}});
    await import('./preload');
    const bridge=electron.contextBridge.exposeInMainWorld.mock.calls[0][1];
    expect(()=>bridge.preferences.getItem('dspro.ui.model')).toThrow('Editor preferences are private');
  });
});
