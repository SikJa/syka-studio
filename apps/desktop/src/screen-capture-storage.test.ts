import { afterEach, describe, expect, it, vi } from 'vitest';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { MAIN_CHANNELS } from './main-channels';
import type { mainBridge } from './main-manager';
import { StorageService } from './storage/service';

const engine = vi.hoisted(() => ({ commands: [] as string[], fail: false }));
vi.mock('electron', () => ({ app: { getAppPath: () => '.', getPath: () => process.env.SYKA_RUNTIME_ROOT!, whenReady: () => Promise.resolve() }, protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() } }));
vi.mock('./app-mode', () => ({ isPackagedBuild: () => false }));
vi.mock('./syka-dependencies', () => ({ localToolPath: () => 'fixture-ffmpeg' }));
vi.mock('./screen-region-selector', () => ({ selectScreenRegion: vi.fn() }));
vi.mock('node:child_process', async () => {
  const { EventEmitter } = await import('node:events'), { PassThrough } = await import('node:stream');
  const { writeFile } = await import('node:fs/promises'), { join } = await import('node:path'), { promisify } = await import('node:util');
  return {
    execFile: Object.assign(vi.fn(), { [promisify.custom]: async () => ({ stdout: JSON.stringify([{ id: 'screen', name: 'Fixture', kind: 'screen', thumbnail: '', bounds: { x: 0, y: 0, width: 1920, height: 1080 } }]), stderr: '' }) }),
    spawn: vi.fn(() => {
      const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
      let dir = '';
      child.stdin.on('data', async data => {
        const command = String(data).trim(); engine.commands.push(command);
        if (command.startsWith('{')) { dir = JSON.parse(command).dir; await writeFile(join(dir, 'partial.mp4'), 'incomplete recording'); }
        else if (command === 'stop' && !engine.fail) await writeFile(join(dir, 'recording.mp4'), 'finalized recording fixture');
        const phase = command.startsWith('{') ? 'recording' : engine.fail ? 'error' : 'complete';
        child.stdout.write(JSON.stringify({ phase, seconds: 2, path: join(dir, 'recording.mp4'), microphone: '', error: phase === 'error' ? 'fixture failure' : '' }) + '\n');
      });
      return child;
    }),
  };
});
import { registerScreenCapture, type ScreenCaptureRequest, type ScreenCaptureSources } from './screen-capture';

const roots: string[] = [];
async function fixture() {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'syka-recording-storage-'))); roots.push(base);
  const runtime = join(base, 'runtime'), project = join(base, 'project'); await mkdir(runtime); await mkdir(project);
  vi.stubEnv('SYKA_RUNTIME_ROOT', runtime);
  let handler: (request: ScreenCaptureRequest, event: unknown) => Promise<ScreenCaptureSources>;
  registerScreenCapture({ handle: (channel: string, callback: typeof handler) => { expect(channel).toBe(MAIN_CHANNELS.SYKA_SCREEN_CAPTURE); handler = callback; } } as unknown as typeof mainBridge);
  const event = { sender: { id: 1, once: vi.fn() } };
  const call = (request: ScreenCaptureRequest) => handler(request, event);
  const result = await call({ action: 'start', sourceId: 'screen', audio: 'none', projectDir: project });
  const path = join(project, '03 Assets reutilizables', 'Adjuntos', 'screen-recordings', result.recording!.id);
  return { runtime, project, path, call, storage: new StorageService({ runtime, profile: runtime }) };
}
afterEach(async () => {
  vi.unstubAllEnvs(); engine.commands = []; engine.fail = false;
  const temp = await realpath(tmpdir());
  for (const base of roots.splice(0)) {
    if (!resolve(base).startsWith(temp + sep + 'syka-recording-storage-') || (await lstat(base)).isSymbolicLink()) throw Error('Unsafe fixture cleanup');
    await rm(base, { recursive: true, force: true });
  }
});
describe.skipIf(process.platform !== 'win32')('screen recording storage lifecycle', () => {
  it('finalizes an explicit discard and lets the user recover it from storage', async () => {
    const f = await fixture(); expect((await f.call({ action: 'cancel' })).status?.phase).toBe('cancelled');
    expect(engine.commands.at(-1)).toBe('stop'); await expect(lstat(f.path)).rejects.toMatchObject({ code: 'ENOENT' });
    const trash = (await f.storage.overview()).trash; expect(trash).toHaveLength(1);
    await f.storage.restore(trash[0].id); expect(await readFile(join(f.path, 'recording.mp4'), 'utf8')).toBe('finalized recording fixture');
  });
  it('preserves an attached recording when its completed preview is closed', async () => {
    const f = await fixture(), recording = await f.call({ action: 'stop' }); expect(recording.recording?.path).toBeTruthy();
    await f.call({ action: 'cancel' }); expect(await readFile(join(f.path, 'recording.mp4'), 'utf8')).toBe('finalized recording fixture');
    expect((await f.storage.overview()).trash).toEqual([]);
  });
  it('keeps recovery files when finalization fails', async () => {
    const f = await fixture(); engine.fail = true; expect((await f.call({ action: 'cancel' })).status?.phase).toBe('error');
    expect(await readFile(join(f.path, 'partial.mp4'), 'utf8')).toBe('incomplete recording'); expect((await f.storage.overview()).trash).toEqual([]);
  });
});
