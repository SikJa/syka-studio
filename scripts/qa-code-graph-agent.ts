// Opt-in real subscription turn, through the same host/socket/dynamic tools as
// Syka. Isolated chat/runtime data; no editor endpoint or project modifications.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { WebSocket } from 'ws';
import { createAgentHost, CodexHarness } from '../packages/agent-chat/src/host/index';
import { codeGraph } from '../packages/agent-chat/src/host/code-graph';
import { AgentChatClient } from '../packages/agent-chat/src/client';
import { emptyTranscript, reduce } from '../packages/agent-chat/src/reduce';
import type { Transcript } from '../packages/agent-chat/src/reduce';

if (!process.argv.includes('--live')) throw Error('Use --live only for an authorized real agent validation.');
const root = resolve('.'), work = join(root, '.runtime/graphify-qa/agent'), output = join(root, 'output/graphify');
await mkdir(work, { recursive: true }); await mkdir(output, { recursive: true });
await writeFile(join(work, 'AGENTS.md'), 'Isolated code-map validation. Use syka_code_graph only. Do not read unrelated files, start subagents, change files, contact editor instances or call other tools.\n');
const host = await createAgentHost({ token: randomBytes(24).toString('hex'), dataDir: join(work, 'chats'), runtimeDir: join(work, 'runtime'),
  version: '0.207.0', mcp: null, codeGraphRoot: root, harnesses: [new CodexHarness('0.207.0')], allowedOrigins: ['null'],
  instructions: 'This isolated validation is read-only. For this turn use syka_code_graph only. Never spawn subagents or call shell tools.',
  log: message => { if (message.startsWith('[code-graph]')) console.error(message); },
});
const client = new AgentChatClient({ resolveEndpoint: async () => host.url, WebSocket: WebSocket as unknown as typeof globalThis.WebSocket });
client.connect();
const until = async (predicate: () => boolean | Promise<boolean>, timeout = 120000) => {
  const deadline = Date.now() + timeout;
  while (!(await predicate())) { if (Date.now() > deadline) throw Error('QA timeout'); await new Promise(r => setTimeout(r, 500)); }
};
let unsubscribe: (() => void) | undefined;
try {
  await until(() => client.state === 'open');
  await until(async () => (await codeGraph(root, { action: 'status' }) as { status: { current: boolean } }).status.current);
  await until(() => client.harnesses.some(h => h.id === 'codex' && h.status !== 'checking'));
  const harness = client.harnesses.find(h => h.id === 'codex')!;
  if (harness.status !== 'ready') throw Error('Codex unavailable: ' + harness.status + ' ' + harness.detail);
  const model = harness.defaultModel ?? harness.models[0]!.id;
  const sent = await client.request('turn.send', { projectId: 'graphify-isolated-qa', cwd: work,
    text: 'Validá el mapa de código de Syka: encontrá la ruta de EditorExportButton con syka_code_graph y consultá sus relaciones. Usá las herramientas reales. Respondé en español con la ruta, dos relaciones observadas con su confianza y si el índice está vigente. No uses shell, subagentes ni modifiques archivos.',
    model: { harness: 'codex', model, effort: 'low' }, attachments: [] });
  let transcript: Transcript = emptyTranscript();
  unsubscribe = client.open(sent.chatId, message => {
    if (message.type === 'snapshot') transcript = { items: message.snapshot.items, pending: message.snapshot.pending, turnId: null, chat: message.snapshot.chat };
    else transcript = reduce(transcript, message.event);
  });
  await until(() => transcript.chat?.status === 'idle' && transcript.items.some(item => item.kind === 'assistant'), 180000);
  const calls = transcript.items.filter(item => item.kind === 'tool');
  const assistants = transcript.items.filter(item => item.kind === 'assistant');
  assert.ok(calls.filter(item => item.name.includes('syka_code_graph') && item.status === 'done').length >= 2, 'Expected query and relations tool calls');
  assert.ok(assistants.some(item => item.text.includes('editor-export-button.tsx')));
  const evidence = { verifiedAt: new Date().toISOString(), kind: 'real Codex subscription turn through Syka host/WebSocket/dynamic tools', model, chatId: sent.chatId,
    status: await codeGraph(root, { action: 'status' }), tools: calls, reply: assistants,
    otherProviders: 'MCP transport tested locally; Claude/ACP model turns not validated by this run.' };
  await writeFile(join(output, 'real-agent.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ passed: true, model, toolCalls: calls.length, evidence: join(output, 'real-agent.json'), reply: assistants }));
} finally { unsubscribe?.(); client.close(); await host.stop(); }
