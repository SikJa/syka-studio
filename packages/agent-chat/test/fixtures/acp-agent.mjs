import { createInterface } from 'node:readline';
const mode = process.argv[2];
const agent = process.argv[3] ?? (mode === 'hermes' ? 'hermes' : 'antigravity');
const send = message => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
let promptId;
let permissionId;
createInterface({ input: process.stdin }).on('line', async line => {
  const m = JSON.parse(line);
  const result = data => send({ id: m.id, result: data });
  if (!m.method && m.id === permissionId) {
    send({ method: 'session/update', params: { sessionId: 's1', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: JSON.stringify(m.result) } } } });
    send({ id: promptId, result: { stopReason: 'end_turn' } }); return;
  }
  switch (m.method) {
    case 'initialize': result({ protocolVersion: mode === 'v2' ? 2 : 1, ...(mode === 'no-agent-info' ? {} : { agentInfo: mode === 'malformed-agent-info' ? {} : { name: mode === 'wrong-binary' ? 'wrong-agent' : agent + '-acp', version: '1.0' } }), authMethods: [{ id: 'official-login', name: 'Official login' }], agentCapabilities: { loadSession: mode !== 'no-resume', mcpCapabilities: { http: mode !== 'no-http' }, promptCapabilities: { image: true } } }); break;
    case 'authenticate': result({}); break;
    case 'session/new':
      if (mode === 'signed-out') send({ id: m.id, error: { code: -32000, message: 'Authentication required' } });
      else result({ sessionId: 's1', models: { currentModelId: 'model-one', availableModels: [{ modelId: 'model-one', name: 'Model One' }, { modelId: 'future-model', name: 'Future model' }] } });
      break;
    case 'session/load': result({ models: { currentModelId: 'model-one', availableModels: [{ modelId: 'model-one', name: 'Model One' }] } }); break;
    case 'session/set_model': result({}); break;
    case 'session/prompt': {
      const input = m.params.prompt[0].text;
      if (input.startsWith('/steer ')) {
        send({ method: 'session/update', params: { sessionId: 's1', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '⏩ Steer queued for the active turn: ' + input.slice(7) } } } });
        result({ stopReason: 'end_turn' }); break;
      }
      promptId = m.id;
      if (input.includes('hang')) break;
      if (input.includes('permission')) { permissionId = 'permission1'; send({ id: permissionId, method: 'session/request_permission', params: { sessionId: 's1', toolCall: { title: 'Write project file' }, options: [{ optionId: 'allow_once', name: 'Allow once', kind: 'allow_once' }, { optionId: 'reject_once', name: 'Reject', kind: 'reject_once' }] } }); break; }
      if (input.includes('exit')) { process.exit(1); }
      if (mode === 'usage' || mode === 'context-only') send({ method: 'session/update', params: { sessionId: 's1', update: { sessionUpdate: 'usage_update', used: 48000, size: 200000, cost: { amount: 3, currency: 'USD' } } } });
      for (const text of ['hello ', process.env.OPENAI_API_KEY ? 'LEAK' : 'world']) send({ method: 'session/update', params: { sessionId: 's1', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } } } });
      result({ stopReason: 'end_turn', ...(mode === 'usage' ? {usage: {totalTokens: 100, inputTokens: 80, outputTokens: 20, cachedReadTokens: 30, thoughtTokens: 5}} : mode === 'legacy-usage' ? {_meta: {quota: {token_count: {input_tokens: 80, output_tokens: 20}}}} : {}) }); break;
    }
    case 'session/cancel': if (mode !== 'ignore-cancel') send({ id: promptId, result: { stopReason: 'cancelled' } }); break;
  }
});
