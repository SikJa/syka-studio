import { afterEach, describe, expect, it } from 'vitest';
import type { ResourceEntry } from '@desktop/main-channels';
import { beginLinkedResourceDrag, endLinkedResourceDrag, LINKED_RESOURCE_DRAG_TYPE, linkedResourceVolume, readLinkedResourceDrop } from './linked-resource-drag';

function transfer() {
  const data = new Map<string, string>();
  return { effectAllowed: 'none', setData: (key: string, value: string) => data.set(key, value),
    getData: (key: string) => data.get(key) ?? '' } as unknown as DataTransfer;
}
const entry = { path: 'F:/public/sounds/whoosh.wav', name: 'whoosh.wav', title: 'Barrido corto 3', audioType: 'sfx' } as ResourceEntry;
afterEach(endLinkedResourceDrag);

describe('linked library drag gestures', () => {
  it('keeps editable motion source companions with the reference when dragged to chat', () => {
    const data = transfer();
    beginLinkedResourceDrag(data,'motions',{...entry,kind:'motions',path:'C:/motions/OrbitFeature.mp4',
      componentPath:'C:/motions/OrbitFeature.tsx',componentFiles:['C:/motions/OrbitFeature.tsx','C:/motions/motion-time.ts'],usage:'Copy the source, not the preview.'});
    expect(readLinkedResourceDrop(data)).toMatchObject({kind:'motions',componentPath:'C:/motions/OrbitFeature.tsx',
      componentFiles:['C:/motions/OrbitFeature.tsx','C:/motions/motion-time.ts'],usage:'Copy the source, not the preview.'});
  });
  it('transfers an opaque handle, resolves metadata once and never exposes a filesystem path', () => {
    const data = transfer();
    beginLinkedResourceDrag(data, 'sounds', entry);
    expect(data.effectAllowed).toBe('copy');
    expect(data.getData(LINKED_RESOURCE_DRAG_TYPE)).not.toContain(entry.path);
    expect(data.getData('text/plain')).toBe(entry.title);
    const resource = readLinkedResourceDrop(data);
    expect(resource).toMatchObject({ path: entry.path, title: entry.title, audioType: 'sfx', kind: 'sounds' });
    expect(readLinkedResourceDrop(data)).toBeUndefined();
    expect(linkedResourceVolume(resource!)).toBe(-12);
  });
  it('rejects forged, cancelled and stale transfers without consuming a valid gesture', () => {
    const first = transfer(), forged = transfer();
    beginLinkedResourceDrag(first, 'sounds', entry);
    forged.setData(LINKED_RESOURCE_DRAG_TYPE, entry.path);
    expect(readLinkedResourceDrop(forged)).toBeUndefined();
    const second = transfer(); beginLinkedResourceDrag(second, 'sounds', entry);
    expect(readLinkedResourceDrop(first)).toBeUndefined();
    endLinkedResourceDrag();
    expect(readLinkedResourceDrop(second)).toBeUndefined();
    expect(readLinkedResourceDrop(null)).toBeUndefined();
  });
  it('preserves safer music and stem gains while leaving visual assets at their native gain', () => {
    for (const audioType of ['music', 'stem'] as const)
      expect(linkedResourceVolume({kind:'sounds',path:'base.wav',title:'Base',audioType})).toBe(-16);
    expect(linkedResourceVolume({kind:'logos',path:'logo.svg',title:'Logo'})).toBeUndefined();
  });
});
