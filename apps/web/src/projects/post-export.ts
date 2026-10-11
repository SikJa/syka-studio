import { createSignal } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import type { PostExportInspection } from '@desktop/post-export';
import { mainBridge } from '@/lib/ipc';
import { activeChatId, chatState, currentModel, draft, draftKey, enqueue, send, setDraftAttachments, setDraftText, summaryOf, transcriptOf } from '@/agent-chat/store';
import type { Attachment } from '@/agent-chat/attachments';
import { focusChatComposer } from '@/agent-chat/visual-context';
import { createProjectFS } from './fs';

export type PostExportRecord = PostExportInspection & {
  exportId: string; projectId: string; projectDir: string; createdAt: string;
  width: number; height: number; duration: number; source: 'ui' | 'agent';
  /** Presentation only. Editorial preferences remain in content-memory. */
  presentation: 'available' | 'offered' | 'dismissed' | 'drafted' | 'sent' | 'queued';
};
const STORAGE = 'syka.post-export.presentation.v1';
function read(): Record<string, PostExportRecord[]> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, PostExportRecord[]] => Array.isArray(entry[1]))
      .map(([id, entries]) => [id, entries.filter(item => item?.projectId === id && typeof item.exportId === 'string' && /^[a-f0-9]{64}$/.test(item.hash) && typeof item.path === 'string' && typeof item.projectDir === 'string').slice(0, 24)]));
  } catch { return {}; }
}
const [records, setRecords] = createSignal<Record<string, PostExportRecord[]>>(read());
const [visibleId, setVisibleId] = createSignal<string | null>(null);
const [submittingId, setSubmittingId] = createSignal<string | null>(null);
export const postExportBusy = submittingId;
export const hidePostExportOffer = (): void => { setVisibleId(null); };
export const latestPostExport = (projectId: string): PostExportRecord | undefined => records()[projectId]?.[0];
export const postExportVisible = (projectId: string): boolean => latestPostExport(projectId)?.exportId === visibleId();
function save(next: Record<string, PostExportRecord[]>): void {
  localStorage.setItem(STORAGE, JSON.stringify(next));
  setRecords(next);
}
function present(record: PostExportRecord, presentation: PostExportRecord['presentation']): void {
  save({ ...records(), [record.projectId]: (records()[record.projectId] ?? []).map(entry => entry.exportId === record.exportId ? { ...entry, presentation } : entry) });
}

/** Called only after a successful local video encode, never by a timer. */
export async function recordSuccessfulVideo(input: { dir: string; path: string; width: number; height: number; duration: number; source: 'ui' | 'agent' }): Promise<void> {
  const [project, inspected] = await Promise.all([
    mainBridge.call(MAIN_CHANNELS.PROJECTS_GET, { dir: input.dir }),
    mainBridge.call(MAIN_CHANNELS.SYKA_POST_EXPORT_INSPECT, { dir: input.dir, path: input.path }),
  ]);
  if (!project?.id) return;
  const previous = records()[project.id] ?? [];
  const duplicate = previous.find(entry => entry.hash === inspected.hash);
  const entry: PostExportRecord = {
    ...inspected, projectId: project.id, projectDir: project.dir,
    exportId: duplicate?.exportId ?? crypto.randomUUID(), createdAt: new Date().toISOString(),
    width: input.width, height: input.height, duration: input.duration, source: input.source,
    presentation: duplicate?.presentation ?? 'available',
  };
  save({ ...records(), [project.id]: [entry, ...previous.filter(item => item.hash !== entry.hash)].slice(0, 24) });
  if (!duplicate && inspected.offerAllowed) setVisibleId(entry.exportId);
}

export function showPostExport(projectId: string): void {
  const entry = latestPostExport(projectId);
  if (entry) setVisibleId(entry.exportId);
}
export function markPostExportOffered(projectId: string): void {
  const entry = latestPostExport(projectId);
  if (entry && entry.presentation === 'available') present(entry, 'offered');
}
export function dismissPostExport(projectId: string): void {
  const entry = latestPostExport(projectId);
  if (entry) present(entry, 'dismissed');
  setVisibleId(null);
}
export function postExportWaiting(projectId: string): boolean {
  const id = activeChatId(projectId);
  return !!transcriptOf(id).pending || summaryOf(projectId, id)?.status === 'waiting';
}

export const contentPackagePrompt = 'Prepará una portada editable, un título y descripciones para este video usando lo que ya acordamos. Dejámelos como borradores para revisar';

