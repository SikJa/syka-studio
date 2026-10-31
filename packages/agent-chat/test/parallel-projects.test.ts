import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { WebSocket } from 'ws';
import { expect, it, vi } from 'vitest';
import { AgentChatClient } from '../src/client';
import { createAgentHost } from '../src/host/index';
import { FakeHarness } from '../src/host/fake';

it('keeps ten project turns active through the real socket with independent MCP scopes and cancellation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'syka-parallel-'));
  const fake = new FakeHarness({ tickMs: 1, holdAfterFirstDelta: true });
  const host = await createAgentHost({ token: 'parallel-fixture', dataDir: dir, version: 'test', harnesses: [fake],
    allowedOrigins: ['null'], log() {}, mcp: { name: 'syka', url: 'http://127.0.0.1:3275/mcp?client=chat' } });
  const client = new AgentChatClient({ resolveEndpoint: async () => host.url,
    WebSocket: WebSocket as unknown as typeof globalThis.WebSocket });
  try {
    const connected = new Promise<void>(done => { const off = client.onState(state => { if (state === 'open') { off(); done(); } }); });
    client.connect(); await connected;
    const jobs = Array.from({length: 10}, (_, i) => ({projectId: `video-${i}`, cwd: join(dir, `video-${i}`),
      text: `Edit fixture ${i}`, model: {harness: 'codex' as const, model: 'fake-fast'}}));
    const chats = await Promise.all(jobs.map(job => client.request('turn.send', job)));
    await vi.waitFor(() => expect(fake.sessions).toHaveLength(10));
    const snapshots = await Promise.all(chats.map(chat => client.request('chats.open', chat)));
    expect(snapshots.every(snapshot => snapshot.chat.status === 'running')).toBe(true);
    for (const session of fake.sessions) {
      const url = new URL(session.opened.mcp!.url);
      const projectId = url.searchParams.get('projectId');
      expect(url.searchParams.get('projectDir')).toBe(jobs.find(job => job.projectId === projectId)!.cwd);
    }
    expect(new Set(fake.sessions.map(session => session.opened.mcp!.url)).size).toBe(10);
    const usage = await client.request('projects.usage', {projectIds:['video-0','without-chat']});
    expect(usage[0]?.activity).toEqual({chats:1,harnesses:['codex']});
    expect(usage[1]).toMatchObject({models:[],activity:{chats:0,harnesses:[]}});
    await client.request('turn.interrupt', chats[0]!);
    const others = await Promise.all(chats.slice(1).map(chat => client.request('chats.open', chat)));
    expect(others.every(snapshot => snapshot.chat.status === 'running')).toBe(true);
    await Promise.all(chats.slice(1).map(chat => client.request('turn.interrupt', chat)));
  } finally {
    client.close(); await host.stop();
    const target = resolve(dir);
    if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith('syka-parallel-')) throw Error('Invalid fixture cleanup');
    await rm(target, {recursive: true, force: true});
  }
}, 15000);
