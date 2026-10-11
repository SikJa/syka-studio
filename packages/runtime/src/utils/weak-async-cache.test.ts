import { describe, expect, it, vi } from 'vitest';
import { WeakAsyncCache } from './weak-async-cache';

describe('project resource ownership', () => {
  it('shares concurrent requests for one asset without conflating another project with the same ID', async () => {
    const cache = new WeakAsyncCache<object, number>();
    const first = { id: 'shared-id' }, second = { id: 'shared-id' };
    const load = vi.fn(async () => 1);
    const pending = cache.get(first, load);
    expect(cache.get(first, load)).toBe(pending);
    expect(await cache.get(second, async () => 2)).toBe(2);
    expect(await pending).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries a failed file read instead of retaining the rejection', async () => {
    const cache = new WeakAsyncCache<object, number>(), asset = {};
    await expect(cache.get(asset, async () => { throw Error('disk unavailable'); })).rejects.toThrow('disk unavailable');
    expect(await cache.get(asset, async () => 3)).toBe(3);
  });

  it('keeps a new request when an older generation fails after a clear', async () => {
    const cache = new WeakAsyncCache<object, number>(), asset = {};
    let fail!: (error: Error) => void;
    const old = cache.get(asset, () => new Promise<number>((_, reject) => { fail = reject; }));
    await Promise.resolve();
    cache.clear();
    const next = cache.get(asset, async () => 4);
    fail(Error('old request'));
    await expect(old).rejects.toThrow('old request');
    expect(cache.get(asset, async () => 5)).toBe(next);
    expect(await next).toBe(4);
  });
});
