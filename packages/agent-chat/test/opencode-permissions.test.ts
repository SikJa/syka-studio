import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AcpHarness } from '../src/host/acp';
import type { HarnessSession, OpenOptions } from '../src/host/harness';
import type { ChatEvent, Question } from '../src/protocol';

const roots: string[] = [], sessions: HarnessSession[] = [];
async function setup(id: 'opencode' | 'cursor' = 'opencode', overrides: Partial<OpenOptions> = {}) {
  const root = await mkdtemp(join(tmpdir(), 'syka-opencode-permission-')); roots.push(root);
  const env = { env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? 'C:\\Windows', OPENCODE_PERMISSION: '{"*":"ask"}', OPENCODE_CONFIG_CONTENT: '{"model":"wrong"}', OPENAI_API_KEY: 'must-not-inherit' }, extraDirs: [] };
  const harness = new AcpHarness({ id, command: process.execPath, args: [fileURLToPath(new URL('./fixtures/opencode-permissions.mjs', import.meta.url)), id], profileDir: root, openCodeAccount: 'syka' });
  const session = await harness.open({ cwd: root, model: 'deepseek-fixture', mcp: null, env, emit: () => {}, ...overrides }); sessions.push(session);
  return session;
}
async function send(session: HarnessSession, input: string) {
  const events: ChatEvent[] = [];
  const outcome = await session.send(input, 'deepseek-fixture', event => events.push(event));
  return { outcome, events, text: events.filter(event => event.type === 'item.delta').map(event => event.text).join('') };
}
afterEach(async () => {
  for (const session of sessions.splice(0)) await session.close();
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !root.includes('syka-opencode-permission-')) throw Error('Invalid fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});

describe('OpenCode full access in Syka', () => {
  it('sets the official permission environment only on its local process without inheriting routing or keys', async () => {
    const session = await setup();
    const result = await send(session, 'environment');
    expect(result.outcome.status).toBe('completed');
    expect(JSON.parse(result.text)).toEqual({ permission: '{"*":"allow"}', configContent: null, apiKeyInherited: false });
    const other = await setup('cursor');
    expect(JSON.parse((await send(other, 'environment')).text).permission).toBeNull();
  });
  it('approves repeated ACP requests without showing permission questions, preferring allow_always', async () => {
    const session = await setup();
    for (const [input, optionId] of [['always', 'always-id'], ['once', 'once-id'], ['once', 'once-id']]) {
      const result = await send(session, input!);
      expect(result.outcome.status).toBe('completed');
      expect(JSON.parse(result.text)).toEqual({ outcome: { outcome: 'selected', optionId } });
      expect(result.events.some(event => event.type === 'request.opened')).toBe(false);
    }
  });
  it.each(['deny-only', 'unknown', 'foreign'])('does not invent an approval for %s permission options or another session', async input => {
    const result = await send(await setup(), input);
    expect(JSON.parse(result.text)).toEqual({ outcome: { outcome: 'cancelled' } });
    expect(result.events.some(event => event.type === 'request.opened')).toBe(false);
  });
  it('still presents real user questions through the Syka bridge', async () => {
    const askUser = vi.fn(async (_questions: Question[]) => ({ answers: { format: ['Vertical'] } }));
    const result = await send(await setup('opencode', { askUser }), 'question');
    expect(result.outcome.status).toBe('completed');
    expect(askUser).toHaveBeenCalledOnce();
    expect(askUser.mock.calls[0]?.[0]).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'format', question: '¿Qué formato querés?' })]));
    expect(result.text).toContain('Vertical');
    expect(result.text).toContain('answered');
  });
});
