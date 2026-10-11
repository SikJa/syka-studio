import { createEffect, onCleanup, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { mainBridge } from '@/lib/ipc';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { accent } from '@/lib/appearance/controller';
import { projectRoute } from '@/hooks/use-project-route';
import { openChat, setActiveChat, setSidebarTab } from '@/agent-chat/store';
import { openSettings } from '@/components/settings/state';
import { getProject, markProjectsChanged } from '@/projects';
import { rememberProject } from '@/lib/db';
import { toast } from 'somoto';
import type { NoticeNavigation } from '../../../../packages/agent-chat/src/notifications';

export function DesktopNotificationBridge() {
  const navigate = useNavigate();
  let navigationRevision = 0;
  async function open(notice: NoticeNavigation) {
    const revision = ++navigationRevision;
    if (notice.settings) openSettings(notice.settings === 'groq' ? 'groq' : 'codex');
    if (notice.projectId) {
      // Chats started by the CLI/background host may not be in this renderer's
      // local project list yet. Validate the existing folder and register its
      // record; never scaffold or recreate a missing project from a notice.
      if (notice.projectDir) {
        const project = await getProject(notice.projectDir);
        if (revision !== navigationRevision) return;
        if (!project || project.id !== notice.projectId) throw Error('Ese proyecto ya no está disponible en su carpeta original.');
        await rememberProject(project);
        if (revision !== navigationRevision) return;
        markProjectsChanged();
      }
      if (notice.chatId) { setActiveChat(notice.projectId, notice.chatId); setSidebarTab('chat'); openChat(notice.chatId); }
      navigate(projectRoute(notice.projectId) + (notice.chatId ? '?chat=' + encodeURIComponent(notice.chatId) : ''));
    }
  }
  function receive(notice: NoticeNavigation) {
    void open(notice).catch(error => toast.error((error as Error).message));
  }
  onMount(() => {
    if (!window.desktop) return;
    onCleanup(mainBridge.handle(MAIN_CHANNELS.SYKA_NOTICE_NAVIGATE, notice => {
      // A delivered destination must not replay after a renderer reload/HMR.
      void mainBridge.call(MAIN_CHANNELS.SYKA_NOTICE_NAVIGATE, undefined).catch(console.error);
      receive(notice);
    }));
    void mainBridge.call(MAIN_CHANNELS.SYKA_NOTICE_NAVIGATE, undefined).then(notice => { if (notice) receive(notice); }).catch(console.error);
  });
  createEffect(() => {
    const color = accent();
    if (window.desktop) void mainBridge.call(MAIN_CHANNELS.SYKA_NOTIFICATIONS, { action: 'appearance', accent: color }).catch(console.error);
  });
  return null;
}
