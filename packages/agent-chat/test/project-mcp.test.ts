import { describe, expect, it } from 'vitest';
import { bindProjectMcp } from '../src/host/project-mcp';

describe('project-bound MCP connection', () => {
  it('keeps instance/client parameters and carries paths with spaces, Unicode and query characters', () => {
    const original = { name: 'syka' as const, url: 'http://127.0.0.1:39555/mcp?client=chat' };
    const dir = 'F:\\Motions\\Sika & compañía #1';
    const scoped = bindProjectMcp(original, 'project-a', dir)!;
    const url = new URL(scoped.url);
    expect(url.origin).toBe('http://127.0.0.1:39555');
    expect(url.searchParams.get('client')).toBe('chat');
    expect(url.searchParams.get('projectId')).toBe('project-a');
    expect(url.searchParams.get('projectDir')).toBe(dir);
    expect(original.url).toBe('http://127.0.0.1:39555/mcp?client=chat');
    expect(bindProjectMcp(original, 'project-b', 'F:\\Motions\\b')!.url).not.toBe(scoped.url);
  });
  it('preserves disconnected tools instead of discovering another instance', () => {
    expect(bindProjectMcp(null, 'a', 'F:\\Motions\\a')).toBeNull();
  });
});
