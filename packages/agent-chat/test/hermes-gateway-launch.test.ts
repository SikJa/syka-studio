import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hermesAcpLaunch } from '../src/host/hermes-acp-bridge';

describe('Hermes managed gateway launch', () => {
  it('preserves the official bootstrap and safely quotes a relocated profile path', async () => {
    const root = await mkdtemp(join(tmpdir(), "syka user's perfil-"));
    try {
      const bootstrap = "import runpy; import hermes_bootstrap; runpy.run_module('acp_adapter.entry', run_name='__main__', alter_sys=True)";
      const args = ['-I', '-c', bootstrap];
      const launch = await hermesAcpLaunch(process.execPath, args, root, true);
      expect(launch?.command).toBe(process.execPath);
      expect(launch?.args.slice(0, 2)).toEqual(['-I', '-c']);
      expect(launch?.args[2]).toBe(`import runpy; import hermes_bootstrap; runpy.run_path(${JSON.stringify(join(root, 'syka-hermes-gateway-acp-v1.py'))}, run_name='__main__')`);
      expect(args[2]).toBe(bootstrap);
      expect(await readFile(join(root, 'syka-hermes-gateway-acp-v1.py'), 'utf8')).toContain('class SykaGatewayACPAgent');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('refuses an unknown managed launch instead of starting a different runtime', async () => {
    await expect(hermesAcpLaunch(process.execPath, ['-m', 'other.adapter'], tmpdir(), true)).rejects.toThrow('no compatible');
    expect(await hermesAcpLaunch(process.execPath, ['-m', 'other.adapter'], tmpdir())).toBeUndefined();
  });
});
