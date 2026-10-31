import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store';
import { UiPreferences } from '../../../../desktop/src/ui-preferences';

function storage() {
  const entries = new Map<string, string>();
  return { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key) } as unknown as Storage;
}
afterEach(() => vi.unstubAllGlobals());
describe('settings across preview origins and app restarts', () => {
  it('imports local choices once and restores them into a fresh window without stale values winning', () => {
    const directory = mkdtempSync(join(tmpdir(), 'syka-window-prefs-'));
    try {
      const path = join(directory, 'preferences.json');
      let native = new UiPreferences(path);
      const preferences = { getItem: (key: string) => native.get(key), setItem: (key: string, value: string) => native.set(key, value), removeItem: (key: string) => native.set(key, null) };
      vi.stubGlobal('window', { desktop: { preferences } });
      const oldOrigin = storage(); oldOrigin.setItem('dspro.ui.agentChat.model', JSON.stringify({ value: { harness: 'claude', model: 'sonnet' } }));
      expect(new Store('dspro.ui', oldOrigin).define('agentChat.model', null).value).toEqual({ harness: 'claude', model: 'sonnet' });
      native = new UiPreferences(path);
      const app = new Store('dspro.ui', storage());
      expect(app.define('agentChat.model', null).value).toEqual({ harness: 'claude', model: 'sonnet' });
      app.set('agentChat.model', { harness: 'codex', model: 'selected' });
      expect(new Store('dspro.ui', oldOrigin).define('agentChat.model', null).value).toEqual({ harness: 'codex', model: 'selected' });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
