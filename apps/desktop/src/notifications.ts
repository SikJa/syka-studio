import { app, BrowserWindow, screen, shell } from 'electron';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { isPackagedBuild } from './app-mode';
import { getProject } from './projects';
import { mainBridge } from './main-manager';
import { MAIN_CHANNELS } from './main-channels';
import { answerAgentNotice } from './agent-chat';
import { notificationShape } from './notification-shape';
import { NotificationImages } from './notification-images';
import { cleanNoticeText, isAuthenticationError, NOTICE_TITLES, NoticeStore } from '../../../packages/agent-chat/src/notifications';
import type { AgentNoticeEvent, NoticeCommand, NoticeNavigation, NoticeReport, NoticeSnapshot, StudioNotice } from '../../../packages/agent-chat/src/notifications';

const DEV_URL = process.env.SYKA_DEV_URL || 'http://localhost:5188';
const store = new NoticeStore();
const images = new NotificationImages();
let overlay: BrowserWindow | null = null;
let editor: (() => BrowserWindow | null) | undefined;
let accent = '#008cff';
let serial = Promise.resolve();
let navigating: NoticeNavigation | undefined;
let windowReady = false;
let layout = { width: 300, height: 84 };
const nativeRegions = process.platform === 'win32';
let regionsReady = false;
let regionRectangles = 0;
const submitting = new Set<string>();
const resolvedWhileSubmitting = new Set<string>();
const snapshot = (): NoticeSnapshot => ({ notices: store.visible(), accent, sound: true,
  desktop: overlay && !overlay.isDestroyed() ? { visible: overlay.isVisible(), alwaysOnTop: overlay.isAlwaysOnTop(),
    backgroundThrottling: overlay.webContents.getBackgroundThrottling(), nativeRegions, regionRectangles } : undefined,
});

