import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { WorkspaceTools } from '../../../../packages/agent-chat/src/host/workspace-tools';
import { chatInstructions } from '../../../../packages/agent-chat/src/host/harness';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const tools = new WorkspaceTools(repo, resolve(repo, 'docs'));

describe('reference workflow is discoverable through actual shared host tools', () => {
  it('reads bundled skill, retrieval script and selected analysis through skill discovery', async () => {
    const list = await tools.call('syka_skills', { action: 'list' }) as { skills: Array<{ name: string; path: string }> };
    const skill = list.skills.find(s => s.name === 'syka-motion-references');
    expect(skill).toBeDefined();
    const loaded = await tools.call('syka_skills', { action: 'read', path: skill!.path }) as { content: string };
    expect(loaded.content).toContain('scripts/retrieve.mjs');
    const catalog = await tools.call('syka_skills', { action: 'read', path: skill!.path, file: 'references/catalog.json' }) as { content: string };
    const parsed = JSON.parse(catalog.content);
    const reference = parsed.entries.find((e: { id: string }) => e.id === 'post-2103273003555402193');
    const analysis = await tools.call('syka_skills', { action: 'read', path: skill!.path, file: reference.analysisFile }) as { content: string };
    expect(analysis.content).toContain('2.55');
    const script = await tools.call('syka_skills', { action: 'read', path: skill!.path, file: 'scripts/retrieve.mjs' }) as { content: string };
    expect(script.content).toContain('rankReferences');
  });

  it('routes the workflow from provider-shared instructions without copying the corpus', () => {
    const instructions = chatInstructions('C:/isolated/project', 'Existing product decisions remain authoritative.');
    expect(instructions.split('read bundled syka-motion-references')).toHaveLength(2);
    expect(instructions).toContain('Existing product decisions remain authoritative.');
    expect(instructions).not.toContain('Create a complete, polished Spotify-themed');
  });
});
