import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { tempPathFor, replaceFileAtomic } from './atomic';

import { PERMISSION_IDS, type StudioPermission, type StudioPermissions } from './syka-permission-types';
const defaults = (): StudioPermissions => ({ clipboard: false, fonts: false, microphone: true, notifications: false });

/** Existing microphone behavior is retained; new grants require an explicit user action. */
export class PermissionStore {
  private state = defaults();
  private loaded = false;
  private tail: Promise<unknown> = Promise.resolve();
  readonly file: string;
  constructor(file: string) { this.file = file; }
  snapshot(): StudioPermissions { return { ...this.state }; }
  async load(): Promise<StudioPermissions> {
    if (this.loaded) return this.snapshot();
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      if (data.version !== 1 || !data.permissions || PERMISSION_IDS.some(id => typeof data.permissions[id] !== 'boolean')) throw Error('Formato de permisos inválido.');
      this.state = Object.fromEntries(PERMISSION_IDS.map(id => [id, data.permissions[id]])) as StudioPermissions;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw Error('No se pudieron leer los permisos. Se conserva el archivo original.', { cause: error }); }
    this.loaded = true;
    return this.snapshot();
  }
  set(permission: StudioPermission, allowed: boolean): Promise<StudioPermissions> {
    const operation = this.tail.catch(() => undefined).then(async () => {
      if (!PERMISSION_IDS.includes(permission) || typeof allowed !== 'boolean') throw Error('Permiso inválido.');
      await this.load();
      const next = { ...this.state, [permission]: allowed };
      await mkdir(dirname(this.file), { recursive: true });
      const temporary = tempPathFor(this.file);
      try {
        await writeFile(temporary, JSON.stringify({ version: 1, permissions: next }, null, 2), { flag: 'wx', mode: 0o600 });
        await replaceFileAtomic(temporary, this.file);
        this.state = next;
      } finally { await unlink(temporary).catch(() => {}); }
      return this.snapshot();
    });
    this.tail = operation;
    return operation;
  }
}

export function permissionAllowed(permission: string, permissions: StudioPermissions, mediaTypes: readonly string[] = []): boolean {
  if (['fileSystem', 'fullscreen', 'clipboard-sanitized-write'].includes(permission)) return true;
  if (permission === 'clipboard-read') return permissions.clipboard;
  if (['local-fonts', 'font-access'].includes(permission)) return permissions.fonts;
  if (permission === 'notifications') return permissions.notifications;
  if (permission === 'media') return permissions.microphone && mediaTypes.length > 0 && mediaTypes.every(type => type === 'audio');
  return false;
}

/** Permission grants never follow an editor window into a remote origin or child frame. */
export function trustedPermissionOrigin(requestingUrl: string, editorUrl: string): boolean {
  try {
    const request = new URL(requestingUrl), editor = new URL(editorUrl);
    if (editor.protocol === 'file:') return request.protocol === 'file:' && (requestingUrl === 'file://' || request.pathname === editor.pathname);
    return ['http:', 'https:'].includes(editor.protocol) && request.origin === editor.origin;
  } catch { return false; }
}