export function isNoticeWindow(contents: Electron.WebContents | null): boolean {
  return !!overlay && !overlay.isDestroyed() && overlay.webContents === contents;
}
export function trustedNoticeUrl(url: string): boolean {
  try {
    const candidate = new URL(url);
    if (!isPackagedBuild()) return candidate.origin === new URL(DEV_URL).origin && candidate.pathname === '/notifications.html';
    return candidate.protocol === 'file:' && decodeURIComponent(candidate.pathname).replace(/^\//, '').replace(/\//g, '\\').toLowerCase()
      === join(app.getAppPath(), 'web', 'notifications.html').replace(/\//g, '\\').replace(/^\//, '').toLowerCase();
  } catch { return false; }
}
export function allowedNoticeCommand(channel: string, data: unknown): boolean {
  if ([MAIN_CHANNELS.SYKA_GROQ_STATUS, MAIN_CHANNELS.SYKA_GROQ_TRANSCRIBE, MAIN_CHANNELS.SYKA_GLOSSARY_APPLY_TRANSCRIPT].includes(channel as never)) return true;
  if (channel !== MAIN_CHANNELS.SYKA_NOTIFICATIONS) return false;
  const action = (data as NoticeCommand)?.action;
  return ['list', 'dismiss', 'open', 'artifact', 'answer', 'attach-image', 'remove-image', 'attach-file', 'remove-file', 'layout', 'interactive'].includes(action);
}

function bounds() {
  const host = editor?.();
  const display = host && !host.isDestroyed() ? screen.getDisplayMatching(host.getBounds()) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const work = display.workArea;
  const width = Math.min(Math.max(120, Math.ceil(layout.width)), work.width - 24);
  // A stable viewport keeps the pointer's desktop coordinates unchanged while
  // panels animate. On Windows the native region excludes the transparent area.
  const height = nativeRegions ? Math.floor(work.height * .65)
    : Math.min(Math.max(76, Math.ceil(layout.height)), Math.floor(work.height * .65));
  return { x: work.x + work.width - width - 16, y: work.y + work.height - height - 16, width, height };
}
function createOverlay() {
  if (overlay && !overlay.isDestroyed()) return;
  windowReady = false;
  regionsReady = false;
  regionRectangles = 0;
  const window = new BrowserWindow({ ...bounds(), show: false, frame: false, transparent: true,
    backgroundColor: '#00000000', resizable: false, movable: false, maximizable: false, minimizable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, title: 'Syka Studio · Avisos',
    webPreferences: { preload: join(app.getAppPath(), 'dist', 'preload.js'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' },
  });
  overlay = window;
  if (nativeRegions) {
    window.setShape([{ x: -2, y: -2, width: 1, height: 1 }]);
    window.setIgnoreMouseEvents(false);
  } else window.setIgnoreMouseEvents(true, { forward: true });
  window.setAlwaysOnTop(true, 'screen-saver');
  window.on('show', raiseOverlay);
  window.on('blur', raiseOverlay);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!trustedNoticeUrl(url)) event.preventDefault(); });
  window.webContents.on('did-finish-load', () => {
    windowReady = true;
    if (store.visible().length) showOverlay();
    mainBridge.emit(window, MAIN_CHANNELS.SYKA_NOTICES_CHANGED, snapshot());
  });
  window.on('closed', () => { if (overlay === window) overlay = null; windowReady = false; });
  if (isPackagedBuild()) void window.loadFile(join(app.getAppPath(), 'web', 'notifications.html'));
  else void window.loadURL(new URL('/notifications.html', DEV_URL).href);
}
function raiseOverlay() {
  if (!overlay || overlay.isDestroyed() || !overlay.isVisible()) return;
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.moveTop();
}
function showOverlay() {
  if (!overlay || !windowReady || !store.visible().length || (nativeRegions && !regionsReady)) return;
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.showInactive();
  raiseOverlay();
}
function changed(show = false) {
  if (!store.visible().length) { mainBridge.emit(overlay, MAIN_CHANNELS.SYKA_NOTICES_CHANGED, snapshot()); overlay?.hide(); return; }
  createOverlay();
  mainBridge.emit(overlay, MAIN_CHANNELS.SYKA_NOTICES_CHANGED, snapshot());
  if (show && windowReady) { overlay!.setBounds(bounds()); showOverlay(); }
}

async function insert(notice: StudioNotice) {
  if (notice.artifact) {
    const info = await stat(notice.artifact);
    if (!info.isFile() || !info.size) throw Error('El resultado todavía no está disponible.');
  }
  const fresh = store.upsert(notice);
  changed(fresh);
}
export function reportNotice(projectDir: string, report: NoticeReport, chatId?: string): Promise<void> {
  const task = serial.catch(() => {}).then(async () => {
    const project = await getProject(projectDir);
    if (!project?.id) return;
    await insert({ id: `${project.id}:${report.kind}:${report.operationId}`, kind: report.kind,
      title: NOTICE_TITLES[report.kind], message: cleanNoticeText(report.message),
      projectId: project.id, projectDir, projectName: project.displayName || project.name, chatId,
      artifact: report.artifact, provider: report.provider, createdAt: Date.now() });
  });
  serial = task.catch(error => console.error('[notices] Cannot publish:', (error as Error).message));
  return task;
}
export function agentNotice(payload: AgentNoticeEvent): void {
  serial = serial.catch(() => {}).then(async () => {
    const { event, chat, cwd } = payload;
    const requestId = event.type === 'request.opened' ? event.request.id : event.type === 'request.resolved' ? event.requestId : undefined;
    const id = `${chat.id}:question:${requestId}`;
    if (event.type === 'request.resolved') {
      if (submitting.has(id)) resolvedWhileSubmitting.add(id);
      else { store.remove(id); void images.discard(id); changed(); }
      return;
    }
    const project = await getProject(cwd).catch(() => null);
    const base = { projectId: chat.projectId, projectDir: cwd, projectName: project?.displayName || project?.name || chat.title, chatId: chat.id, createdAt: Date.now() };
    if (event.type === 'request.opened') {
      resolvedWhileSubmitting.delete(id);
      const secret = event.request.questions.some(q => q.secret);
      // Secret prompts stay exclusively in the trusted editor; no credential preview.
      await insert({ ...base, id, kind: 'question', title: NOTICE_TITLES.question,
        message: secret ? 'Hay una pregunta privada. Respondela desde Syka.' : event.request.questions[0]?.question || 'Abrí Syka para responder.',
        request: secret ? undefined : event.request });
    } else if (event.type === 'project.notice') {
      const report = event.notice;
      await insert({ ...base, id: `${chat.projectId}:${report.kind}:${report.operationId}`, kind: report.kind,
        title: NOTICE_TITLES[report.kind], message: cleanNoticeText(report.message), artifact: report.artifact });
    } else if (event.type === 'turn.completed' && event.status === 'failed') {
      const auth = isAuthenticationError(event.error || '');
      await insert({ ...base, id: auth ? `${chat.projectId}:auth:${chat.harness}` : `${chat.id}:blocked:${event.turnId}`,
        kind: auth ? 'auth' : 'blocked', title: auth ? NOTICE_TITLES.auth : NOTICE_TITLES.blocked,
        message: auth ? 'La sesión del proveedor no está disponible. Abrí Modelos e IA para volver a conectar.' : cleanNoticeText(event.error || 'El trabajo se detuvo. Abrí el chat para ver qué falta.') });
    }
  }).catch(error => console.error('[notices] Event rejected:', (error as Error).message));
}

function navigate(notice: StudioNotice) {
  const window = editor?.();
  if (!window || window.isDestroyed()) throw Error('Abrí Syka Studio para continuar.');
  navigating = { projectId: notice.projectId, projectDir: notice.projectDir, chatId: notice.chatId, ...(notice.kind === 'auth' ? { settings: notice.provider || 'agents' as const } : {}) };
  if (window.isMinimized()) window.restore();
  window.show(); window.focus();
  if (window.webContents.isLoading()) {
    // The editor may have mounted its listener while fonts/assets still load.
    // MainBridge intentionally drops events during that interval. Keep the
    // destination until startup consumes it, or emit after loading finishes.
    window.webContents.once('did-finish-load', () => {
      if (navigating) mainBridge.emit(window, MAIN_CHANNELS.SYKA_NOTICE_NAVIGATE, navigating);
    });
  } else mainBridge.emit(window, MAIN_CHANNELS.SYKA_NOTICE_NAVIGATE, navigating);
}
export function takeNoticeNavigation(): NoticeNavigation | undefined { const result = navigating; navigating = undefined; return result; }

export function registerNotifications(getEditor: () => BrowserWindow | null): void {
  editor = getEditor;
  // Warm the hidden renderer before the first question, avoiding a cold import
  // of the shared composer and orb engine at delivery time.
  void app.whenReady().then(createOverlay);
  app.on('browser-window-focus', (_event, window) => { if (window !== overlay) raiseOverlay(); });
  mainBridge.handle(MAIN_CHANNELS.SYKA_NOTICE_NAVIGATE, () => takeNoticeNavigation());
  mainBridge.handle(MAIN_CHANNELS.SYKA_NOTIFICATIONS, async (request, event) => {
    if (!request || typeof request.action !== 'string') throw Error('Aviso inválido.');
    const native = isNoticeWindow(event.sender);
    if (request.action === 'layout') {
      if (!native || !Number.isFinite(request.width) || !Number.isFinite(request.height)) throw Error('Dimensiones inválidas.');
      layout = { width: Math.min(390, Math.max(120, request.width)), height: Math.min(900, Math.max(76, request.height)) };
      overlay?.setBounds(bounds());
      if (nativeRegions && overlay && request.regions) {
        const size = overlay.getBounds();
        const rects = notificationShape(request.regions, size.width, size.height);
        regionsReady = rects.length > 0;
        regionRectangles = rects.length;
        overlay.setShape(rects.length ? rects : [{ x: -2, y: -2, width: 1, height: 1 }]);
        overlay.setIgnoreMouseEvents(false);
        if (regionsReady && !overlay.isVisible()) showOverlay();
      }
    } else if (request.action === 'interactive') {
      if (!native || typeof request.value !== 'boolean') throw Error('Ventana inválida.');
      if (!nativeRegions) overlay?.setIgnoreMouseEvents(!request.value, { forward: true });
    } else if (request.action === 'appearance') {
      if (native || !/^#[\da-f]{6}$/i.test(request.accent)) throw Error('Acento inválido.');
      accent = request.accent; changed();
    } else if (request.action === 'report') {
      if (native) throw Error('Solo el editor puede informar operaciones.');
      const project = await getProject(request.projectDir);
      if (!project?.id || (request.projectId && project.id !== request.projectId) || !request.notice || !NOTICE_TITLES[request.notice.kind] || typeof request.notice.operationId !== 'string' || typeof request.notice.message !== 'string') throw Error('El aviso no corresponde al proyecto.');
      await reportNotice(request.projectDir, request.notice, request.chatId);
    } else if (request.action === 'resolve') {
      if (native) throw Error('Solo el editor puede resolver una operación.');
      const project = await getProject(request.projectDir);
      if (project?.id) { store.remove(`${project.id}:${request.kind}:${request.operationId}`); changed(); }
    } else if (request.action === 'remove-image' || request.action === 'remove-file') {
      if (submitting.has(request.id)) throw Error('Esperá a que termine de enviarse la respuesta.');
      await images.remove(request.id, request.action === 'remove-file' ? request.attachmentId : request.imageId);
    } else if (request.action !== 'list') {
      const notice = store.get(request.id);
      if (!notice) throw Error('Este aviso ya se resolvió.');
      if (request.action === 'attach-image' || request.action === 'attach-file') {
        if (!notice.request || !notice.chatId || !notice.projectDir || notice.request.questions.some(q => q.secret) || submitting.has(notice.id)) throw Error('Esta pregunta no admite adjuntos ahora.');
        const project = await getProject(notice.projectDir);
        if (!project?.id || project.id !== notice.projectId || !store.get(notice.id)) throw Error('La pregunta ya no pertenece a este proyecto.');
        const attachedImage = await images.add(notice.id, notice.projectDir, request.name, request.bytes);
        if (!store.visible().some(n => n.id === notice.id)) { await images.remove(notice.id, attachedImage.id); throw Error('La pregunta ya se resolvió u ocultó.'); }
        return { ...snapshot(), attachedFile: attachedImage, ...(request.action === 'attach-image' ? { attachedImage } : {}) };
      }
      else if (request.action === 'dismiss') { store.dismiss(request.id); if (!submitting.has(notice.id)) void images.discard(notice.id); changed(); }
      else if (request.action === 'open') navigate(notice);
      else if (request.action === 'artifact') {
        if (!notice.artifact) throw Error('Este aviso no tiene un archivo.');
        if (!(await stat(notice.artifact)).isFile()) throw Error('El archivo ya no está en esa ubicación.');
        shell.showItemInFolder(notice.artifact);
      } else if (request.action === 'answer') {
        if (!notice.request || !notice.chatId || submitting.has(notice.id)) throw Error('Esta pregunta no puede responderse ahora.');
        const values = request.answers;
        if (!values || notice.request.questions.some(q => q.secret || !Array.isArray(values[q.id]) || !values[q.id]?.length || values[q.id]!.some(s => typeof s !== 'string' || !s.trim() || s.length > 4000))) throw Error('Completá todas las respuestas.');
        if (Object.keys(values).some(id => !notice.request!.questions.some(q => q.id === id))) throw Error('La respuesta pertenece a otra pregunta.');
        submitting.add(notice.id);
        try { const paths = await images.paths(notice.id, request.attachments); await answerAgentNotice(notice.chatId, notice.request.id, values, paths); await serial; images.commit(notice.id, request.attachments || []); store.remove(notice.id); void images.discard(notice.id); changed(); }
        finally {
          // A failed continuation can reopen the same question. Wait for those
          // ordered host events before removing a card or throwing away its draft.
          await serial;
          submitting.delete(notice.id);
          if (resolvedWhileSubmitting.delete(notice.id)) { store.remove(notice.id); changed(); }
        }
      } else throw Error('Acción de aviso desconocida.');
    }
    return snapshot();
  });
}

export function stopNotifications() { overlay?.destroy(); overlay = null; }
