import { createInterface } from 'node:readline';

const mode = process.argv[2] ?? 'response-first';
const provider = process.argv[3] ?? 'hermes';
const first = 'fixture:model-a', second = 'fixture:model-b';
let model = first, sessionId = 'fixture-session', heldPrompt;
const size = () => model === first ? 128_000 : 256_000;
const update = (used, window = size(), id = sessionId) => ({ method: 'session/update', params: { sessionId: id, update: { sessionUpdate: 'usage_update', used, size: window } } });
// One write deliberately delivers the response and notification in one feed.
const send = (...messages) => process.stdout.write(messages.map(message => JSON.stringify({ jsonrpc: '2.0', ...message })).join('\n') + '\n');
const metadata = () => ({
  models: { currentModelId: model, availableModels: [first, second].map(modelId => ({ modelId, name: modelId })) },
  ...(mode === 'legacy' ? {} : { configOptions: [{ id: 'model', category: 'model', type: 'select', currentValue: model, options: [first, second].map(value => ({ value, name: value })) }] }),
});
createInterface({ input: process.stdin }).on('line', line => {
  const message = JSON.parse(line), params = message.params ?? {};
  const result = data => ({ id: message.id, result: data });
  switch (message.method) {
    case 'initialize':
      send(result({ protocolVersion: 1, agentInfo: { name: `${provider}-acp`, version: 'fixture' }, agentCapabilities: { loadSession: true, mcpCapabilities: { http: true } } })); break;
    case 'session/new':
    case 'session/load': {
      sessionId = params.sessionId ?? sessionId;
      const response = result({ sessionId, ...metadata() });
      if (mode === 'invalid') send(response);
      else if (mode === 'idle') { send(response); setTimeout(() => send(update(1200)), 30); }
      else if (mode === 'notification-first') send(update(99, 999, 'another-session'), update(1200), response);
      else send(response, update(mode === 'zero' ? 0 : 1200));
      break;
    }
    case 'session/set_model':
    case 'session/set_config_option':
      model = params.modelId ?? params.value;
      if (mode === 'silent-switch') send(result(metadata()));
      else send(result(metadata()), update(1400));
      break;
    case 'session/prompt': {
      if (mode === 'hold') { heldPrompt = message.id; break; }
      const response = result({ stopReason: 'end_turn' });
      const assistant = { method: 'session/update', params: { sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Fixture reply' } } } };
      if (mode === 'invalid') {
        const invalid = [update(-1), update(1.5), update('1200'), update(null), update(1200, 0), update(1200, -1), update(1200, 1.5), update(1200, '128000'), update(1200, Number.MAX_SAFE_INTEGER + 1), update(1200, null), update(1200, 128000, 'another-session'), update(1200, 128000, '')];
        send(...invalid, { method: 'session/update', params: { sessionId, update: { sessionUpdate: 'usage_update', totalTokens: 4000, cost: { amount: 42, currency: 'USD' } } } }, assistant, response);
      } else if (mode === 'window-only') send(update(2000), response);
      else if (mode === 'late') { send(assistant, response); setTimeout(() => send(update(2400)), 30); }
      else if (mode === 'silent-switch') send(assistant, response);
      else send(update(2400), assistant, response);
      break;
    }
    case 'session/cancel':
      if (heldPrompt !== undefined) { send({ id: heldPrompt, result: { stopReason: 'cancelled' } }, update(1800)); heldPrompt = undefined; }
      break;
  }
});
