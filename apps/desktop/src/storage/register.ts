import { app, powerMonitor } from 'electron';
import { MAIN_CHANNELS } from '../main-channels';
import type { mainBridge } from '../main-manager';
import { StorageService } from './service';

export function registerStorage(bridge: typeof mainBridge, busy: () => boolean): StorageService {
  const service = new StorageService({ runtime: process.env.SYKA_RUNTIME_ROOT || app.getPath('userData'), profile: app.getPath('userData'), busy, idle: () => app.isReady() && powerMonitor.getSystemIdleTime() >= 30, log: message => console.warn('[storage]', message) });
  bridge.handle(MAIN_CHANNELS.SYKA_STORAGE, async request => {
    if (request.action === 'get') return service.store.get();
    if (request.action === 'save') return service.store.save(request.expectedRevision, request.policy);
    if (request.action === 'overview') { const overview = await service.overview(); return { revision: overview.revision, policy: overview.policy, overview }; }
    if (request.action === 'clean') {
      if (!['eligible', 'cache'].includes(request.category)) throw Error('Elegí una categoría de limpieza válida.');
      const cleanup = await service.clean(request.category); return { ...await service.store.get(), cleanup };
    }
    if (request.action === 'restore') { await service.restore(request.id); return service.store.get(); }
    throw Error('Acción de almacenamiento desconocida.');
  });
  void app.whenReady().then(() => service.start());
  app.once('will-quit', () => service.stop());
  return service;
}
