import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { UpdateController, newerVersion, validUpdateRepo } from './update-controller';

function setup(load = vi.fn(async () => ({ tag_name: 'v1.1.0', assets: [{ name: 'RELEASES' }, { name: 'SykaStudio-1.1.0-full.nupkg' }] }))) {
  const driver = Object.assign(new EventEmitter(), { setFeedURL: vi.fn(), checkForUpdates: vi.fn(), quitAndInstall: vi.fn() });
  const changed = vi.fn();
  const controller = new UpdateController({ version: '1.0.0', repo: 'SikJa/syka-studio', enabled: true, driver, loadRelease: load, changed });
  return { controller, driver, load, changed };
}
describe('Syka update lifecycle', () => {
  it('checks metadata without downloading, downloads once on request and only installs when ready', async () => {
    const { controller, driver } = setup();
    expect(() => controller.install()).toThrow();
    expect(() => controller.download()).toThrow();
    expect((await controller.check()).phase).toBe('available');
    expect(driver.checkForUpdates).not.toHaveBeenCalled();
    expect(driver.quitAndInstall).not.toHaveBeenCalled();
    controller.download(); controller.download();
    expect(driver.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(driver.setFeedURL).toHaveBeenCalledWith({ url: 'https://github.com/SikJa/syka-studio/releases/download/v1.1.0' });
    driver.emit('update-downloaded');
    expect(controller.snapshot().phase).toBe('ready');
    expect(driver.quitAndInstall).not.toHaveBeenCalled();
    controller.install();
    expect(driver.quitAndInstall).toHaveBeenCalledTimes(1);
    controller.stop();
  });
  it('deduplicates concurrent requests and retains downloaded state on another check', async () => {
    const { controller, load, driver } = setup();
    await Promise.all([controller.check(), controller.check(), controller.check()]);
    expect(load).toHaveBeenCalledTimes(1);
    controller.download(); driver.emit('update-downloaded');
    await controller.check();
    expect(controller.snapshot().phase).toBe('ready'); controller.stop();
  });
  it('does not act on prereleases, drafts, old versions or incomplete packages', async () => {
    for (const release of [null, { tag_name: 'v1.1.0', prerelease: true }, { tag_name: 'v1.1.0', draft: true }, { tag_name: 'v0.9.0' }]) {
      const { controller, driver } = setup(vi.fn(async () => release) as never);
      expect((await controller.check()).phase).toBe('idle');
      expect(driver.checkForUpdates).not.toHaveBeenCalled(); controller.stop();
    }
    const { controller } = setup(vi.fn(async () => ({ tag_name: 'v1.1.0', assets: [] })));
    expect((await controller.check()).phase).toBe('error'); controller.stop();
  });
  it('recovers from download failures without surfacing raw native errors', async () => {
    const { controller, driver } = setup();
    await controller.check(); controller.download(); driver.emit('error', Error('private machine path'));
    expect(controller.snapshot().phase).toBe('error');
    expect(controller.snapshot().message).not.toContain('private');
    controller.download(); expect(driver.checkForUpdates).toHaveBeenCalledTimes(2); controller.stop();
  });
  it('never checks an upstream repo or an uninstalled build', async () => {
    const { driver, load, changed } = setup();
    const disabled = new UpdateController({ version: '1.0.0', repo: 'diffusionstudio/editor', enabled: true, driver, loadRelease: load, changed });
    expect((await disabled.check()).phase).toBe('disabled'); expect(load).not.toHaveBeenCalled(); disabled.stop();
  });
  it('removes native listeners and ignores metadata resolving after shutdown', async () => {
    let complete!: (value: never) => void;
    const { controller, driver } = setup(vi.fn(() => new Promise(resolve => { complete = resolve; })) as never);
    const checking = controller.check(); controller.stop(); complete(null as never); await checking;
    expect(driver.listenerCount('update-downloaded')).toBe(0);
    expect(controller.snapshot().phase).toBe('checking');
  });
});
describe('update source validation', () => {
  it('compares numeric versions and rejects malformed/prerelease tags', () => {
    expect(newerVersion('v1.10.0', '1.9.9')).toBe(true);
    expect(newerVersion('v1.0.0', '1.0.0')).toBe(false);
    expect(newerVersion('v1.1.0-beta.1', '1.0.0')).toBe(false);
    expect(newerVersion('v1.1.0/../../other', '1.0.0')).toBe(false);
  });
  it('rejects credentials, URL injection, upstream and extra path segments', () => {
    expect(validUpdateRepo('SikJa/syka-studio')).toBe(true);
    for (const repo of ['https://github.com/SikJa/app', 'a/b/c', 'a/b?x=1', 'DiffusionStudio/editor', 'a:b/app']) expect(validUpdateRepo(repo)).toBe(false);
  });
});
