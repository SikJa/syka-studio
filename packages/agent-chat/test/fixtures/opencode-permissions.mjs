import { createInterface } from 'node:readline';

const agent = process.argv[2] ?? 'opencode';
const send = message => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
let bridge;
let waiting;
let sequence = 0;
const publish = value => send({ method: 'session/update', params: { sessionId: 's1', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: JSON.stringify(value) } } } });

createInterface({ input: process.stdin }).on('line', async line => {
  const message = JSON.parse(line);
  const result = value => send({ id: message.id, result: value });
  if (!message.method && waiting?.permission === message.id) {
    publish(message.result);
    send({ id: waiting.prompt, result: { stopReason: 'end_turn' } });
    waiting = undefined;
    return;
  }
  switch (message.method) {
    case 'initialize':
      result({ protocolVersion: 1, agentInfo: { name: agent + '-acp' }, agentCapabilities: { loadSession: true, mcpCapabilities: { http: true } } });
      break;
    case 'session/new':
    case 'session/load':
      bridge = message.params.mcpServers.find(server => server.name === 'syka_workspace')?.url;
      result({ sessionId: 's1', models: { currentModelId: 'deepseek-fixture', availableModels: [{ modelId: 'deepseek-fixture', name: 'DeepSeek fixture' }] } });
      break;
    case 'session/prompt': {
      const input = message.params.prompt[0].text;
      if (input === 'environment') {
        publish({ permission: process.env.OPENCODE_PERMISSION ?? null, configContent: process.env.OPENCODE_CONFIG_CONTENT ?? null, apiKeyInherited: !!process.env.OPENAI_API_KEY });
        result({ stopReason: 'end_turn' });
        break;
      }
      if (input === 'question') {
        const response = await fetch(bridge, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'syka_ask_user', arguments: { questions: [{ id: 'format', question: '¿Qué formato querés?', options: [{ label: 'Vertical' }, { label: 'Horizontal' }] }] } } }) });
        publish(await response.json());
        result({ stopReason: 'end_turn' });
        break;
      }
      const options = [{ optionId: 'deny-first', name: 'Allow all (misleading label)', kind: 'reject_once' }];
      if (input !== 'deny-only' && input !== 'unknown') options.push({ optionId: 'once-id', name: 'Permitir una vez', kind: 'allow_once' });
      if (input === 'always') options.push({ optionId: 'always-id', name: 'Permitir durante la sesión', kind: 'allow_always' });
      if (input === 'unknown') options.push({ optionId: 'allow_once', name: 'Allow', kind: 'unrecognized' });
      waiting = { prompt: message.id, permission: 'permission-' + ++sequence };
      send({ id: waiting.permission, method: 'session/request_permission', params: { sessionId: input === 'foreign' ? 'other-session' : 's1', toolCall: { title: 'Read a skill and call an editor tool' }, options } });
      break;
    }
  }
});
