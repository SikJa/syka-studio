import { app, dialog, safeStorage, shell } from 'electron';
import { join } from 'node:path';
import { MAIN_CHANNELS } from '../main-channels';
import type { mainBridge } from '../main-manager';
import type { PublicationRequest } from './types';
import { PublicationStore } from './store';
import { PublicationService } from './service';

export function registerPublication(bridge: typeof mainBridge) {
  const store = new PublicationStore(join(app.getPath('userData'), 'providers', 'zernio'), {
    available: () => safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
    encrypt: value => safeStorage.encryptString(value), decrypt: value => safeStorage.decryptString(value),
  });
  const service = new PublicationService(store, url => shell.openExternal(url));
  let initialized: Promise<void> | null = null;
  bridge.handle(MAIN_CHANNELS.SYKA_PUBLICATION, async (request: PublicationRequest) => {
    await (initialized ??= service.recover());
    if (!request || typeof request.action !== 'string') throw Error('Solicitud de publicación inválida.');
    switch (request.action) {
      case 'get': break;
      case 'add-key': await service.addConnection(request.label, request.key); break;
      case 'add-oauth': await service.addConnection(request.label); break;
      case 'sync': await service.sync(request.id); break;
      case 'cancel-oauth': service.oauth.cancel(request.id); break;
      case 'disconnect': await service.disconnect(request.id); break;
      case 'pick-export': {
        const choice = await dialog.showOpenDialog({ title: 'Elegí un video exportado', properties: ['openFile'], filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'm4v', 'webm'] }] });
        if (!choice.canceled && choice.filePaths[0]) await service.createDraft(choice.filePaths[0]); break;
      }
      case 'save-draft': await service.saveDraft(request.id, request.revision, request.changes); break;
      case 'delete-draft': await service.deleteDraft(request.id, request.revision); break;
      case 'submit': await service.submit(request.id, request.revision); break;
      case 'refresh-post': await service.refreshPost(request.id, request.revision); break;
      case 'cancel-upload': service.cancelUpload(request.id); break;
      default: throw Error('Acción de publicación desconocida.');
    }
    return service.overview();
  });
  app.on('before-quit', () => service.close());
}
