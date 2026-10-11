import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { projectTarget } from './project-target';
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
});
