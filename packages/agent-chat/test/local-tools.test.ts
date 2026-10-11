import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { addToolDirectories, detectLocalTools, resolveLocalTool } from '../src/host/local-tools';
let root: string;
const suffix = process.platform === 'win32' ? '.exe' : '';
async function tool(dir: string, name: string) { await mkdir(dir, { recursive: true }); const path = join(dir, name + suffix); await writeFile(path, 'fixture'); await chmod(path, 0o755); return path; }
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'syka-tools-')); });
afterEach(async () => {
  if (!root.startsWith(join(tmpdir(), 'syka-tools-'))) throw Error('Unexpected test path');
  await rm(root, { recursive: true, force: true });
});
describe('portable local tools', () => {
  it('works on a clean profile and finds optional managed binaries without PATH', async () => {
    const empty = detectLocalTools({ env: {}, roots: [root] });
    expect(empty.every(tool => tool.path === null)).toBe(true);
    const binary = await tool(join(root, 'ffmpeg', 'bin'), 'ffmpeg');
    expect(resolveLocalTool('ffmpeg', { env: {}, roots: [root] })).toMatchObject({ path: binary, source: 'managed' });
    const companion = await tool(join(root, 'ffmpeg', 'bin'), 'ffprobe');
    expect(resolveLocalTool('ffprobe', { env: {}, roots: [root] })).toMatchObject({ path: companion, source: 'managed' });
  });
  it('honors explicit paths and reports a broken override rather than silently choosing another executable', async () => {
    await tool(root, 'ffmpeg');
    const path = await tool(join(root, 'explicit'), 'ffmpeg');
    expect(resolveLocalTool('ffmpeg', { env: { SYKA_FFMPEG_PATH: path }, roots: [root] }).path).toBe(path);
    expect(resolveLocalTool('ffmpeg', { env: { SYKA_FFMPEG_PATH: join(root, 'missing.exe') }, roots: [root] })).toMatchObject({ path: null, source: 'missing' });
  });
  it('finds system executables with mixed-case Windows PATH and keeps managed directories available to shell children', async () => {
    const bin = await tool(join(root, 'system'), 'node');
    const found = resolveLocalTool('node', { env: { Path: join(root, 'system') } });
    expect(found).toMatchObject({ path: bin, source: 'system' });
    const next = addToolDirectories({ Path: 'existing', TEMP: 'temp' }, [found]);
    expect(next.PATH.split(delimiter)).toEqual([resolve(root, 'system'), 'existing']);
    expect(next.Path).toBeUndefined(); expect(next.TEMP).toBe('temp');
  });
});
