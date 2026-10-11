import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectPreviewQueue } from './preview-queue';
import type { PreviewJob } from './preview-queue';

const job = (id: string, sequence = 0): PreviewJob => ({ project: { id, dir: `${process.cwd()}/${id}` }, tool: 'capture', args: { sequence } });
function deferred<T = void>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
afterEach(() => vi.useRealTimers());

describe('single internal preview queue', () => {
  it('handles 50 projects with one executor and round-robin fairness against a noisy project', async () => {
    const first = deferred();
    const order: string[] = [];
    let active = 0, peak = 0;
    const queue = new ProjectPreviewQueue(async task => {
      peak = Math.max(peak, ++active);
      const name = `${task.project.id}:${(task.args as { sequence: number }).sequence}`;
      order.push(name);
      if (order.length === 1) await first.promise;
      active--;
      return name;
    }, () => {});
    const signal = new AbortController().signal;
    const calls = [queue.call(job('noisy'), signal)];
    for (let n = 1; n <= 10; n++) calls.push(queue.call(job('noisy', n), signal));
    for (let n = 0; n < 50; n++) calls.push(queue.call(job(`project-${n}`), signal));
    expect(queue.status()).toMatchObject({ waiting: 60, projectsWaiting: 51 });
    first.resolve();
    const results = await Promise.all(calls);
    expect(new Set(results).size).toBe(61);
    expect(peak).toBe(1);
    expect(order.indexOf('project-49:0')).toBeLessThan(order.indexOf('noisy:2'));
    expect(queue.status()).toMatchObject({ active: null, waiting: 0, projectsWaiting: 0 });
    queue.stop();
  });
  it('removes canceled waiting jobs without executing or resetting the active project', async () => {
    const first = deferred(), reset = vi.fn();
    const run = vi.fn(async () => { await first.promise; return 'done'; });
    const queue = new ProjectPreviewQueue(run, reset);
    const active = queue.call(job('a'), new AbortController().signal);
    const canceled = new AbortController();
    const waiting = queue.call(job('b'), canceled.signal);
    const rejection = expect(waiting).rejects.toMatchObject({ code: 'canceled' });
    canceled.abort(); await rejection;
    first.resolve(); await active;
    expect(run).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
    expect(queue.status().waiting).toBe(0);
    queue.stop();
  });
  it('destroys a stuck job before the next project starts and ignores its late result', async () => {
    const stuck = deferred<unknown>(), resetting = deferred(), begun: string[] = [];
    const canceled = new AbortController();
    const queue = new ProjectPreviewQueue(async task => { begun.push(task.project.id); return task.project.id === 'a' ? stuck.promise : 'b-result'; }, () => resetting.promise);
    const a = queue.call(job('a'), canceled.signal);
    const rejected = expect(a).rejects.toMatchObject({ code: 'canceled' });
    const b = queue.call(job('b'), new AbortController().signal);
    canceled.abort();
    await Promise.resolve(); await Promise.resolve();
    expect(begun).toEqual(['a']);
    resetting.resolve();
    await rejected;
    expect(await b).toBe('b-result');
    stuck.resolve('stale-a-result');
    expect(begun).toEqual(['a', 'b']);
    queue.stop();
  });
  it('recovers after execution timeout, failure and expired wait without blocking later projects', async () => {
    vi.useFakeTimers();
    const reset = vi.fn(), stuck = deferred();
    const queue = new ProjectPreviewQueue(async task => {
      if (task.project.id === 'a') return stuck.promise;
      if (task.project.id === 'broken') throw Error('decoder broke');
      return task.project.id;
    }, reset, { executionTimeoutMs: 100, waitTimeoutMs: 20 });
    const a = queue.call(job('a'), new AbortController().signal);
    const aRejected = expect(a).rejects.toMatchObject({ code: 'busy' });
    const b = queue.call(job('b'), new AbortController().signal);
    const bRejected = expect(b).rejects.toMatchObject({ code: 'busy' });
    await vi.advanceTimersByTimeAsync(20); await bRejected;
    await vi.advanceTimersByTimeAsync(80); await aRejected;
    await expect(queue.call(job('broken'), new AbortController().signal)).rejects.toThrow('decoder broke');
    expect(await queue.call(job('healthy'), new AbortController().signal)).toBe('healthy');
    expect(reset).toHaveBeenCalledTimes(2);
    queue.stop();
  });
  it('bounds waiting metadata per project and globally, and stop rejects all jobs', async () => {
    const queue = new ProjectPreviewQueue(() => new Promise(() => {}), () => {}, { maxPending: 2, maxPerProject: 1 });
    const a = queue.call(job('a'), new AbortController().signal);
    const b = queue.call(job('b'), new AbortController().signal);
    await expect(queue.call(job('b', 2), new AbortController().signal)).rejects.toMatchObject({ code: 'busy' });
    const c = queue.call(job('c'), new AbortController().signal);
    await expect(queue.call(job('d'), new AbortController().signal)).rejects.toMatchObject({ code: 'busy' });
    const rejected = [a, b, c].map(p => expect(p).rejects.toMatchObject({ code: 'canceled' }));
    queue.stop(); await Promise.all(rejected);
    await expect(queue.call(job('new'), new AbortController().signal)).rejects.toMatchObject({ code: 'canceled' });
    expect(queue.status()).toMatchObject({ active: null, waiting: 0, closed: true });
  });
  it('refuses to start another executor if destroying a failed one also fails', async () => {
    const stuck = deferred(), begun: string[] = [];
    const queue = new ProjectPreviewQueue(async task => {
      begun.push(task.project.id); await stuck.promise; throw Error('failed renderer');
    }, () => { throw Error('renderer could not be destroyed'); });
    const a = queue.call(job('a'), new AbortController().signal);
    const rejectedA = expect(a).rejects.toThrow('failed renderer');
    const b = queue.call(job('b'), new AbortController().signal);
    const rejectedB = expect(b).rejects.toMatchObject({ code: 'canceled' });
    stuck.resolve(); await Promise.all([rejectedA, rejectedB]);
    expect(begun).toEqual(['a']);
    expect(queue.status()).toMatchObject({ closed: true, waiting: 0, active: null });
  });
});
