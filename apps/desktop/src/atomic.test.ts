import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({rename: vi.fn(), unlink: vi.fn(), writeFile: vi.fn()}));
const pause = vi.hoisted(() => vi.fn());
vi.mock('node:fs/promises', () => fs);
vi.mock('node:timers/promises', () => ({setTimeout: pause}));
import { replaceFileAtomic, writeFileAtomic } from './atomic';

describe('atomic replacement under transient locks', () => {
  beforeEach(() => {vi.resetAllMocks();fs.unlink.mockResolvedValue(undefined);fs.writeFile.mockResolvedValue(undefined);pause.mockResolvedValue(undefined);});
  it('retries a temporary lock without deleting either complete file', async () => {
    fs.rename.mockRejectedValueOnce(Object.assign(new Error('locked'), {code:'EPERM'})).mockResolvedValueOnce(undefined);
    await replaceFileAtomic('complete.tmp', 'previous.mp4');
    expect(fs.rename.mock.calls).toEqual([['complete.tmp','previous.mp4'],['complete.tmp','previous.mp4']]);
    expect(pause).toHaveBeenCalledWith(50);
    expect(fs.unlink).not.toHaveBeenCalled();
  });
  it('bounds retries and cleans only its temp file when a lock persists', async () => {
    const error = Object.assign(new Error('locked'), {code:'EBUSY'});
    fs.rename.mockRejectedValue(error);
    await expect(writeFileAtomic('previous.tsx', 'complete source')).rejects.toBe(error);
    expect(fs.rename).toHaveBeenCalledTimes(5);
    expect(pause.mock.calls).toEqual([[50],[100],[200],[400]]);
    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(fs.unlink.mock.calls[0][0]).toContain('.dstmp-previous.tsx.');
  });
  it('does not retry unrelated filesystem errors', async () => {
    const error = Object.assign(new Error('missing'), {code:'ENOENT'});
    fs.rename.mockRejectedValue(error);
    await expect(replaceFileAtomic('missing.tmp','previous.mp4')).rejects.toBe(error);
    expect(fs.rename).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});
