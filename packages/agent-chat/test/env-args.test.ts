import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runOnce, type HostEnv } from '../src/host/env';

describe('native executable arguments', () => {
  it('preserves script paths with spaces and literal arguments without shell quoting', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka native path spaces '));
    const script = join(root, 'provider with spaces.mjs');
    const literal = '$literal & echo NO "quote" (á)';
    const host: HostEnv = { env: process.env as Record<string, string>, extraDirs: [] };
    try {
      await writeFile(script, 'console.log(JSON.stringify(process.argv.slice(2)));');
      const result = await runOnce(process.execPath, [script, literal], host);
      expect(JSON.parse(result!)).toEqual([literal]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('keeps a native signed-out response even when the command exits unsuccessfully', async () => {
    const host: HostEnv = { env: process.env as Record<string, string>, extraDirs: [] };
    const result = await runOnce(process.execPath, ['-e', 'console.log(JSON.stringify({loggedIn:false})); process.exitCode=1;'], host);
    expect(JSON.parse(result!)).toEqual({ loggedIn: false });
  });
});
