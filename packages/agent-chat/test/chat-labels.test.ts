import { describe, expect, it } from 'vitest';
import { titleFor } from '../src/protocol';
import { claudeToolTitle } from '../src/host/claude-cli';

describe('chat labels', () => {
  it('names a chat by its words, not the markup a pasted prompt opens with', () => {
    expect(titleFor('<inputs> All inputs are below </inputs> Lanzamiento')).toBe('All inputs are below Lanzamiento');
    expect(titleFor('Animá el logo')).toBe('Animá el logo');
    expect(titleFor('a < b y c > d')).toBe('a < b y c > d');
  });

  it('shows a Claude MCP call by its tool name, like Codex does', () => {
    expect(claudeToolTitle('mcp__syka__gate')).toBe('gate');
    expect(claudeToolTitle('mcp__syka_workspace__syka_mixkit')).toBe('syka_mixkit');
    expect(claudeToolTitle('Bash')).toBe('Bash');
  });
});
