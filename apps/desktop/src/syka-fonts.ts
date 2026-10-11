import { isPackagedBuild } from './app-mode';
import { app, dialog } from 'electron';
import { join } from 'node:path';
import { MAIN_CHANNELS } from './main-channels';
import type { mainBridge } from './main-manager';
import { FontStore } from './font-import';
import { runtimeDirectory } from './runtime-paths';

export function registerSykaFonts(bridge: typeof mainBridge) {
  const store = new FontStore(join(runtimeDirectory({ packaged: isPackagedBuild(), appPath: app.getAppPath(), userData: app.getPath('userData'), override: process.env.SYKA_RUNTIME_ROOT }), 'fonts'));
  bridge.handle(MAIN_CHANNELS.SYKA_FONTS, async request => {
    if (request.action === 'list') return store.list();
    if (request.action !== 'import') throw Error('Acción de fuentes desconocida.');
    const picked = await dialog.showOpenDialog({ title: 'Importar fuentes propias', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Fuentes OpenType', extensions: ['otf', 'ttf', 'ttc'] }] });
    return picked.canceled ? store.list() : store.import(picked.filePaths);
  });
}
