import { describe, expect, it } from 'vitest';
import { startEditorToolBridge } from '../src/host/editor-tool-bridge';
import type { OpenOptions } from '../src/host/harness';
import { resolve } from 'node:path';

describe('shared provider motion tools', () => {
  it('advertises and executes native planning on the actual MCP bridge without a model turn', async () => {
    const bridge = await startEditorToolBridge({ cwd: process.cwd(), model: 'test-model', mcp: null, emit: () => {},
      env: { env: { SYKA_REFERENCE_DOCS_DIR: resolve(import.meta.dirname, '../../../docs') }, extraDirs: [] },
      askUser: async () => 'skip',
    } satisfies OpenOptions);
    try {
      const call = async (method: string, params: object) => {
        const response = await fetch(bridge.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
        expect(response.status).toBe(200); return await response.json() as { result: any };
      };
      const list = await call('tools/list', {});
      const names = list.result.tools.map((tool: { name: string }) => tool.name);
      expect(names).toContain('syka_motion_plan'); expect(names).toContain('syka_ask_user');
      expect(names).toContain('syka_audio_analyze'); expect(names).toContain('syka_motion_review');
      expect(names).toContain('syka_audio_balance'); expect(names).toContain('syka_audio_review');
      const audio = await call('tools/call', { name: 'syka_audio_analyze', arguments: { source: 'https://example.com/audio.wav' } });
      expect(audio.result.isError).toBe(true);
      expect(audio.result.content[0].text).toContain('local');
      const plan = await call('tools/call', { name: 'syka_motion_plan', arguments: { brief: { purpose: 'Test' } } });
      expect(JSON.parse(plan.result.content[0].text)).toMatchObject({ state: 'needs_answers', missing: expect.arrayContaining(['audio.mode', 'delivery.durationSeconds']) });
      const knowledge = await call('tools/call', { name: 'syka_motion_knowledge', arguments: { id: 'stack-whaleyxbt-claude-motion', includeText: true } });
      expect(JSON.parse(knowledge.result.content[0].text).results[0].sourceText).toContain('Beats con nombres');
    } finally { await bridge.close(); }
  });
});
