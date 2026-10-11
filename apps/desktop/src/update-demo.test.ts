import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { createUpdateDemo } from './update-demo';
import { UpdateController } from './update-controller';

const appPath = resolve('fixture/apps/desktop');
function options() {
  return { packaged: false, defaultApp: true, appPath, version: '0.208.0', restart: vi.fn(),
    env: { SYKA_DEV_RUN: '1', SYKA_UPDATE_DEMO: '1', SYKA_RUNTIME_ROOT: resolve(appPath, '../../.runtime/update-demo') } as NodeJS.ProcessEnv };
}
afterEach(() => vi.useRealTimers());

describe('isolated update preview', () => {
  it('requires an unpackaged developer launch, explicit opt-in and the dedicated profile', () => {
    for (const change of [{ packaged: true }, { defaultApp: false }, { env: {} },
      { env: { ...options().env, SYKA_DEV_RUN: '0' } },
      { env: { ...options().env, SYKA_UPDATE_DEMO: '0' } },
      { env: { ...options().env, SYKA_RUNTIME_ROOT: resolve('real-user-profile') } }]) {
      expect(createUpdateDemo({ ...options(), ...change })).toBeNull();
    }
  });
  it('uses the real controller through check, manual download and explicit restart without network I/O', async () => {
    vi.useFakeTimers();
    const config = options(), demo = createUpdateDemo(config)!;
    const controller = new UpdateController({ enabled: true, repo: 'SikJa/syka-studio', version: demo.currentVersion,
      driver: demo.driver, changed: vi.fn(), loadRelease: demo.loadRelease });
    const checking = controller.check();
    expect(controller.snapshot().phase).toBe('checking');
    await vi.advanceTimersByTimeAsync(900);
    expect((await checking).phase).toBe('available');
    await vi.advanceTimersByTimeAsync(6000);
    expect(controller.snapshot().phase).toBe('available');
    controller.download(); controller.download();
    await vi.advanceTimersByTimeAsync(4999);
    expect(controller.snapshot().phase).toBe('downloading');
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.snapshot().phase).toBe('ready');
    expect(config.restart).not.toHaveBeenCalled();
    controller.install();
    expect(config.restart).toHaveBeenCalledTimes(1);
    expect(config.env.SYKA_UPDATE_DEMO_APPLIED).toBe('0.208.0:0.209.0');
    controller.stop(); demo.stop();
  });
  it('recognizes only its version-specific completion marker and can repeat the simulation', async () => {
    vi.useFakeTimers();
    const config = options(); config.env.SYKA_UPDATE_DEMO_APPLIED = '0.208.0:0.209.0';
    const demo = createUpdateDemo(config)!;
    expect(demo.applied).toBe(true); expect(demo.currentVersion).toBe('0.209.0');
    const controller = new UpdateController({ enabled: true, repo: 'SikJa/syka-studio', version: demo.currentVersion,
      driver: demo.driver, changed: vi.fn(), loadRelease: demo.loadRelease });
    const checking = controller.check(); await vi.advanceTimersByTimeAsync(900);
    expect((await checking).phase).toBe('idle');
    demo.reset();
    expect(config.env.SYKA_UPDATE_DEMO_APPLIED).toBeUndefined(); expect(config.restart).not.toHaveBeenCalled();
    controller.stop(); demo.stop();
    config.env.SYKA_UPDATE_DEMO_APPLIED = 'old-marker';
    expect(createUpdateDemo(config)!.applied).toBe(false);
  });
  it('cancels pending downloads when the test window closes', async () => {
    vi.useFakeTimers();
    const demo = createUpdateDemo(options())!, downloaded = vi.fn();
    demo.driver.on('update-downloaded', downloaded); demo.driver.checkForUpdates(); demo.stop();
    await vi.advanceTimersByTimeAsync(6000); expect(downloaded).not.toHaveBeenCalled();
  });
});
