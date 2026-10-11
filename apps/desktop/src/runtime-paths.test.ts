import { describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import { runtimeDirectory } from './runtime-paths';
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
