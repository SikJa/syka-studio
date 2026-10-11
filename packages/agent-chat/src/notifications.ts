import type { ChatEvent, ChatSummary, PendingRequest } from './protocol';

export type NoticeKind = 'question' | 'complete' | 'export' | 'review' | 'blocked' | 'auth' | 'transcription' | 'download' | 'analysis';
export type NoticeReport = {
  kind: Exclude<NoticeKind, 'question'>;
  operationId: string;
  message: string;
  artifact?: string;
  provider?: "groq" | "agents";
};
export type AgentNoticeEvent = {
  chat: ChatSummary;
  cwd: string;
  event: ChatEvent | { type: 'project.notice'; notice: NoticeReport };
};
export type StudioNotice = {
  id: string;
  kind: NoticeKind;
  title: string;
  message: string;
  projectId?: string;
  projectDir?: string;
  projectName: string;
  chatId?: string;
  request?: PendingRequest;
  artifact?: string;
  provider?: "groq" | "agents";
  createdAt: number;
};
export type NoticeSnapshot = { notices: StudioNotice[]; accent: string; sound: boolean;
  attachedFile?: NoticeAttachment;
  attachedImage?: NoticeImage;
  desktop?: { visible: boolean; alwaysOnTop: boolean; backgroundThrottling: boolean; nativeRegions: boolean; regionRectangles: number };
};
export const NOTICE_IMAGE_MAX_COUNT = 4;
export const NOTICE_IMAGE_MAX_BYTES = 25 * 1024 * 1024;
export const NOTICE_IMAGE_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const NOTICE_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
export const NOTICE_ATTACHMENT_MAX_COUNT = 4;
export const NOTICE_ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024;
export const NOTICE_ATTACHMENT_MAX_TOTAL_BYTES = 150 * 1024 * 1024;
export const NOTICE_TEXT_MAX_BYTES = 5 * 1024 * 1024;
export const NOTICE_ATTACHMENT_ACCEPT = NOTICE_IMAGE_ACCEPT + ',video/mp4,video/webm,video/quicktime,video/x-matroska,text/plain,.mp4,.mov,.webm,.mkv,.txt';
export type NoticeAttachment = { id: string; name: string; mimeType: string; size: number; previewUrl?: string };
export type NoticeImage = NoticeAttachment;
export function noticeAttachmentLimit(name: string, mimeType = ''): number {
  return /\.txt$/i.test(name) || mimeType === 'text/plain' ? NOTICE_TEXT_MAX_BYTES
    : /\.(mp4|mov|webm|mkv)$/i.test(name) || mimeType.startsWith('video/') ? NOTICE_ATTACHMENT_MAX_BYTES : NOTICE_IMAGE_MAX_BYTES;
}
export type NoticeRegion = { x: number; y: number; width: number; height: number; radius: number };
export type NoticeNavigation = { projectId?: string; projectDir?: string; chatId?: string; settings?: 'agents' | 'groq'; };
export type NoticeCommand =
  | { action: 'list' }
  | { action: 'dismiss'; id: string }
  | { action: 'open' | 'artifact'; id: string }
  | { action: 'answer'; id: string; answers: Record<string, string[]>; attachments?: string[] }
  | { action: 'attach-image'; id: string; name: string; bytes: Uint8Array }
  | { action: 'remove-image'; id: string; imageId: string }
  | { action: 'attach-file'; id: string; name: string; bytes: Uint8Array }
  | { action: 'remove-file'; id: string; attachmentId: string }
  | { action: 'layout'; width: number; height: number; regions?: NoticeRegion[] }
  | { action: 'interactive'; value: boolean }
  | { action: 'appearance'; accent: string }
  | { action: 'resolve'; projectDir: string; kind: Exclude<NoticeKind, 'question'>; operationId: string }
  | { action: 'report'; projectDir: string; projectId?: string; chatId?: string; notice: NoticeReport };

export const NOTICE_TITLES: Record<NoticeKind, string> = {
  question: 'Syka tiene una pregunta', complete: 'Tu proyecto está listo',
  export: 'Exportación lista', review: 'Nueva versión para revisar',
  blocked: 'Syka necesita tu ayuda', auth: 'Volvé a iniciar sesión',
  transcription: 'Transcripción terminada', download: 'Descarga terminada', analysis: 'Análisis terminado',
};

/** Only operational events cross into the desktop overlay. No reasoning or tokens. */
export function isNoticeEvent(event: AgentNoticeEvent['event']): boolean {
  return event.type === 'project.notice' || event.type === 'request.opened' || event.type === 'request.resolved'
    || (event.type === 'turn.completed' && event.status === 'failed');
}

export function isAuthenticationError(message: string): boolean {
  return /\b401\b|unauthorized|not authenticated|authentication.*(?:expired|required|failed)|session.*expired|sesión.*(?:vencid|expirad)|(?:sign|log)[ -]?in.*(?:required|again)|please.*(?:login|sign in)|needs your.*login|not (?:logged|signed) in|token.*(?:expired|invalid)|rechazó la clave|clave.*(?:inválida|vencida)/i.test(message);
}

export function cleanNoticeText(value: string, limit = 600): string {
  return String(value).replace(/\b(?:sk-[\w-]+|[\w-]*token[=:]\S+|Bearer\s+\S+)/gi, '[credencial]')
    .replace(/https?:\/\/\S+/g, '[enlace]').slice(0, limit);
}

/** Deduplication survives dismissal; resolved questions disappear across every window. */
export class NoticeStore {
  private records = new Map<string, StudioNotice>();
  private dismissed = new Set<string>();
  upsert(notice: StudioNotice): boolean {
    const previous = this.records.get(notice.id);
    // A reopened request after a rejected dispatch must become retryable again.
    if (notice.kind === 'question' && !previous) this.dismissed.delete(notice.id);
    this.records.set(notice.id, notice);
    while (this.records.size > 100) {
      const candidate = [...this.records.values()].find(n => n.kind !== 'question') ?? this.records.values().next().value;
      if (!candidate) break;
      this.records.delete(candidate.id); this.dismissed.delete(candidate.id);
    }
    return !previous;
  }
  get(id: string): StudioNotice | undefined { return this.records.get(id); }
  dismiss(id: string): void { this.dismissed.add(id); }
  remove(id: string): void { this.records.delete(id); this.dismissed.delete(id); }
  visible(): StudioNotice[] { return [...this.records.values()].filter(n => !this.dismissed.has(n.id)); }
}
