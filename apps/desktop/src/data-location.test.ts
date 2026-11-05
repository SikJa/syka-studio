import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { chooseDataFolder, shouldAskForData } from './data-location';

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
const temp = async () => { const dir = await mkdtemp(join(tmpdir(), 'syka-data-')); dirs.push(dir); return dir; };

describe('first-run data folder', () => {
  it('asks only on an installed first run with no known folder', async () => {
    const dir = await temp();
    const pointer = join(dir, 'launch-roots.json');
    expect(shouldAskForData({ packaged: true, firstRun: true, pointer })).toBe(true);
    expect(shouldAskForData({ packaged: true, firstRun: false, pointer })).toBe(false);
    expect(shouldAskForData({ packaged: false, firstRun: true, pointer })).toBe(false);
    expect(shouldAskForData({ packaged: true, firstRun: true, pointer, envRoot: 'E:\\Datos' })).toBe(false);
    await writeFile(pointer, '{}');
    expect(shouldAskForData({ packaged: true, firstRun: true, pointer })).toBe(false);
  });

  it('remembers the recommended folder without relaunching', async () => {
    const dir = await temp();
    const pointer = join(dir, 'roaming', 'launch-roots.json');
    const chosen = await chooseDataFolder({ pointer, defaultFolder: join(dir, 'default'), dialog: { ask: async () => 'default', pick: async () => null } });
    expect(chosen).toBeNull();
    expect(JSON.parse(readFileSync(pointer, 'utf8'))).toEqual({ runtimeRoot: join(dir, 'default') });
  });

  it('uses a «Syka Studio» folder inside the one picked, and relaunches into it', async () => {
    const dir = await temp();
    const pointer = join(dir, 'launch-roots.json');
    const chosen = await chooseDataFolder({ pointer, defaultFolder: join(dir, 'default'), dialog: { ask: async () => 'choose', pick: async () => join(dir, 'E') } });
    expect(chosen).toBe(join(dir, 'E', 'Syka Studio'));
    expect(existsSync(chosen!)).toBe(true);
    expect(JSON.parse(readFileSync(pointer, 'utf8')).runtimeRoot).toBe(chosen);
  });
});
