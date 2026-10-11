import type { ResourceEntry, ResourceKind } from '@desktop/main-channels';

export const LINKED_RESOURCE_DRAG_TYPE = 'application/x-syka-linked-resource';
export type LinkedResource = {
  kind: ResourceKind;
  path: string;
  title: string;
  audioType?: ResourceEntry['audioType'];
  brand?: string;
  componentPath?: string;
  componentFiles?: string[];
  usage?: string;
  previewUrl?: string;
};
let active: { token: string; resource: LinkedResource } | undefined;

/** Dragging or cancelling must not import files. Only this session's token resolves. */
export function beginLinkedResourceDrag(transfer: DataTransfer, kind: ResourceKind, entry: ResourceEntry, previewUrl?: string): void {
  const token = crypto.randomUUID();
  const resource = { kind, path: entry.path, title: entry.title ?? entry.name, audioType: entry.audioType, brand:entry.brand, componentPath:entry.componentPath, componentFiles:entry.componentFiles, usage:entry.usage, previewUrl };
  active = { token, resource };
  transfer.effectAllowed = 'copy';
  transfer.setData(LINKED_RESOURCE_DRAG_TYPE, token);
  transfer.setData('text/plain', resource.title);
}

/** Read before awaiting: browsers protect the transfer again after the drop callback. */
export function readLinkedResourceDrop(transfer: DataTransfer | null): LinkedResource | undefined {
  if (!active || transfer?.getData(LINKED_RESOURCE_DRAG_TYPE) !== active.token) return;
  const resource = { ...active.resource };
  active = undefined; // One gesture cannot enqueue the same drop twice.
  return resource;
}

export function endLinkedResourceDrag(): void { active = undefined; }

export function linkedResourceVolume(resource: LinkedResource): number | undefined {
  if (resource.kind !== 'sounds') return;
  return resource.audioType === 'music' || resource.audioType === 'stem' ? -16 : -12;
}
