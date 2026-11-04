import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startEditorToolBridge } from '../src/host/editor-tool-bridge';
import type { OpenOptions } from '../src/host/harness';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe('a question the provider gave up on', () => {
  it('is cancelled in the chat instead of waiting forever for the next question to collide with', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-ask-abandon-')); roots.push(root);
    let seen: AbortSignal | undefined;
    const aborted = new Promise<void>(resolve => {
      const options = { cwd: root, model: 'm', mcp: null, env: { env: {}, extraDirs: [] }, emit: () => {},
        askUser: (_questions: unknown, signal?: AbortSignal) => new Promise(() => { seen = signal; signal?.addEventListener('abort', () => resolve(), { once: true }); }) } as unknown as OpenOptions;
      void (async () => {
        const bridge = await startEditorToolBridge(options);
        const request = new AbortController();
        const call = fetch(bridge.url, { method: 'POST', signal: request.signal, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call',
          params: { name: 'syka_ask_user', arguments: { questions: [{ id: 'q', header: 'Música', question: '¿Qué música?', options: [{ label: 'Mixkit', description: 'tema de Mixkit' }, { label: 'Silencio', description: 'sin música' }] }] } } }) }).catch(() => undefined);
        await new Promise(r => setTimeout(r, 150));
        request.abort();
        await call;
        setTimeout(() => void bridge.close(), 500);
      })();
    });
    await aborted;
    expect(seen?.aborted).toBe(true);
  });
});
