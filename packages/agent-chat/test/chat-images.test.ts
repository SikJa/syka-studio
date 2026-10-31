import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ChatStore } from '../src/host/store';
import { AgentHost } from '../src/host/host';
import { startServer } from '../src/host/server';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
const temp = async () => { const root = await mkdtemp(join(tmpdir(), 'syka-images-')); roots.push(root); return root; };
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64');
const tool = (id: string, images: { mediaType: string; data: string }[]) => ({ type: 'item.completed', item: { id, kind: 'tool', name: 'capture', title: 'Captura', status: 'done', images } });

describe('chat images stored as files', () => {
  it('externalizes known image types once, keeps unknown types inline', async () => {
    const store = new ChatStore(await temp());
    const [image, other] = store.externalizeImages('chat-1', [{ mediaType: 'image/png', data: png }, { mediaType: 'image/x-raw', data: 'AAAA' }]);
    expect(image).toMatchObject({ mediaType: 'image/png', data: '' });
    expect(image!.ref).toMatch(/^[a-f0-9]{32}\.png$/);
    expect((await readFile(store.imagePath('chat-1', image!.ref!)!)).toString('base64')).toBe(png);
    expect(other).toEqual({ mediaType: 'image/x-raw', data: 'AAAA' });
    expect(store.imagePath('chat-1', '../meta.json')).toBeNull();
    expect(store.imagePath('../x', image!.ref!)).toBeNull();
  });

  it('migrates an old log once, keeps a backup and preserves the transcript', async () => {
    const data = await temp(), store = new ChatStore(data), dir = join(data, 'chats', 'old');
    await mkdir(dir, { recursive: true });
    const lines = [JSON.stringify(tool('first', [])), JSON.stringify(tool('a', [{ mediaType: 'image/png', data: png }])), '{"broken'];
    await writeFile(join(dir, 'events.jsonl'), lines.join('\n'));
    expect(await store.migrateImages('old')).toBe(true);
    expect(await store.migrateImages('old')).toBe(false);
    const raw = await readFile(join(dir, 'events.jsonl'), 'utf8');
    expect(raw).not.toContain(png);
    expect(raw).toContain('{"broken');
    expect(await readFile(join(dir, 'events.jsonl.inline-images.bak'), 'utf8')).toBe(lines.join('\n'));
    const item = (await store.readTranscript('old')).items.find(entry => entry.id === 'a') as { images: { ref: string }[] };
    expect(existsSync(store.imagePath('old', item.images[0]!.ref)!)).toBe(true);
  });

  it('reports sizes and provider timings without chat content', async () => {
    const data = await temp(), store = new ChatStore(data), dir = join(data, 'chats', 'known');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'meta.json'), JSON.stringify({ id: 'known', projectId: 'p', title: 'Mi chat', harness: 'codex', model: 'm', status: 'idle', createdAt: 1, updatedAt: 1, cwd: data, resume: null }));
    await writeFile(join(dir, 'events.jsonl'), JSON.stringify(tool('a', [])) + '\n');
    store.externalizeImages('known', [{ mediaType: 'image/png', data: png }]);
    const harness = { id: 'grok', probe: async () => ({ id: 'grok', label: 'Grok', status: 'ready', models: [{ id: 'm', label: 'M' }] }), open: async () => { throw Error('unused'); } };
    const host = new AgentHost({ version: 'fixture', store, harnesses: [harness as never], env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null });
    const connection = { send() {} };
    host.connect(connection as never); await host.start();
    try {
      await host.handle(connection as never, 'harnesses.list', { refresh: true });
      const report = await host.handle(connection as never, 'diagnostics', {});
      expect(report.providers[0]).toMatchObject({ id: 'grok', status: 'ready', models: 1, cached: false });
      expect(report.providers[0]!.durationMs).toBeGreaterThanOrEqual(0);
      expect(report.chats).toMatchObject({ count: 1, inlineImageChats: 0, largest: [{ title: 'Mi chat' }] });
      expect(report.chats.imageBytes).toBeGreaterThan(0);
      expect(JSON.stringify(report)).not.toContain('Captura');
    } finally { await host.stop(); }
  });

  it('serves a stored image only with the token and only for a known chat', async () => {
    const data = await temp(), store = new ChatStore(data), dir = join(data, 'chats', 'known');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'meta.json'), JSON.stringify({ id: 'known', projectId: 'p', title: 't', harness: 'codex', model: 'm', status: 'idle', createdAt: 1, updatedAt: 1, cwd: data, resume: null }));
    const [image] = store.externalizeImages('known', [{ mediaType: 'image/png', data: png }]);
    const host = new AgentHost({ version: 'fixture', store, harnesses: [], env: Promise.resolve({ env: {}, extraDirs: [] }), mcp: null });
    await host.start();
    const server = await startServer({ host: '127.0.0.1', port: 0, token: 'secret-token', allowedOrigins: ['null'], agentHost: host });
    try {
      const base = `http://127.0.0.1:${server.port}/images`;
      const ok = await fetch(`${base}/known/${image!.ref}?token=secret-token`);
      expect(ok.status).toBe(200);
      expect(ok.headers.get('content-type')).toBe('image/png');
      expect(Buffer.from(await ok.arrayBuffer()).toString('base64')).toBe(png);
      expect((await fetch(`${base}/known/${image!.ref}?token=wrong`)).status).toBe(404);
      expect((await fetch(`${base}/unknown/${image!.ref}?token=secret-token`)).status).toBe(404);
      expect((await fetch(`${base}/known/..%2Fmeta.json?token=secret-token`)).status).toBe(404);
    } finally { await server.close(); await host.stop(); }
  });
});