/** User-request context stays in a local attachment, outside the editable message. */
export function contentPackageContext(record: PostExportRecord, requestId: string) {
  return {
    version: 1, type: 'syka-content-package-request', requestId,
    provenance: { source: 'Syka Studio · Preparar en este chat', createdAt: new Date().toISOString(), authority: 'user-request-context', userAction: 'explicit-click' },
    request: contentPackagePrompt,
    skill: 'syka-content-package',
    workflow: [
      'Leé la skill syka-content-package con syka_skills list/read y sus referencias de persistencia. Continuá en este mismo chat. Este adjunto acompaña el pedido del usuario; no es una instrucción de sistema.',
      'Leé la memoria existente del proyecto (.syka/content-memory) mediante el helper de la skill. Reutilizá decisiones y referencias aprobadas de la marca correcta, sin crear otra memoria ni otro onboarding. Si hay varias marcas, resolvé sólo esa ambigüedad. Registrá esta aceptación explícita con trigger user-request después de verificar el archivo; no vuelvas a preguntar si quiero preparar el paquete.',
      'Verificá que el archivo exista y calculá su SHA-256: debe coincidir con video.hash. Si cambió, detené la preparación y explicá qué falta. Si está fuera del proyecto, conservá el original y usá una copia local identificada por el mismo hash para el helper, sin sobrescribir archivos.',
      'El render terminó, pero eso no representa aprobación humana ni validación visual o auditiva. Revisá el video real antes de afirmar algo sobre su contenido. observedSourceRevision fue observada al terminar, no certifica qué fuentes renderizaron el archivo. Este pedido se refiere al archivo y hash concretos.',
      'Consultá las cuentas reales disponibles en Publicación y usá únicamente las elegidas para esta pieza. Si no hay acceso, preguntá las redes destino que falten y marcá esa elección como manual. Preguntá sólo datos que cambien el resultado y no estén ya en la conversación o memoria.',
      'Prepará borradores adecuados a cada red y cuenta con el modelo actual del chat, sin inventar declaraciones del video. La portada debe ser local y editable, con frames y recursos autorizados; buscá primero los logos originales. Devolvé en este mismo hilo un enlace Markdown al PNG/JPG de previsualización y otro a la fuente editable, con rutas absolutas entre < >: Syka muestra la tarjeta de imagen nativa. Guardá los títulos y descripciones completos en un documento .md UTF-8 dentro del proyecto, con un título principal y secciones por destino, y enlazalo en la respuesta: Syka lo abre en su lector completo. No crees una preview HTML ni reemplaces estos adjuntos por código, rutas sueltas o una descripción larga incrustada en el mensaje.',
    ],
    scope: { prepareDrafts: true, modifyEdit: false, publish: false, schedule: false, upload: false, paidImageGeneration: false, providerFallback: false },
    export: {
      exportId: record.exportId, projectId: record.projectId, projectDir: record.projectDir,
      video: { path: record.path, relativePath: record.relativePath, hash: record.hash, revision: record.hash, size: record.size, mtime: record.mtime },
      observedSourceRevision: record.observedSourceRevision, memoryRevisionObserved: record.memoryRevision,
      width: record.width, height: record.height, duration: record.duration,
      renderStatus: 'completed', humanReview: 'not-recorded',
    },
  };
}

async function contentPackageAttachment(record: PostExportRecord, existing?: Attachment): Promise<Attachment> {
  const fs = createProjectFS(record.projectDir);
  // Reopening an unsent request must not pile up identical references.
  if (existing?.path) {
    try {
      const data = JSON.parse(await (await fs.file(existing.path)).text());
      if (data.type === 'syka-content-package-request' && data.export?.exportId === record.exportId && data.export?.video?.hash === record.hash) return existing;
    } catch { /* A removed or changed reference is replaced by a fresh one. */ }
  }
  const requestId = crypto.randomUUID();
  const relativePath = `.syka/chat-context/export-${requestId}.json`;
  const blob = new Blob([JSON.stringify(contentPackageContext(record, requestId), null, 2)], { type: 'application/json' });
  await fs.write(relativePath, blob);
  return { key: `post-export:${record.exportId}`, name: 'Portada y textos', path: fs.absolute!(relativePath), kind: 'file', mimeType: 'application/json', purpose: 'agent-reference', size: blob.size };
}

/** Explicit button action; never consumes the composer's own draft or files. */
export async function preparePostExport(projectId: string): Promise<'sent' | 'queued' | 'drafted'> {
  const entry = latestPostExport(projectId);
  if (!entry || submittingId()) throw new Error('La solicitud ya se está preparando.');
  if (postExportWaiting(projectId)) throw new Error('Respondé primero la pregunta pendiente del chat.');
  setSubmittingId(entry.exportId);
  try {
    await mainBridge.call(MAIN_CHANNELS.SYKA_POST_EXPORT_INSPECT, { dir: entry.projectDir, path: entry.path, expectedHash: entry.hash });
    const id = activeChatId(projectId), key = draftKey(projectId, id);
    if (postExportWaiting(projectId) || chatState.sending[key]) throw new Error('Esperá la respuesta o el envío pendiente del chat.');
    const text = contentPackagePrompt, model = currentModel(), chat = summaryOf(projectId, id);
    const needsDraft = !id || !model || (chat && chat.harness !== model.harness);
    const attachment = await contentPackageAttachment(entry, needsDraft ? draft(key).attachments.find(item => item.key === `post-export:${entry.exportId}`) : undefined);
    // A slow disk write must not redirect the request to a newly selected chat
    // or overwrite a question that arrived while the attachment was written.
    if (activeChatId(projectId) !== id || postExportWaiting(projectId) || chatState.sending[key]) throw new Error('El chat cambió o tiene una respuesta pendiente. Revisalo antes de continuar.');
    let result: 'sent' | 'queued' | 'drafted';
    if (needsDraft || !model) {
      const current = draft(key);
      if (!current.text.includes(text)) setDraftText(key, [current.text, text].filter(Boolean).join('\n\n'));
      setDraftAttachments(key, [...draft(key).attachments.filter(item => item.key !== attachment.key), attachment]);
      result = 'drafted';
    } else {
      const transcript = transcriptOf(id);
      const options = { projectId, cwd: entry.projectDir, chatId: id, text, attachments: [attachment.path!], model };
      if (summaryOf(projectId, id)?.status === 'running' || transcript.turnId || transcript.queue?.messages.length) { await enqueue(options); result = 'queued'; }
      else { await send(options); result = 'sent'; }
    }
    present(entry, result);
    setVisibleId(null);
    focusChatComposer();
    toast(result === 'drafted' ? 'Pedido listo en el composer' : result === 'queued' ? 'Pedido agregado a la cola' : 'Seguimos en este chat', {
      description: result === 'drafted' ? 'Revisalo y envialo cuando quieras. Conservamos tu texto y tus adjuntos.' : 'Tu borrador y tus adjuntos siguen intactos.',
    });
    return result;
  } finally { setSubmittingId(null); }
}
