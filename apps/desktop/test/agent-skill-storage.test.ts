import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { WorkspaceTools } from '../../../packages/agent-chat/src/host/workspace-tools';

let base: string, profile: string, tools: WorkspaceTools;
beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'syka-agent-skill-test-'));
  profile = join(base, 'profile', 'skills');
  await mkdir(profile, { recursive: true });
  tools = new WorkspaceTools(base, undefined, profile);
});
afterEach(async () => {
  const rel = relative(tmpdir(), base);
  if (
    isAbsolute(rel) ||
    !rel.startsWith('syka-agent-skill-test-') ||
    rel.includes('..')
  )
    throw Error('Unexpected cleanup target');
  await rm(base, { recursive: true, force: true });
});
describe('skills saved by the editor chat', () => {
  it('creates a personal skill, lists it, edits by revision and keeps the original', async () => {
    const created = (await tools.call('syka_skills', {
      action: 'create',
      name: 'mis-subtitulos',
      content: 'Usar tiempos reales.',
    })) as any;
    const list = (await tools.call('syka_skills', { action: 'list' })) as any;
    expect(list.skills.some((s: any) => s.name === 'mis-subtitulos')).toBe(
      true,
    );
    const read = (await tools.call('syka_skills', {
      action: 'read',
      path: join(profile, 'mis-subtitulos'),
    })) as any;
    expect(read.revision).toBe(created.revision);
    const content = read.content + '\nVerificar legibilidad.';
    await tools.call('syka_skills', {
      action: 'save',
      name: 'mis-subtitulos',
      content,
      revision: read.revision,
    });
    expect(await readFile(created.path, 'utf8')).toBe(content);
    const backups = await readdir(join(base, 'profile', 'skill-history'));
    expect(
      await readFile(
        join(base, 'profile', 'skill-history', backups[0]),
        'utf8',
      ),
    ).toBe(read.content);
    await expect(
      tools.call('syka_skills', {
        action: 'save',
        name: 'mis-subtitulos',
        content: 'stale',
        revision: read.revision,
      }),
    ).rejects.toThrow('cambió');
    await expect(
      tools.call('syka_skills', {
        action: 'create',
        name: 'mis-subtitulos',
        content: 'replace',
      }),
    ).rejects.toThrow();
    expect(await readFile(created.path, 'utf8')).toBe(content);
  });
  it('requires the configured personal profile and rejects invalid destinations', async () => {
    await expect(
      new WorkspaceTools(base).call('syka_skills', {
        action: 'create',
        name: 'a',
        content: 'b',
      }),
    ).rejects.toThrow('profile unavailable');
    await expect(
      tools.call('syka_skills', {
        action: 'create',
        name: '../outside',
        content: 'b',
      }),
    ).rejects.toThrow('Nombre');
  });
});
