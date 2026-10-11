import { isPackagedBuild } from './app-mode';
import { app } from 'electron';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getSourceHistoryStatus } from '../../../packages/agent-chat/src/host/edit-journal';
import { MAIN_CHANNELS } from './main-channels';
import type { mainBridge } from './main-manager';

export type PostExportInspection = {
  path: string; relativePath: string | null; hash: string; size: number; mtime: number;
  observedSourceRevision: string | null; memoryRevision: number | null; offerAllowed: boolean;
};
type Memory = { revision: number; brands: Record<string, { offerMode?: string; occasions?: Record<string, { choice?: string }> }> };

/** Reads the existing skill backend; it never creates a second preference store. */
export function registerPostExport(bridge: typeof mainBridge): void {
  bridge.handle(MAIN_CHANNELS.SYKA_POST_EXPORT_INSPECT, async ({ dir, path, expectedHash }) => {
    if (!isAbsolute(dir) || !isAbsolute(path) || !['.mp4', '.mov', '.webm'].includes(extname(path).toLowerCase())) {
      throw new Error('Se necesita un video exportado local y un proyecto válido.');
    }
    const root = await realpath(dir), file = await realpath(path);
    const before = await stat(file);
    if (!before.isFile() || before.size <= 0) throw new Error('El video exportado no existe o está vacío.');
    const digest = createHash('sha256');
    for await (const chunk of createReadStream(file)) digest.update(chunk);
    const hash = digest.digest('hex'), after = await stat(file);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('El video cambió mientras se verificaba. Volvé a intentarlo.');
    if (expectedHash && hash !== expectedHash) throw new Error('Este archivo cambió desde la exportación. Volvé a exportar o elegí la versión correcta antes de preparar la portada.');
    const rel = relative(root, file);
    const relativePath = !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..\\') && !rel.startsWith('../') ? rel.replace(/\\/g, '/') : null;
    let memoryRevision: number | null = null;
    let offerAllowed = false;
    try {
      const docs = isPackagedBuild() ? join(process.resourcesPath, 'docs') : join(app.getAppPath(), '..', '..', 'docs');
      const helper = await import(pathToFileURL(join(docs, 'skills', 'syka-content-package', 'scripts', 'content-memory.mjs')).href) as { contentMemory(project: string, request: { action: 'read' }): Promise<Memory> };
      const memory = await helper.contentMemory(root, { action: 'read' });
      memoryRevision = memory.revision;
      // Without an unambiguous brand selection, suppress an unsolicited
      // repeat for any recorded refusal. An explicit inspector action stays
      // available; the chat resolves the brand before reusing preferences.
      offerAllowed = !Object.values(memory.brands).some(brand => brand.offerMode === 'manual' ||
        ['offered', 'declined', 'accepted', 'completed'].includes(brand.occasions?.[`export:${hash}`]?.choice ?? ''));
    } catch (error) {
      // A damaged/unavailable memory cannot be treated as a fresh consent.
      console.warn('[post-export] Could not read content memory; automatic offer suppressed:', error instanceof Error ? error.message : String(error));
    }
    const observedSourceRevision = await getSourceHistoryStatus(root).then(status => status.revision, () => null);
    return { path: file, relativePath, hash, size: after.size, mtime: after.mtimeMs, observedSourceRevision, memoryRevision, offerAllowed };
  });
}
