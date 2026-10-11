import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ packaged: true }));
vi.mock('electron', () => ({ app: { get isPackaged() { return state.packaged; } } }));
import { isPackagedBuild } from './app-mode';
afterEach(() => vi.unstubAllEnvs());
describe('product resource mode', () => {
  it('keeps installed builds on their bundled resources', () => { state.packaged = true; vi.stubEnv('SYKA_DEV_RUN', undefined); expect(isPackagedBuild()).toBe(true); });
  it('runs the branded developer executable against source resources', () => { state.packaged = true; vi.stubEnv('SYKA_DEV_RUN', '1'); expect(isPackagedBuild()).toBe(false); });
  it('keeps ordinary Electron/Forge development working', () => { state.packaged = false; vi.stubEnv('SYKA_DEV_RUN', undefined); expect(isPackagedBuild()).toBe(false); });
});
