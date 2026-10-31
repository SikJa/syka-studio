/** Bounded, shared requests: opening a library twice must not reread every SVG.
 * Failures are evicted so an explicit retry can recover. */
export function createPreviewCache<T>(load: (path: string) => Promise<T>, capacity = 96, concurrency = 4, weight: (value: T) => number = () => 1, budget = Infinity) {
  const cache = new Map<string, { result: Promise<T>; expires: number; weight: number }>();
  let retained = 0;
  const remove = (path: string) => { retained -= cache.get(path)?.weight ?? 0; cache.delete(path); };
  const waiting: Array<() => void> = [];
  let active = 0;
  const run = async (path: string) => {
    if (active >= concurrency) await new Promise<void>(resolve => waiting.push(resolve));
    else active++;
    try { return await load(path); }
    finally { const next = waiting.shift(); if (next) next(); else active--; }
  };
  return {
    get(path: string) {
      const old = cache.get(path);
      if (old && old.expires > Date.now()) return old.result;
      remove(path);
      const entry = { result: run(path), expires: Date.now() + 60_000, weight: 0 };
      cache.set(path, entry);
      while (cache.size > capacity) remove(cache.keys().next().value!);
      void entry.result.then(value => {
        if (cache.get(path) !== entry) return;
        entry.weight = weight(value); retained += entry.weight;
        while (retained > budget && cache.size) remove(cache.keys().next().value!);
      }).catch(() => { if (cache.get(path) === entry) remove(path); });
      return entry.result;
    },
    clear() { cache.clear(); retained = 0; },
  };
}
