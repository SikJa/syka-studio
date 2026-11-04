import { beforeEach, describe, expect, it } from 'vitest';
import { WHATS_NEW_PAGES } from './whats-new-pages';
import { WHATS_NEW_RELEASE, WHATS_NEW_STORAGE_KEY, closeWhatsNew, hasSeenWhatsNew, openWhatsNew, whatsNewOpen, whatsNewSession } from './whats-new-store';

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  Object.assign(globalThis, { localStorage: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value) } });
});

describe('novedades de Syka', () => {
  it('opens once per release and remembers it on close', () => {
    expect(hasSeenWhatsNew()).toBe(false);
    const before = whatsNewSession();
    openWhatsNew();
    expect(whatsNewOpen()).toBe(true);
    expect(whatsNewSession()).toBe(before + 1);
    closeWhatsNew();
    expect(whatsNewOpen()).toBe(false);
    expect(memory.get(WHATS_NEW_STORAGE_KEY)).toBe(WHATS_NEW_RELEASE);
    expect(hasSeenWhatsNew()).toBe(true);
    expect(hasSeenWhatsNew('0.212.0')).toBe(false);
  });

  it('names this release and tells each change in a short page', () => {
    expect(WHATS_NEW_RELEASE).toMatch(/^\d+\.\d+\.\d+$/);
    expect(new Set(WHATS_NEW_PAGES.map(page => page.id)).size).toBe(WHATS_NEW_PAGES.length);
    for (const page of WHATS_NEW_PAGES) {
      expect(page.title.length).toBeLessThanOrEqual(42);
      expect(page.body.length).toBeLessThanOrEqual(200);
    }
  });
});
