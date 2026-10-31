import { describe, it, expect } from 'vitest';
import { createPreviewCache } from './preview-cache';

describe('library preview request scheduling', () => {
  it('deduplicates a reopened card and bounds concurrent disk/IPC reads', async () => {
    let active = 0, peak = 0, calls = 0;
    const cache = createPreviewCache(async path => {
      calls++; active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 3));
      active--; return 'preview:' + path;
    }, 12, 2);
    const first = cache.get('logo');
    expect(cache.get('logo')).toBe(first);
    await Promise.all([first, ...Array.from({length:8}, (_, i) => cache.get(String(i)))]);
    expect(peak).toBe(2);
    expect(calls).toBe(9);
    expect(await cache.get('logo')).toBe('preview:logo');
    expect(calls).toBe(9);
    cache.clear(); await cache.get('logo'); expect(calls).toBe(10);
  });
  it('recovers after a corrupt file fails and evicts old catalog entries', async () => {
    let calls = 0;
    const cache = createPreviewCache(async path => {
      calls++;
      if (calls === 1) throw new Error('unreadable');
      return path;
    }, 2, 1);
    await expect(cache.get('a')).rejects.toThrow('unreadable');
    expect(await cache.get('a')).toBe('a');
    await cache.get('b'); await cache.get('c'); await cache.get('a');
    expect(calls).toBe(5);
  });
  it('does not retain large media above the memory budget', async () => {
    let calls = 0;
    const cache = createPreviewCache(async path => { calls++; return path.repeat(10); }, 96, 4, value => value.length, 12);
    await cache.get('a'); await cache.get('bb'); await cache.get('bb');
    expect(calls).toBe(3);
  });
});
