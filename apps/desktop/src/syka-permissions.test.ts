import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PermissionStore, permissionAllowed, trustedPermissionOrigin } from './syka-permissions';

describe('persistent editor permissions', () => {
  it('persists user changes, keeps concurrent changes, and survives reopening', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-permission-test-'));
    try {
      const file = join(root, 'permissions.json'), store = new PermissionStore(file);
      expect((await store.load()).clipboard).toBe(false);
      await Promise.all([store.set('clipboard', true), store.set('notifications', true)]);
      expect(await new PermissionStore(file).load()).toMatchObject({ clipboard: true, notifications: true });
      await store.set('clipboard', false);
      expect(await new PermissionStore(file).load()).toMatchObject({ clipboard: false, notifications: true });
      await expect(store.set('camera' as never, true)).rejects.toThrow('inválido');
      await expect(store.set('microphone', 'true' as never)).rejects.toThrow('inválido');
      expect(JSON.parse(await readFile(file, 'utf8')).permissions.clipboard).toBe(false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('preserves malformed settings without granting new access', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-permission-test-'));
    try {
      const file = join(root, 'permissions.json'); await writeFile(file, '{broken');
      const store = new PermissionStore(file);
      await expect(store.load()).rejects.toThrow('original');
      await expect(store.set('clipboard', true)).rejects.toThrow('original');
      expect(store.snapshot().clipboard).toBe(false);
      expect(await readFile(file, 'utf8')).toBe('{broken');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('restricts grants to the trusted editor and audio-only media', () => {
    const preferences = { clipboard: true, fonts: true, notifications: true, microphone: true };
    expect(permissionAllowed('clipboard-read', preferences)).toBe(true);
    expect(permissionAllowed('media', preferences, ['audio'])).toBe(true);
    expect(permissionAllowed('media', preferences, ['audio', 'video'])).toBe(false);
    expect(permissionAllowed('media', preferences)).toBe(false);
    expect(permissionAllowed('usb', preferences)).toBe(false);
    expect(trustedPermissionOrigin('https://evil.invalid', 'http://localhost:5188')).toBe(false);
    expect(trustedPermissionOrigin('http://localhost:5188/settings', 'http://localhost:5188/project')).toBe(true);
    expect(trustedPermissionOrigin('file:///private.html', 'file:///editor/index.html')).toBe(false);
  });
});
