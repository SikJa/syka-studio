/** Share in-flight work without owning the lifetime of a project's assets. */
export class WeakAsyncCache<Key extends object, Value> {
  private entries = new WeakMap<Key, Promise<Value>>();

  get(key: Key, load: () => Promise<Value>): Promise<Value> {
    const entries = this.entries;
    const cached = entries.get(key);
    if (cached) return cached;
    const promise = Promise.resolve().then(load);
    entries.set(key, promise);
    void promise.catch(() => {
      // A failure from a previous generation must not evict a newer request.
      if (entries.get(key) === promise) entries.delete(key);
    });
    return promise;
  }

  clear(): void { this.entries = new WeakMap(); }
}
