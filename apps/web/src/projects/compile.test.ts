import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileSettledSource } from './compile';

describe('compiling a project while external files settle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns a valid fresh bundle immediately', async () => {
    const compile = vi.fn().mockResolvedValue({ ok: true, code: 'fresh' });
    await expect(compileSettledSource(compile)).resolves.toEqual({ ok: true, code: 'fresh' });
    expect(compile).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recovers when a dependent module is completed after the initial import error', async () => {
    const compile = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: 'No matching export T_HAND' })
      .mockResolvedValueOnce({ ok: false, error: 'No matching export WALLPAPER' })
      .mockResolvedValueOnce({ ok: true, code: 'completed modules' });
    const result = compileSettledSource(compile);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual({ ok: true, code: 'completed modules' });
    expect(compile).toHaveBeenCalledTimes(3);
  });

  it('stops retrying a persistent source error and returns the latest diagnostic', async () => {
    const compile = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: 'first failure' })
      .mockResolvedValue({ ok: false, error: 'persistent failure' });
    const result = compileSettledSource(compile);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual({ ok: false, error: 'persistent failure' });
    expect(compile).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates bridge failures instead of repeating a disconnected request', async () => {
    const compile = vi.fn().mockRejectedValue(Error('Main bridge unavailable'));
    await expect(compileSettledSource(compile)).rejects.toThrow('Main bridge unavailable');
    expect(compile).toHaveBeenCalledTimes(1);
  });
});
