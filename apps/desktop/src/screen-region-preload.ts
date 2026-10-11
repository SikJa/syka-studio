import { contextBridge, ipcRenderer } from 'electron';
// Only the selector's two operations are exposed, never the editor IPC bridge.
contextBridge.exposeInMainWorld('sykaRegion', {
  complete: (region: { x: number; y: number; width: number; height: number }) => ipcRenderer.send('syka:region-result', region),
  cancel: () => ipcRenderer.send('syka:region-result', null),
});
