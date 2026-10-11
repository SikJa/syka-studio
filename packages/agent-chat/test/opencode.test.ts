import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findOpenCode, installedOpenCodeEnvironment } from '../src/host/opencode';
let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'syka-opencode-')); });
afterEach(async () => { if (!root.startsWith(join(tmpdir(), 'syka-opencode-'))) throw Error('Unexpected cleanup path'); await rm(root, { recursive: true, force: true }); });
describe('OpenCode installation and existing accounts', () => {
  it('detects the native npm executable behind a Windows shim without executing the shim', async () => {
    const prefix = join(root, 'npm'), binary = join(prefix, 'node_modules', 'opencode-ai', 'bin', process.platform === 'win32' ? 'opencode.exe' : 'opencode');
    await mkdir(join(prefix, 'node_modules', 'opencode-ai', 'bin'), { recursive: true });
    await writeFile(binary, 'fixture'); await writeFile(join(prefix, 'opencode.cmd'), 'must never run');
    expect(await findOpenCode({ env: { Path: prefix, USERPROFILE: root }, extraDirs: [] }, join(root, 'profiles'))).toMatchObject({ command: binary, args: ['acp'], accountMode: 'installed' });
  });
  it('does not replace a broken explicit installation with another executable', async () => {
    const name = process.platform === 'win32' ? 'opencode.exe' : 'opencode';
    await writeFile(join(root, name), 'fixture');
    expect(await findOpenCode({ env: { PATH: root, USERPROFILE: root, SYKA_OPENCODE_PATH: join(root, 'missing.exe') }, extraDirs: [] }, join(root, 'profiles'))).toBeUndefined();
  });
  it('uses the existing official account path while stripping inherited API keys and routing', () => {
    const value = installedOpenCodeEnvironment(join(root, 'syka'), { USERPROFILE: join(root, 'user'), XDG_DATA_HOME: join(root, 'selected-account'), OPENAI_API_KEY: 'must-not-copy', OPENCODE_API_KEY: 'must-not-copy', OPENCODE_CONFIG_CONTENT: '{"model":"other"}', OPENCODE_SERVER_PASSWORD: 'must-not-copy' });
    expect(value.HOME).toBe(join(root, 'user')); expect(value.XDG_DATA_HOME).toBe(join(root, 'selected-account'));
    expect(value.TEMP).toBe(join(root, 'syka', 'tmp')); expect(value.OPENCODE_CONFIG_DIR).toBe(join(root, 'syka', 'config', 'opencode'));
    for (const key of ['OPENAI_API_KEY', 'OPENCODE_API_KEY', 'OPENCODE_CONFIG_CONTENT', 'OPENCODE_SERVER_PASSWORD']) expect(value[key]).toBeUndefined();
  });
  it('can keep a separately selected Syka account separate from the personal login', () => {
    const value = installedOpenCodeEnvironment(root, { USERPROFILE: join(root, 'personal'), XDG_DATA_HOME: join(root, 'personal-data') }, 'syka');
    expect(value.HOME).toBe(root); expect(value.XDG_DATA_HOME).toBe(join(root, 'data'));
  });
});
