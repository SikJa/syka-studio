import type { StoragePolicy } from './types';

/** Oldest last-use first. Never trim against an incomplete size measurement. */
export function cacheEvictions<T extends { bytes: number; time: number }>(items: T[], policy: StoragePolicy, now: number, complete: boolean, force = false): Set<T> {
  const selected = new Set<T>();
  let retained = items.reduce((total, item) => total + item.bytes, 0);
  for (const item of items) {
    if (force || policy.cacheDays > 0 && now - item.time >= policy.cacheDays * 86_400_000) { selected.add(item); retained -= item.bytes; }
  }
  if (complete && policy.cacheLimitMB > 0 && !force) {
    for (const item of [...items].sort((a, b) => a.time - b.time)) {
      if (retained <= policy.cacheLimitMB * 1024 ** 2) break;
      if (!selected.has(item) && now - item.time >= 3_600_000) { selected.add(item); retained -= item.bytes; }
    }
  }
  return selected;
}
