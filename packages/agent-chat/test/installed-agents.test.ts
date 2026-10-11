import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installedHermesHome, discoverInstalledAcp } from '../src/host/installed-agents';
import { acpEnvironment } from '../src/host/acp';
import { claudeEnvironment } from '../src/host/claude-cli';
const roots: string[] = [];
async function setup() { const root = await mkdtemp(join(tmpdir(), 'syka-installed-agents-')); roots.push(root); return root; }
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
describe('reuse installed accounts without credential copies', () => {
  it('follows the active Hermes profile instead of creating a signed-out profile', async () => {
    const root = await setup(), selected = join(root, 'profiles', 'editing');
    await mkdir(selected, { recursive: true });
    await writeFile(join(root, 'config.yaml'), 'model: {}');
    await writeFile(join(selected, 'config.yaml'), 'model: {}');
    await writeFile(join(root, 'active_profile'), 'editing');
    expect(await installedHermesHome({ HERMES_HOME: root }, root)).toBe(selected);
    expect(await installedHermesHome({ HERMES_HOME: selected }, root)).toBe(selected);
  });
  it('rejects traversal and a missing active profile rather than silently using another account', async () => {
    const root = await setup(); await writeFile(join(root, 'config.yaml'), 'model: {}');
    await writeFile(join(root, 'active_profile'), '../other');
    await expect(installedHermesHome({ HERMES_HOME: root }, root)).rejects.toThrow('inválido');
    await writeFile(join(root, 'active_profile'), 'missing');
    await expect(installedHermesHome({ HERMES_HOME: root }, root)).rejects.toThrow('activo');
  });
  it('reuses only selected account paths and keeps inherited secrets/MCP disabled', async () => {
    const root = await setup();
    const installed = { userHome: join(root, 'user'), appData: join(root, 'roaming'), localAppData: join(root, 'local'), hermesHome: join(root, 'hermes') };
    const value = acpEnvironment(join(root, 'runtime'), { OPENAI_API_KEY: 'private', ANTHROPIC_API_KEY: 'private' }, installed);
    expect(value.HOME).toBe(installed.userHome); expect(value.APPDATA).toBe(installed.appData); expect(value.HERMES_HOME).toBe(installed.hermesHome);
    expect(value.HERMES_ACP_SKIP_CONFIGURED_MCP).toBe('1'); expect(value.TEMP).toBe(join(root, 'runtime', 'tmp'));
    expect(value.OPENAI_API_KEY).toBeUndefined(); expect(value.ANTHROPIC_API_KEY).toBeUndefined(); expect(value.SETTINGS_DIR).toBeUndefined();
  });
  it('lets Claude OAuth open the normal browser while retaining its own account directory', async () => {
    const root = await setup(), profileDir = join(root, 'claude');
    const original = { HOME: join(root, 'user'), USERPROFILE: join(root, 'user'), APPDATA: join(root, 'roaming'), LOCALAPPDATA: join(root, 'local'), ANTHROPIC_API_KEY: 'private' };
    const value = claudeEnvironment({ id: 'claude', command: process.execPath, profileDir }, { env: original, extraDirs: [] });
    for (const key of ['HOME','USERPROFILE','APPDATA','LOCALAPPDATA'] as const) expect(value[key]).toBe(original[key]);
    expect(value.CLAUDE_CONFIG_DIR).toBe(profileDir); expect(value.ANTHROPIC_API_KEY).toBeUndefined();
  });
  it('discovers the prepared official Antigravity connector with the installed user directories', async () => {
    const root = await setup(), provider = join(root, 'providers', 'antigravity');
    await mkdir(provider, { recursive: true }); await writeFile(join(provider, process.platform === 'win32' ? 'agy_acp_server.exe' : 'agy_acp_server.par'), 'fixture');
    expect(await discoverInstalledAcp('antigravity', join(root, 'profiles'), { env: { USERPROFILE: root }, extraDirs: [] })).toBeTruthy();
  });
});
