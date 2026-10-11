import { app, BrowserWindow, ipcMain, screen } from 'electron';
import type { Rectangle, WebContents } from 'electron';
import { join } from 'node:path';
import type { ScreenRegion } from './screen-capture';
import { screenRegionHtml } from './screen-region-ui';

export function samePhysicalScreen(a: ScreenRegion, b: Rectangle): boolean {
  return (['x', 'y', 'width', 'height'] as const).every(key => Math.abs(a[key] - b[key]) <= 2);
}
export function validSelectedRegion(raw: unknown, bounds: ScreenRegion): raw is ScreenRegion {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as ScreenRegion;
  return [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.x >= 0 && r.y >= 0 && r.x + r.width <= 1.00001 && r.y + r.height <= 1.00001 && Math.floor(r.width * bounds.width) >= 16 && Math.floor(r.height * bounds.height) >= 16;
}

/** The window exists only while choosing. Destroy it before any recorder starts. */
export async function selectScreenRegion(owner: WebContents, bounds: ScreenRegion, signal?: AbortSignal): Promise<ScreenRegion | null> {
  if (owner.isDestroyed() || signal?.aborted) return null;
  const display = screen.getAllDisplays().find(item => samePhysicalScreen(bounds, screen.dipToScreenRect(null, item.bounds)));
  if (!display) throw new Error('La pantalla cambió. Actualizá la selección.');
  const overlay = new BrowserWindow({ ...display.bounds, show: false, frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true, resizable: false, movable: false, minimizable: false, maximizable: false,
    fullscreenable: false, hasShadow: false, backgroundColor: '#00000000', title: 'Syka Studio · Elegir zona',
    webPreferences: { preload: join(app.getAppPath(), 'dist', 'screen-region-preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  overlay.webContents.on('will-navigate', event => event.preventDefault());
  return new Promise<ScreenRegion | null>((resolve, reject) => {
    let settled = false;
    const finish = (region: ScreenRegion | null, error?: Error) => {
      if (settled) return; settled = true;
      clearTimeout(timeout); ipcMain.removeListener('syka:region-result', onResult);
      owner.removeListener('destroyed', onOwnerGone);
      signal?.removeEventListener('abort', onOwnerGone);
      if (!overlay.isDestroyed()) overlay.destroy();
      if (error) reject(error); else resolve(region);
    };
    const onResult = (event: Electron.IpcMainEvent, raw: unknown) => {
      if (event.sender !== overlay.webContents) return;
      if (raw === null) finish(null);
      else if (validSelectedRegion(raw, bounds)) finish(raw);
    };
    const onOwnerGone = () => finish(null);
    const timeout = setTimeout(() => finish(null), 120_000);
    ipcMain.on('syka:region-result', onResult); owner.once('destroyed', onOwnerGone);
    signal?.addEventListener('abort', onOwnerGone, { once: true });
    overlay.once('closed', () => finish(null));
    overlay.once('blur', () => finish(null));
    overlay.webContents.once('render-process-gone', () => finish(null, new Error('El selector de zona se cerró. Podés volver a intentarlo.')));
    overlay.once('ready-to-show', () => { if (!settled) { overlay.show(); overlay.focus(); } });
    void overlay.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(screenRegionHtml(bounds.width, bounds.height)))
      .catch(error => finish(null, error instanceof Error ? error : new Error(String(error))));
  });
}
