import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { applyLaunchRoots, runtimeDirectory } from './runtime-paths';

describe('launch roots', () => {
  it('reuses the first explicit profile when launched without the launcher, and never lets a later copy rewrite it', () => {
    const root = mkdtempSync(join(tmpdir(), 'syka-roots-'));
    try {
      const pointer = join(root, 'appdata', 'launch-roots.json'), data = join(root, 'Datos'), media = join(root, 'Motions'), qa = join(root, 'qa');
      for (const dir of [data, media, qa]) mkdirSync(dir);
      applyLaunchRoots(pointer, { SYKA_RUNTIME_ROOT: data, SYKA_MEDIA_ROOT: media });
      applyLaunchRoots(pointer, { SYKA_RUNTIME_ROOT: qa });
      expect(JSON.parse(readFileSync(pointer, 'utf8'))).toEqual({ runtimeRoot: data, mediaRoot: media });
      const direct: NodeJS.ProcessEnv = {};
      applyLaunchRoots(pointer, direct);
      expect(direct).toEqual({ SYKA_RUNTIME_ROOT: data, SYKA_MEDIA_ROOT: media });
      rmSync(data, { recursive: true });
      const missing: NodeJS.ProcessEnv = {};
      applyLaunchRoots(pointer, missing);
      expect(missing).toEqual({});
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
describe('runtime storage', () => {
  it('stores packaged data in the user profile even when the installation is read-only', () => {
    const userData = resolve('fixtures/user/Syka Clips');
    expect(runtimeDirectory({ packaged: true, appPath: resolve('fixtures/read-only-install'), userData })).toBe(userData);
  });
  it('keeps development checkout storage and explicit absolute overrides stable', () => {
    const appPath = resolve('fixtures/workspace/diffusion-studio/apps/desktop');
    expect(runtimeDirectory({ packaged: false, appPath, userData: '' })).toBe(join(resolve(appPath, '../../..'), '.runtime', 'diffusion'));
    expect(runtimeDirectory({ packaged: true, appPath, userData: '', override: resolve('portable-runtime') })).toBe(resolve('portable-runtime'));
    expect(() => runtimeDirectory({ packaged: true, appPath, userData: '', override: 'relative-runtime' })).toThrow('absoluta');
  });
});
