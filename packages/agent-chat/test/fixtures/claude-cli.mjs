const args = process.argv.slice(2);
if (args.includes('--version')) { console.log(args.includes('wrong-binary') ? '1.3.14' : args.includes('old-usage') ? '2.1.276 (Claude Code)' : '2.1.289 (Claude Code)'); process.exit(0); }
if (args.includes('status')) { console.log(JSON.stringify({ loggedIn: !args.includes('signed-out') })); process.exit(0); }
if (args.includes('login')) process.exit(0);
const { createInterface } = await import('node:readline');
const lines = createInterface({ input: process.stdin })[Symbol.asyncIterator]();
// Every exchange is stream-json lines on stdin: the catalog probe's initialize
// request, or a turn's user messages, which keep arriving while stdin stays open.
const first = await lines.next();
const opening = first.done ? null : JSON.parse(first.value);
if (opening?.type === 'control_request') {
  if (opening.request?.subtype === 'initialize') console.log(JSON.stringify({ type: 'control_response', response: { request_id: opening.request_id, response: { models: [] } } }));
  process.exit(0);
}
const textOf = message => message.message.content.map(part => part.text).join('');
const userText = async () => { const next = await lines.next(); return next.done ? null : textOf(JSON.parse(next.value)); };
const input = opening ? textOf(opening) : '';
const send = m => process.stdout.write(JSON.stringify(m) + '\n');
const sessionId = args[args.indexOf(args.includes('--resume') ? '--resume' : '--session-id') + 1];
send({ type: 'system', subtype: 'init', session_id: sessionId });
if (input === 'hang') { setInterval(() => {}, 1000); }
else {
  if (input === 'steer') {
    // Busy until a message is steered in; the same turn then answers both.
    send({ type: 'assistant', message: { content: [{ type: 'text', text: 'working' }] } });
    const steered = await userText();
    send({ type: 'assistant', message: { content: [{ type: 'text', text: `steered: ${steered}` }] } });
  } else if (input === 'permission' || input === 'question') {
    const config = JSON.parse(args[args.indexOf('--mcp-config') + 1]);
    const arguments_ = input === 'question'
      ? { tool_name: 'AskUserQuestion', input: { questions: [{ question: 'Formato?', header: 'Formato', multiSelect: true, options: [{ label: 'Vertical' }, { label: 'Horizontal' }] }] } }
      : { tool_name: 'Write', input: { file_path: 'example.txt' } };
    const response = await fetch(config.mcpServers.syka_workspace.url, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'permission', arguments: arguments_ } }) });
    const data = await response.json();
    send({ type: 'assistant', message: { content: [{ type: 'text', text: data.result.content[0].text }] } });
  } else send({ type: 'assistant', message: { content: [{ type: 'text', text: args.includes('--resume') ? 'resumed' : 'hello' }] } });
  if (args.includes('usage') || args.includes('old-usage')) {
    send({ type: 'assistant', session_id: sessionId, message: { id: 'native-api-response', model: 'claude-opus', content: [], usage: { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 30, cache_creation_input_tokens: 5 } } });
    const multiplier = args.includes('--resume') && !args.includes('old-usage') ? 2 : 1;
    send({ type: 'result', session_id: sessionId, is_error: input === 'fail', modelUsage: {
      'claude-opus': { inputTokens: 10 * multiplier, outputTokens: 20 * multiplier, cacheReadInputTokens: 30 * multiplier, cacheCreationInputTokens: 5 * multiplier, contextWindow:1000 },
      'claude-haiku': { inputTokens: 4 * multiplier, outputTokens: 6 * multiplier, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, contextWindow:200 },
    }, usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 5 } });
  } else send({ type: 'result', is_error: input === 'fail' });
  // Like Claude Code, stay up until the host closes stdin.
  while (!(await lines.next()).done) { /* a late message would start another turn; the host closes first */ }
}
