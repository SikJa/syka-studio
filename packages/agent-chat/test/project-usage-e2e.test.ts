import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { WebSocket } from 'ws';
import { expect, it } from 'vitest';
import { AgentChatClient } from '../src/client';
import { createAgentHost, type RunningAgentHost } from '../src/host/index';
import type { Harness } from '../src/host/harness';
import type { ProjectTokenUsage } from '../src/protocol';

it('pushes unopened project usage over real sockets and preserves it across host restart and chat deletion', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'syka-usage-e2e-'));
  const totals = new Map<string, number>();
  const harness: Harness = {
    id: 'codex',
    async probe() { return { id: 'codex', label: 'Fixture', status: 'ready', models: [{ id: 'fake', label: 'Fake' }] }; },
    async open(options) {
      const sessionId = options.resume && 'codex' in options.resume ? options.resume.codex.threadId : randomUUID();
      return {
        resume: { codex: { threadId: sessionId } },
        async send(_text, model, emit) {
          const total = (totals.get(sessionId) ?? 0) + 40; totals.set(sessionId, total);
          for (let i = 0; i < 2; i++) emit({ type: 'usage.reported', usage: { sessionId, kind: 'cumulative', model, tokens: { totalTokens: total } } });
          emit({ type: 'item.completed', item: { id: randomUUID(), kind: 'assistant', text: 'Fixture completed' } });
          return { status: 'completed' as const };
        },
        respond() {}, async interrupt() {}, async close() {},
      };
    },
  };
  let host: RunningAgentHost | undefined;
  const clients: AgentChatClient[] = [];
  const start = () => createAgentHost({ token: 'local-fixture', dataDir: dir, mcp: null, version: 'test', harnesses: [harness], allowedOrigins: ['null'], log() {} });
  const connect = async () => {
    const client = new AgentChatClient({ resolveEndpoint: async () => host!.url, WebSocket: WebSocket as unknown as typeof globalThis.WebSocket });
    clients.push(client);
    const opened = new Promise<void>(res => { const off = client.onState(s => { if (s === 'open') { off(); res(); } }); });
    client.connect(); await opened; return client;
  };
  const nextUsage = (client: AgentChatClient, projectId: string, total: number) => new Promise<ProjectTokenUsage>((res, rej) => {
    const timeout = setTimeout(() => { off(); rej(Error('Missing usage push')); }, 5000);
    const off = client.onUsage(value => { if (value.projectId === projectId && value.tokens.totalTokens === total) { off(); clearTimeout(timeout); res(value); } });
  });
  const waitIdle = async (client: AgentChatClient, chatId: string) => {
    for (let i = 0; i < 100; i++) {
      if ((await client.request('chats.list', { projectId: 'p1' })).find(c => c.id === chatId)?.status === 'idle') return;
      await new Promise(r => setTimeout(r, 5));
    }
    throw Error('Turn did not settle');
  };
  try {
    host = await start();
    const sender = await connect(), dashboard = await connect();
    const initial = await dashboard.request('projects.usage', { projectIds: ['p1', 'p2'] });
    expect(initial.every(v => v.models.length === 0)).toBe(true);
    const pushed1 = nextUsage(dashboard, 'p1', 40), pushed2 = nextUsage(dashboard, 'p2', 40);
    const [first] = await Promise.all(['p1', 'p2'].map(projectId => sender.request('turn.send', { projectId, cwd: dir, model: { harness: 'codex', model: 'fake' }, text: 'fixture' })));
    await Promise.all([pushed1, pushed2]);
    expect(dashboard.subscribed(first.chatId)).toBe(false);
    expect((await dashboard.request('projects.usage', { projectIds: ['p1', 'p2'] })).map(v => v.tokens.totalTokens)).toEqual([40, 40]);
    await waitIdle(sender, first.chatId);
    const snapshot = await sender.request('chats.open', { chatId: first.chatId });
    expect(snapshot.items.filter(i => i.kind !== 'notice').map(i => i.kind)).toEqual(['user', 'assistant']);
    for (const c of clients.splice(0)) c.close();
    await host.stop(); host = await start();
    const recovered = await connect();
    expect((await recovered.request('projects.usage', { projectIds: ['p1'] }))[0].tokens.totalTokens).toBe(40);
    const resumed = nextUsage(recovered, 'p1', 80);
    await recovered.request('turn.send', { chatId: first.chatId, projectId: 'p1', cwd: dir, model: { harness: 'codex', model: 'fake' }, text: 'resume' });
    await resumed; await waitIdle(recovered, first.chatId);
    await recovered.request('chats.delete', { chatId: first.chatId });
    expect((await recovered.request('projects.usage', { projectIds: ['p1'] }))[0].tokens.totalTokens).toBe(80);
    await expect(recovered.request('projects.usage', { projectIds: [null] } as never)).rejects.toMatchObject({ code: 'bad-request' });
  } finally {
    for (const c of clients) c.close(); await host?.stop();
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep) || !dir.includes('syka-usage-e2e-')) throw Error('Unsafe fixture cleanup');
    await rm(dir, { recursive: true, force: true });
  }
}, 15000);
