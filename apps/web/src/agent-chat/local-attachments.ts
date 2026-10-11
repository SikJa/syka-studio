import { mainBridge } from '@/lib/ipc';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { attachmentFromPath, droppedAttachments, type Attachment } from './attachments';

export async function prepareDroppedChatFiles(event: DragEvent, projectDir: string): Promise<Attachment[]> {
  const files = Array.from(event.dataTransfer?.files ?? []);
  const folders = droppedAttachments(event).filter(entry => entry.kind === 'folder');
  return [...await prepareChatFiles(files.filter(file => !folders.some(folder => folder.name === file.name)), projectDir), ...folders];
}

export async function prepareChatFiles(files: File[], projectDir: string): Promise<Attachment[]> {
  const entries: Attachment[] = [];
  for (const file of files) {
    let path = window.desktop?.getPathForFile(file);
    if (!path) {
      if (!window.desktop) throw new Error('Los adjuntos requieren la aplicación de escritorio');
      const name = file.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'imagen.png';
      path = `${projectDir}/03 Assets reutilizables/Adjuntos/chat-${crypto.randomUUID()}-${name}`;
      const { id } = await mainBridge.call(MAIN_CHANNELS.FILE_WRITE_OPEN, { path, exclusive: true });
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        for (let offset = 0; offset < bytes.length; offset += 1024 * 1024) {
          await mainBridge.call(MAIN_CHANNELS.FILE_WRITE_CHUNK, { id, data: bytes.slice(offset, offset + 1024 * 1024), position: offset });
        }
        await mainBridge.call(MAIN_CHANNELS.FILE_WRITE_CLOSE, { id });
      } catch (error) {
        await mainBridge.call(MAIN_CHANNELS.FILE_WRITE_ABORT, { id }).catch(() => {});
        throw error;
      }
    }
    entries.push({ ...attachmentFromPath(path), name: file.name, mimeType: file.type, size: file.size,
      ...(file.type.startsWith('image/') ? { previewUrl: URL.createObjectURL(file) } : {}) });
  }
  return entries;
}
