import { mainBridge } from './ipc';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import type { NoticeReport } from '../../../../packages/agent-chat/src/notifications';

/** Completion never fails the completed operation if the overlay is unavailable. */
export function notifyOperation(project: { id?: string; dir: string }, notice: NoticeReport) {
  if (!window.desktop) return Promise.resolve();
  return mainBridge.call(MAIN_CHANNELS.SYKA_NOTIFICATIONS, { action: 'report', projectId: project.id, projectDir: project.dir, notice })
    .then(() => {}, error => console.error('[notices] No se pudo mostrar el aviso:', error));
}

export function resolveOperation(dir: string, kind: NoticeReport['kind'], operationId: string) {
  if (!window.desktop) return Promise.resolve();
  return mainBridge.call(MAIN_CHANNELS.SYKA_NOTIFICATIONS, { action: 'resolve', projectDir: dir, kind, operationId }).then(() => {}, console.error);
}
