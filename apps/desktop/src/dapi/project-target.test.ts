import { describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { projectTarget, projectKey, canonicalPreviewJob } from './project-target';
import { ProjectPreviewQueue } from './preview-queue';
import { mcpEndpoint } from '../../../cli/src/mcp-endpoint';

describe('immutable project target', () => {
  it('binds encoded paths and rejects incomplete or relative scopes', () => {
    const url = new URL('http://127.0.0.1:3275/mcp?client=chat');
    expect(projectTarget(url)).toBeUndefined();
    url.searchParams.set('projectId', 'a');
    expect(() => projectTarget(url)).toThrow('carpeta absoluta');
    url.searchParams.set('projectDir', '../other');
    expect(() => projectTarget(url)).toThrow('carpeta absoluta');
    const dir = resolve('Sika & compañía #1'); url.searchParams.set('projectDir', dir);
    const target = projectTarget(url)!;
    url.searchParams.set('projectId', 'b');
    expect(target).toEqual({ id: 'a', dir }); expect(Object.isFrozen(target)).toBe(true);
  });
  it('CLI follows only a valid project-scoped loopback endpoint', () => {
    const url = new URL('http://127.0.0.1:39555/mcp?client=chat');
    url.searchParams.set('projectId', 'a'); url.searchParams.set('projectDir', process.cwd());
    expect(mcpEndpoint({ SYKA_PROJECT_MCP_URL: url.href })).toBe(url.href);
    expect(() => mcpEndpoint({ SYKA_PROJECT_MCP_URL: 'https://example.com/mcp?projectId=a&projectDir=/p' })).toThrow('inválido');
    expect(() => mcpEndpoint({ SYKA_PROJECT_MCP_URL: 'http://127.0.0.1:3275/mcp' })).toThrow('inválido');
  });
  it('serializes a real directory and its junction in one lane while another project keeps running', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-preview-alias-'));
    const direct = join(root, 'project'), alias = join(root, 'alias'), other = join(root, 'other');
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started: string[] = [];
    const queue = new ProjectPreviewQueue(async job => {
      const name = (job.args as { name: string }).name;
      started.push(name);
      if (name === 'direct') await gate;
      return name;
    }, () => {}, { concurrency: 2 });
    try {
      await mkdir(direct); await mkdir(other);
      await symlink(direct, alias, process.platform === 'win32' ? 'junction' : 'dir');
      const make = (dir: string, name: string) => canonicalPreviewJob({ project: { id: dir === other ? 'other-id' : 'shared-id', dir }, tool: 'capture', args: { name } });
      const a = await make(direct, 'direct'), b = await make(alias, 'alias'), c = await make(other, 'other');
      expect(projectKey(a.project)).toBe(projectKey(b.project));
      expect(b.project).toEqual({ id: 'shared-id', dir: await realpath(direct) });
      const signal = new AbortController().signal;
      const first = queue.call(a, signal), same = queue.call(b, signal), independent = queue.call(c, signal);
      await expect(independent).resolves.toBe('other');
      expect(started).toEqual(['direct', 'other']);
      expect(queue.status()).toMatchObject({ waiting: 1 });
      release();
      expect(await Promise.all([first, same])).toEqual(['direct', 'alias']);
      expect(started).toEqual(['direct', 'other', 'alias']);
    } finally {
      release(); queue.stop();
      if (!root.startsWith(join(tmpdir(), 'syka-preview-alias-'))) throw Error('Unexpected fixture');
      await rm(root, { recursive: true, force: true });
    }
  });
  it('normalizes open through either alias and rejects a different physical project before enqueue', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-preview-open-'));
    const direct = join(root, 'project'), alias = join(root, 'alias'), other = join(root, 'other');
    try {
      await mkdir(direct); await mkdir(other);
      await symlink(direct, alias, process.platform === 'win32' ? 'junction' : 'dir');
      const job = { project: Object.freeze({ id: 'unchanged', dir: alias }), tool: 'open', args: { dir: alias } };
      const normalized = await canonicalPreviewJob(job);
      expect(normalized).toMatchObject({ project: { id: 'unchanged', dir: await realpath(direct) }, args: { dir: await realpath(direct) } });
      expect(Object.isFrozen(normalized.project)).toBe(true);
      expect(job.project.dir).toBe(alias); expect(job.args.dir).toBe(alias);
      await expect(canonicalPreviewJob({ ...job, args: { dir: direct } })).resolves.toEqual(normalized);
      await expect(canonicalPreviewJob({ ...job, args: { dir: other } })).rejects.toMatchObject({ code: 'invalid-input' });
      await expect(canonicalPreviewJob({ ...job, args: { dir: '../project' } })).rejects.toMatchObject({ code: 'invalid-input' });
      await expect(canonicalPreviewJob({ ...job, project: { id: 'unchanged', dir: join(root, 'missing') } })).rejects.toMatchObject({ code: 'not-found' });
    } finally {
      if (!root.startsWith(join(tmpdir(), 'syka-preview-open-'))) throw Error('Unexpected fixture');
      await rm(root, { recursive: true, force: true });
    }
  });
});
