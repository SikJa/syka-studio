import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ windows: [] as any[], loadError: false }));
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  class Window extends EventEmitter {
    destroyed = false; options: unknown;
    webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler: vi.fn() });
    setAlwaysOnTop = vi.fn(); show = vi.fn(); focus = vi.fn();
    constructor(options: unknown) { super(); this.options = options; state.windows.push(this); }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; this.emit('closed'); }
    loadURL() { return state.loadError ? Promise.reject(new Error('Load failed')) : Promise.resolve(); }
  }
  return { app: { getAppPath: () => 'isolated-app' }, BrowserWindow: Window, ipcMain: new EventEmitter(), screen: {
    getAllDisplays: () => [{ bounds: { x: -1920, y: 0, width: 1920, height: 1080 } }],
    dipToScreenRect: () => ({ x: -2400, y: 0, width: 2400, height: 1350 }),
  } };
});
import { ipcMain } from 'electron';
import type { WebContents } from 'electron';
import { samePhysicalScreen, selectScreenRegion, validSelectedRegion } from './screen-region-selector';
const bounds = { x: -2400, y: 0, width: 2400, height: 1350 };
const region = { x: .1, y: .2, width: .7, height: .5 };
const owner = () => Object.assign(new EventEmitter(), { isDestroyed: () => false }) as unknown as WebContents;
beforeEach(() => { state.windows.length = 0; state.loadError = false; ipcMain.removeAllListeners(); });
describe('desktop region selector', () => {
  it('uses DIP window bounds but validates physical pixels on a scaled, negative monitor', async () => {
    expect(samePhysicalScreen(bounds, { x: -2400, y: 0, width: 2400, height: 1350 })).toBe(true);
    expect(samePhysicalScreen(bounds, { x: -1920, y: 0, width: 1920, height: 1080 })).toBe(false);
    const pending = selectScreenRegion(owner(), bounds), window = state.windows[0];
    expect(window.options).toMatchObject({ x: -1920, y: 0, width: 1920, height: 1080, transparent: true, frame: false });
    ipcMain.emit('syka:region-result', { sender: {} }, region);
    expect(window.isDestroyed()).toBe(false);
    ipcMain.emit('syka:region-result', { sender: window.webContents }, region);
    expect(await pending).toEqual(region); expect(window.isDestroyed()).toBe(true);
    expect(ipcMain.listenerCount('syka:region-result')).toBe(0);
  });
  it.each(['blur', 'closed', 'owner-destroyed'])('cancels and removes handlers on %s', async action => {
    const client = owner(), pending = selectScreenRegion(client, bounds), window = state.windows[0];
    if (action === 'owner-destroyed') client.emit('destroyed'); else window.emit(action);
    expect(await pending).toBeNull(); expect(window.isDestroyed()).toBe(true);
    expect(ipcMain.listenerCount('syka:region-result')).toBe(0); expect(client.listenerCount('destroyed')).toBe(0);
  });
  it('cleans up a failed window load', async () => {
    state.loadError = true;
    await expect(selectScreenRegion(owner(), bounds)).rejects.toThrow('Load failed');
    expect(state.windows[0].isDestroyed()).toBe(true); expect(ipcMain.listenerCount('syka:region-result')).toBe(0);
  });
  it('closes when its recording panel unmounts and never creates an already cancelled selector', async () => {
    const controller = new AbortController(), pending = selectScreenRegion(owner(), bounds, controller.signal);
    controller.abort(); expect(await pending).toBeNull(); expect(state.windows[0].isDestroyed()).toBe(true);
    expect(ipcMain.listenerCount('syka:region-result')).toBe(0);
    expect(await selectScreenRegion(owner(), bounds, controller.signal)).toBeNull(); expect(state.windows).toHaveLength(1);
  });
  it('ignores nonfinite, out-of-screen and tiny rectangles', () => {
    expect(validSelectedRegion(region, bounds)).toBe(true);
    for (const value of [null, {}, { ...region, x: -.1 }, { ...region, width: 1 }, { ...region, height: NaN }, { ...region, width: .001 }]) expect(validSelectedRegion(value, bounds)).toBe(false);
  });
});
