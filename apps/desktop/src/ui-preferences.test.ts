import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UiPreferences } from './ui-preferences';

describe('durable UI preferences', () => {
  it('retains model and visibility after restarting, merges changes and removes values', () => {
    const root = mkdtempSync(join(tmpdir(), 'syka-prefs-'));
    try {
      const file = join(root, 'prefs.json'), first = new UiPreferences(file);
      first.set('dspro.ui.agentChat.model', '{"value":{"harness":"claude","model":"sonnet"}}');
      first.set('dspro.ui.agentChat.modelVisibility', '{"value":{"harnesses":{"grok":false}}}');
      const second = new UiPreferences(file);
      expect(second.get('dspro.ui.agentChat.model')).toContain('sonnet');
      expect(second.get('dspro.ui.agentChat.modelVisibility')).toContain('false');
      second.set('dspro.ui.agentChat.model', null);
      second.set('dspro.ui.agentChat.pickerPresentation', JSON.stringify({value:{orientation:'horizontal',material:'glass',favorites:['codex:terra']}}));
      expect(JSON.parse(new UiPreferences(file).get('dspro.ui.agentChat.pickerPresentation')!)).toEqual({value:{orientation:'horizontal',material:'glass',favorites:['codex:terra']}});
      expect(new UiPreferences(file).get('dspro.ui.agentChat.model')).toBeNull();
      expect(() => second.set('token', 'private')).toThrow();
      expect(() => second.set('dspro.ui.large', 'x'.repeat(256001))).toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('preserves a damaged file instead of resetting preferences', () => {
    const root = mkdtempSync(join(tmpdir(), 'syka-prefs-'));
    try {
      const file = join(root, 'prefs.json'); writeFileSync(file, '{damaged');
      expect(() => new UiPreferences(file)).toThrow();
      expect(readFileSync(file, 'utf8')).toBe('{damaged');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
