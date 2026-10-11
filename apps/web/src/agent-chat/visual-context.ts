import { Computed, FrameRate, Key, Loop, Name, Source, getActiveEntity, getSelection } from '@diffusionstudio/runtime';
import type { World } from 'koota';
import type { ResourceKind } from '@desktop/main-channels';
import { activeChatId, draftKey, draft, setDraftAttachments, setSidebarTab } from './store';
import { chatFloating } from './chat-presentation';
import { mergeAttachments } from './attachments';
import { referenceAttachment } from './reference-attachments';

export function linkedReferenceInstruction(kind: ResourceKind) {
  return kind === 'motions' ? 'Usá este video como referencia visual. Si incluye componentPath y componentFiles, leé y copiá esos archivos al proyecto, adaptá sus props y recursos reales: esa es la implementación editable. Si no, revisá si la carpeta tiene un componente .tsx y README. Si sólo hay una muestra, analizala localmente sin transcribirla ni subirla y proponé cómo recrearla. No reemplaces las capas editables por el MP4 de muestra.'
    : kind === 'logos' ? 'Quiero usar este logo original en mi video. Revisá su variante y proponé dónde integrarlo.'
    : 'Quiero usar este sonido en el video. Proponé dónde encaja y con qué volumen.';
}

/** Snapshot the user's target now, so a later selection/time change cannot retarget the request. */
export function selectionContext(world: World) {
  const scene = getActiveEntity(world);
  return {
    composition: scene?.get(Source)?.value ?? null,
    timeSeconds: scene ? (scene.get(Computed)?.localTime ?? 0) / (world.get(FrameRate)?.value || 30) : null,
    elements: getSelection(world).slice(0, 20).map(entity => ({
      source: entity.get(Source)?.value ?? null,
      key: entity.get(Key)?.value ?? null,
      name: entity.get(Name)?.value ?? null,
      loopSource: entity.get(Loop)?.value ?? null,
    })),
  };
}

export function referenceInChat(projectId: string, instruction: string, context: unknown, previewUrl?: string, destinationKey?:string) {
  const key = destinationKey ?? draftKey(projectId, activeChatId(projectId));
  setDraftAttachments(key, mergeAttachments(draft(key).attachments, [referenceAttachment(instruction, context, previewUrl)]));
  focusChatComposer();
}

export function focusChatComposer() {
  setSidebarTab(chatFloating() ? 'assets' : 'chat');
  requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('textarea[data-tour-target="chat-message"]')?.focus());
}
