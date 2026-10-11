import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMcp, mcpStatus } from './mcp-install';

const files = vi.hoisted(() => ({ data: new Map<string, string>(), writes: [] as { path: string; text: string }[] }));
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => 'F:/syka-test-app-data' } }));
vi.mock('./cli-windows', () => ({ shimPath: () => 'F:/syka-test-cli/dapi.cmd' }));
vi.mock('@diffusionstudio/agent-chat/host/env', () => ({ inheritedEnv: () => ({}), which: () => null }));
vi.mock('node:fs', () => ({
  existsSync: (path: string) => files.data.has(path),
  readFileSync: (path: string) => files.data.get(path),
  mkdirSync: () => {},
  writeFileSync: (path: string, text: string) => { files.writes.push({ path, text }); files.data.set(path, text); },
}));
beforeEach(() => { files.data.clear(); files.writes = []; });

describe('MCP registration follows this window', () => {
  it('reports and registers the isolated HTTP endpoint, preserving unrelated config', () => {
    const connection = { url: 'http://127.0.0.1:43278/mcp', available: true, error: null };
    const status = mcpStatus(connection);
    expect(status.url).toBe(connection.url); expect(status.available).toBe(true);
    const codex = status.agents.find(a => a.id === 'codex')!;
    files.data.set(codex.config, 'model = "keep-this"\n[mcp_servers.syka]\nurl = "http://127.0.0.1:3275/mcp"\n');
    expect(mcpStatus(connection).agents.find(a => a.id === 'codex')!.connected).toBe(false);
    expect(applyMcp({ add: ['codex'], remove: [] }, connection)).toMatchObject({ added: ['codex'], failures: [] });
    expect(files.writes[0]!.text).toContain('url = "http://127.0.0.1:43278/mcp"');
    expect(files.writes[0]!.text).toContain('model = "keep-this"');
    expect(mcpStatus(connection).agents.find(a => a.id === 'codex')!.connected).toBe(true);
    expect(mcpStatus(connection).agents.find(a => a.id === 'claude-desktop')!.unavailable).toContain('proxy CLI');
  });

  it('disables registration after bind failure and leaves all configs untouched', () => {
    const connection = { url: 'http://127.0.0.1:43278/mcp', available: false, error: 'El puerto ya está ocupado.' };
    const status = mcpStatus(connection);
    expect(status.error).toBe(connection.error);
    expect(status.agents.every(a => a.unavailable === connection.error)).toBe(true);
    expect(applyMcp({ add: ['codex', 'cursor'], remove: [] }, connection)).toEqual({
      added: [], removed: [], failures: [{ id: 'codex', error: connection.error }, { id: 'cursor', error: connection.error }],
    });
    expect(files.writes).toEqual([]);
  });
});
