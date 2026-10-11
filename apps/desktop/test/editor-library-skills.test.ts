import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  mkdir,
  stat,
} from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const copyState=vi.hoisted(()=>({ fail:false }));
vi.mock('node:fs/promises',async importOriginal=>{
  const actual=await importOriginal<typeof import('node:fs/promises')>();
  return {...actual,cp:async (...args:Parameters<typeof actual.cp>)=>{
    if(copyState.fail)throw Object.assign(Error('disk disconnected'),{code:'EIO'});
    return actual.cp(...args);
  }};
});
import { tmpdir } from 'node:os';
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => fileURLToPath(new URL('../', import.meta.url)),
    getPath: () => {
      throw Error('The test must use its isolated runtime');
    },
  },
}));
import { registerSykaAgentSettings } from '../src/syka-agent-settings';
let folder: string,
  request: (r: any) => Promise<any>,
  previous: string | undefined;
beforeEach(async () => {
  copyState.fail=false;
  folder = await mkdtemp(join(tmpdir(), 'syka-library-test-'));
  previous = process.env.SYKA_RUNTIME_ROOT;
  process.env.SYKA_RUNTIME_ROOT = folder;
  registerSykaAgentSettings({
    handle: (_channel: unknown, handler: any) => {
      request = handler;
    },
  } as any);
});
afterEach(async () => {
  if (previous === undefined) delete process.env.SYKA_RUNTIME_ROOT;
  else process.env.SYKA_RUNTIME_ROOT = previous;
  const target = resolve(folder);
  if (
    !target.startsWith(resolve(tmpdir()) + sep) ||
    !target.includes('syka-library-test-')
  )
    throw Error('Unexpected test cleanup target');
  await rm(target, { recursive: true, force: true });
});
describe('skill library desktop bridge', () => {
  it('creates, reads and saves the actual SKILL.md with revision checks and backup', async () => {
    await request({
      action: 'create-skill',
      name: 'test-style',
      content: 'Editar el texto.',
    });
    const created = await request({ action: 'read-skill', name: 'test-style' });
    expect(created.content).toContain('name: test-style');
    const changed = created.content + '\nVerificar el resultado.';
    await request({
      action: 'save-skill',
      name: 'test-style',
      content: changed,
      revision: created.revision,
    });
    const latest = await request({ action: 'read-skill', name: 'test-style' });
    expect(latest.content).toBe(changed);
    expect(latest.revision).not.toBe(created.revision);
    await expect(
      request({
        action: 'save-skill',
        name: 'test-style',
        content: 'Stale edit',
        revision: created.revision,
      }),
    ).rejects.toThrow(/cambió/);
    const backup = await readdir(join(folder, 'skill-history'));
    expect(backup).toHaveLength(1);
    expect(
      await readFile(join(folder, 'skill-history', backup[0]), 'utf8'),
    ).toBe(created.content);
    const catalog = await request({ action: 'get' });
    expect(catalog.skills.filter((s: any)=>!s.bundled).map((s: any) => s.name)).toEqual(['test-style']);
    expect(catalog.skills.some((s: any)=>s.bundled && s.name==='syka-editing-recipe')).toBe(true);
  });
  it('imports companion files and refuses to overwrite a saved workflow', async () => {
    const source = join(folder, 'imported-flow');
    await mkdir(join(source, 'references'), { recursive: true });
    await writeFile(
      join(source, 'SKILL.md'),
      '---\nname: imported-flow\ndescription: Test\n---\nUse reference.',
    );
    await writeFile(join(source, 'references', 'style.md'), '48px');
    await request({ action: 'import-skill', source });
    expect(
      await readFile(
        join(
          folder,
          'codex-runtime',
          'profile',
          'skills',
          'imported-flow',
          'references',
          'style.md',
        ),
        'utf8',
      ),
    ).toBe('48px');
    await expect(request({ action: 'import-skill', source })).rejects.toThrow();
    await expect(
      request({
        action: 'create-skill',
        name: 'imported-flow',
        content: 'Replacement',
      }),
    ).rejects.toThrow();
  });
  it('removes only its incomplete import and permits retry after a disk error',async()=>{
    const source=join(folder,'retry-flow'); await mkdir(source);
    await writeFile(join(source,'SKILL.md'),'---\nname: retry-flow\n---\nEdit.');
    await writeFile(join(source,'reference.txt'),'reference');
    copyState.fail=true;
    await expect(request({action:'import-skill',source})).rejects.toThrow('disk disconnected');
    const target=join(folder,'codex-runtime','profile','skills','retry-flow');
    await expect(stat(target)).rejects.toMatchObject({code:'ENOENT'});
    expect(await readFile(join(source,'reference.txt'),'utf8')).toBe('reference');
    copyState.fail=false; await request({action:'import-skill',source});
    expect(await readFile(join(target,'reference.txt'),'utf8')).toBe('reference');
  });
  it('keeps recipe metadata even when the displayed description is truncated',async()=>{
    await request({action:'create-skill',name:'youtube-style',content:'---\nname: youtube-style\ndescription: '+ 'x'.repeat(600)+'\nmetadata:\n  format: youtube\n---\nUsar el estilo acordado.'});
    const catalog=await request({action:'get'});
    expect(catalog.skills.find((skill:any)=>skill.name==='youtube-style')).toMatchObject({format:'youtube'});
  });
});
