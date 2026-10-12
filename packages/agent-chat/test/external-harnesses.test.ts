import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { AcpHarness, acpEnvironment } from "../src/host/acp";
import { ClaudeCliHarness } from "../src/host/claude-cli";
import { loadExternalHarnesses, validateExecutable, readHarnessSettings, saveHarnessSettings } from "../src/host/external-harnesses";
import { startEditorToolBridge } from "../src/host/editor-tool-bridge";
import { advanceProfileScope } from "../src/host/harness-profile";
import { acpMcpServers } from "../src/host/acp-mcp";
import { spawn } from "node:child_process";
import { JsonRpcPeer } from "../src/host/jsonrpc";
import { killTree } from "../src/host/env";
import { AgentHost } from "../src/host/host";
import { ChatStore } from "../src/host/store";
import type { Harness } from "../src/host/harness";
import type { ChatEvent, RequestResponse } from "../src/protocol";
import type { HarnessSession, OpenOptions } from "../src/host/harness";

const roots: string[] = [];
const sessions: HarnessSession[] = [];
const env = { env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? 'C:\\Windows', OPENAI_API_KEY: 'test-secret-must-not-leak' }, extraDirs: [] };
const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}.mjs`, import.meta.url));
async function setup() { const root = await mkdtemp(join(tmpdir(), 'syka-harness-test-')); roots.push(root); return root; }
const acp = (root: string, mode = '') => new AcpHarness({ id: 'antigravity', command: process.execPath, args: [fixture('acp-agent'), mode], profileDir: root });
const claude = (root: string, mode = '') => new ClaudeCliHarness({ id: 'claude', command: process.execPath, args: [fixture('claude-cli'), mode], profileDir: root });
const opts = (root: string, emit = (_: ChatEvent) => {}): OpenOptions => ({ cwd: root, model: 'model-one', mcp: null, env, emit });
afterEach(async () => {
  for (const session of sessions.splice(0)) await session.close();
  for (const root of roots.splice(0)) { if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !root.includes('syka-harness-test-')) throw Error('Invalid cleanup'); await rm(root, { recursive: true, force: true }); }
});

describe('isolated external harness paths and environment', () => {
  it.each(['usage', 'legacy-usage'])('reports native ACP prompt metrics in %s mode', async mode => {
    const root = await setup(), events: ChatEvent[] = [];
    const session = await acp(root, mode).open(opts(root)); sessions.push(session);
    await session.send('fixture', 'model-one', event => events.push(event));
    const reports = events.filter(event => event.type === 'usage.reported');
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ usage: { kind: 'turn', sessionId: 's1', tokens: { totalTokens: 100, inputTokens: 80, outputTokens: 20 } } });
  });
  it('inserts Hermes guidance through /steer without showing its acknowledgement as an answer', async () => {
    const root = await setup(), events: ChatEvent[] = [];
    const harness = new AcpHarness({ id: 'hermes', command: process.execPath, args: [fixture('acp-agent'), 'hermes'], profileDir: root });
    const session = await harness.open(opts(root)); sessions.push(session);
    const turn = session.send('hang', 'model-one', event => events.push(event));
    await new Promise(resolve => setTimeout(resolve, 50));
    await expect(session.steer!('Use the original logo')).resolves.toBeUndefined();
    expect(events.some(event => event.type === 'item.delta' && event.text.includes('Steer queued'))).toBe(false);
    await session.interrupt(); await expect(turn).resolves.toEqual({ status: 'interrupted' });
  });
  it('retires Muse while preserving readable historical configuration', async () => {
    const root = await setup(), path = join(root, 'harnesses.json');
    await writeFile(path, JSON.stringify([{ id: 'muse', command: process.execPath, args: [fixture('acp-agent')] }]));
    expect((await loadExternalHarnesses(path, root)).some(h => h.id === 'muse')).toBe(false);
    expect((await readHarnessSettings(path, root)).entries[0]?.id).toBe('muse');
    await expect(saveHarnessSettings(path, root, { id: 'muse', command: process.execPath })).rejects.toThrow('retirado');
  });
  it('requires absolute executable and JS paths without falling back to PATH', async () => {
    await expect(validateExecutable({ id: 'antigravity', command: 'agy' })).rejects.toThrow('absoluta');
    await expect(validateExecutable({ id: 'antigravity', command: process.execPath, args: ['relative.js'] })).rejects.toThrow('absoluta');
    await expect(validateExecutable({ id: 'antigravity', command: process.execPath })).resolves.toBeTruthy();
  });
  it('isolates home and strips inherited provider secrets and routing', async () => {
    const root = await setup(); const value = acpEnvironment(root, { ...env.env, ANTHROPIC_BASE_URL: 'https://example.invalid', HERMES_HOME: '/personal' });
    expect(value.OPENAI_API_KEY).toBeUndefined(); expect(value.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(value.HOME).toBe(root); expect(value.HERMES_HOME).toBe(join(root, 'hermes')); expect(value.HERMES_ACP_SKIP_CONFIGURED_MCP).toBe('1');
  });
  it('loads only explicitly configured routes and handles bad paths without losing Codex', async () => {
    const root = await setup(); const path = join(root, 'harnesses.json');
    await writeFile(path, JSON.stringify([{ id: 'antigravity', command: 'bad-path' }]));
    const loaded = await loadExternalHarnesses(path, root);
    expect((await loaded[0]!.probe(env, new AbortController().signal)).status).toBe('not-installed');
    await writeFile(path, JSON.stringify([{ id: 'antigravity', command: process.execPath, token: 'invalid-field' }]));
    expect(await loadExternalHarnesses(path, root)).toHaveLength(6);
  });
  it('persists explicit paths without losing other providers and preserves invalid configuration', async () => {
    const root = await setup(), path = join(root, 'harnesses.json');
    await saveHarnessSettings(path, root, { id: 'claude', command: process.execPath });
    await saveHarnessSettings(path, root, { id: 'antigravity', command: process.execPath, args: [fixture('acp-agent')] });
    expect((await readHarnessSettings(path, root)).entries.map(e => e.id)).toEqual(['claude', 'antigravity']);
    await expect(saveHarnessSettings(path, root, { id: 'claude', command: 'relative.exe' })).rejects.toThrow('absoluta');
    expect((await readHarnessSettings(path, root)).entries).toHaveLength(2);
    await writeFile(path, '{invalid');
    await expect(saveHarnessSettings(path, root, { id: 'claude', command: process.execPath })).rejects.toThrow();
  });
});

describe('ACP real subprocess with fake provider', () => {
  it('discovers models including unknown future names without logging in', async () => {
    const root = await setup(); const result = await acp(root).probe(env, new AbortController().signal);
    expect(result.status).toBe('ready'); expect(result.models.map(m => m.id)).toContain('future-model');
    expect((await acp(root, 'signed-out').probe(env, new AbortController().signal)).status).toBe('signed-out');
    expect((await acp(root, 'v2').probe(env, new AbortController().signal)).status).toBe('error');
    expect((await acp(root, 'wrong-binary').probe(env, new AbortController().signal)).status).toBe('error');
  });
  it('streams and resumes in the same profile while rejecting another profile', async () => {
    const root = await setup(); const events: ChatEvent[] = [];
    const session = await acp(root).open(opts(root)); sessions.push(session);
    expect((await session.send('text', 'model-one', e => events.push(e))).status).toBe('completed');
    expect(events.filter(e => e.type === 'item.delta').map(e => e.text).join('')).toBe('hello world');
    await session.close(); const resumed = await acp(root).open({ ...opts(root), resume: session.resume }); sessions.push(resumed);
    expect((await resumed.send('text', 'model-one', () => {})).status).toBe('completed');
    await expect(acp(await setup()).open({ ...opts(root), resume: session.resume })).rejects.toThrow('perfil');
    await expect(acp(root, 'no-resume').open({ ...opts(root), resume: session.resume })).rejects.toThrow('retoma');
    await advanceProfileScope(root);
    await expect(acp(root).open({ ...opts(root), resume: session.resume })).rejects.toThrow('perfil');
  });
  it('forwards a permission choice exactly and cancels it safely', async () => {
    const root = await setup(); const session = await acp(root).open(opts(root)); sessions.push(session);
    let answer = '';
    await session.send('permission', 'model-one', event => {
      if (event.type === 'request.opened') session.respond(event.request.id, { answers: { permission: ['reject_once'] } });
      if (event.type === 'item.delta') answer += event.text;
    });
    expect(answer).toContain('reject_once');
    const pending = session.send('permission', 'model-one', event => { if (event.type === 'request.opened') void session.interrupt(); });
    expect((await pending).status).toBe('interrupted');
  });
  it('uses stdio MCP when HTTP is not advertised and rejects unknown models', async () => {
    const root = await setup(); const stdio = await acp(root, 'no-http').open(opts(root)); sessions.push(stdio);
    expect((await stdio.send('text', 'model-one', () => {})).status).toBe('completed');
    const session = await acp(root).open(opts(root)); sessions.push(session);
    expect((await session.send('text', 'unlisted', () => {})).status).toBe('failed');
    expect((await session.send('text', 'model-one', () => {}, 'high')).status).toBe('failed');
  });
  it('terminates an uncooperative agent on cancellation', async () => {
    const root = await setup(); const session = await acp(root, 'ignore-cancel').open(opts(root)); sessions.push(session);
    const turn = session.send('hang', 'model-one', () => {});
    await new Promise(r => setTimeout(r, 100)); await session.interrupt();
    expect((await turn).status).toBe('interrupted');
    expect(session.isClosed).toBe(true);
  }, 10_000);
});

describe('native Claude CLI subprocess with fake provider', () => {
  it('detects a binary posing as Claude and reports signed-out status', async () => {
    const root = await setup();
    expect((await claude(root, 'wrong-binary').probe(env, new AbortController().signal)).status).toBe('error');
    expect((await claude(root, 'signed-out').probe(env, new AbortController().signal)).status).toBe('signed-out');
    expect((await claude(root).probe(env, new AbortController().signal)).status).toBe('ready');
  });
  it('runs, resumes and surfaces CLI errors without SDK or fallback', async () => {
    const root = await setup(); const session = await claude(root).open(opts(root)); sessions.push(session);
    const replies: string[] = []; const emit = (e: ChatEvent) => { if (e.type === 'item.completed' && e.item.kind === 'assistant') replies.push(e.item.text); };
    expect((await session.send('hi', '__cli_default__', emit)).status).toBe('completed');
    expect((await session.send('hi', '__cli_default__', emit)).status).toBe('completed');
    expect(replies).toEqual(['hello', 'resumed']);
    expect((await session.send('fail', '__cli_default__', emit)).status).toBe('failed');
  });
  it('routes native MCP permission requests through the existing question UI', async () => {
    const root = await setup(); const session = await claude(root).open(opts(root)); sessions.push(session);
    let result = '';
    await session.send('permission', '__cli_default__', event => {
      if (event.type === 'request.opened') session.respond(event.request.id, { answers: { permission: ['Permitir una vez'] } });
      if (event.type === 'item.completed' && event.item.kind === 'assistant') result = event.item.text;
    });
    expect(JSON.parse(result).behavior).toBe('allow');
  });
  it('returns native question answers without replacing them with an approval', async () => {
    const root = await setup(); const session = await claude(root).open(opts(root)); sessions.push(session);
    let result = '';
    await session.send('question', '__cli_default__', event => {
      if (event.type === 'request.opened') session.respond(event.request.id, { answers: { 'Formato?': ['Vertical', 'Horizontal'] } });
      if (event.type === 'item.completed' && event.item.kind === 'assistant') result = event.item.text;
    });
    expect(JSON.parse(result).updatedInput.answers).toEqual({ 'Formato?': 'Vertical, Horizontal' });
  });
});

describe('shared editor MCP bridge', () => {
  it('rejects a hosted editor MCP endpoint', async () => {
    const root = await setup();
    await expect(startEditorToolBridge({ ...opts(root), mcp: { name: 'syka', url: 'https://example.invalid/mcp' } })).rejects.toThrow('local');
  });
  it('proxies real stdio MCP requests to the isolated HTTP bridge', async () => {
    const root = await setup(); const bridge = await startEditorToolBridge(opts(root));
    const servers = await acpMcpServers([{ name: 'syka_workspace', url: bridge.url }], false, root) as { command: string; args: string[]; env: { name: string; value: string }[] }[];
    const config = servers[0]!;
    const child = spawn(config.command, config.args, { env: { ...process.env, ...Object.fromEntries(config.env.map(e => [e.name, e.value])) }, stdio: 'pipe', windowsHide: true });
    const peer = new JsonRpcPeer(child);
    try { const result = await peer.request<{ tools: unknown[] }>('tools/list', {}); expect(result.tools.length).toBeGreaterThan(3); }
    finally { await killTree(child); await bridge.close(); }
  });
  it('exposes native tools on an isolated authenticated route', async () => {
    const root = await setup(); const bridge = await startEditorToolBridge(opts(root));
    const call = async (method: string, params = {}) => (await fetch(bridge.url, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json();
    try {
      expect((await fetch(bridge.url + 'wrong', { method: 'POST' })).status).toBe(403);
      expect((await call('tools/list')).result.tools.some((t: { name: string }) => t.name === 'syka_edit_source')).toBe(true);
      expect((await call('tools/call', { name: 'syka_files', arguments: { action: 'create', path: 'sample.txt', content: 'sample' } })).result.isError).toBeUndefined();
      expect((await call('tools/call', { name: 'syka_files', arguments: { action: 'create', path: '../escape.txt', content: 'sample' } })).result.isError).toBe(true);
    } finally { await bridge.close(); }
  });
  it('exposes the same contextual question channel to external agents through MCP',async()=>{
    const root=await setup();let release!: (value:RequestResponse)=>void;
    const askUser=vi.fn(()=>new Promise<RequestResponse>(resolve=>{release=resolve;}));
    const bridge=await startEditorToolBridge({...opts(root),askUser});
    const call=async(method:string,params={})=>(await fetch(bridge.url,{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})})).json();
    try{
      expect((await call('tools/list')).result.tools.some((tool:{name:string})=>tool.name==='syka_ask_user')).toBe(true);
      let completed=false;
      const waiting=call('tools/call',{name:'syka_ask_user',arguments:{questions:[{id:'voice',question:'¿Conservo tu voz original?'}]}}).then(value=>{completed=true;return value;});
      await vi.waitFor(()=>expect(askUser).toHaveBeenCalledOnce());
      expect(completed).toBe(false);
      release({answers:{voice:['Sí, limpieza suave.']}});
      const result=await waiting;
      expect(JSON.parse(result.result.content[0].text)).toEqual({status:'answered',answers:{voice:['Sí, limpieza suave.']}});
    }finally{await bridge.close();}
  });
});

describe('host login lifecycle', () => {
  it('serializes configuration changes and blocks turns until the new route is installed', async () => {
    const root = await setup(); let release!: () => void; let saving = false;
    const harness = acp(root), settings = { configFile: join(root, 'harnesses.json'), profilesRoot: root, entries: [] };
    const host = new AgentHost({ store: new ChatStore(root), harnesses: [harness], env: Promise.resolve(env), mcp: null, version: 'test', providerSettings: {
      read: async () => settings,
      save: async () => { saving = true; await new Promise<void>(r => { release = r; }); return { settings, harness }; },
    } });
    const connection = { send() {} }, entry = { id: 'antigravity' as const, command: process.execPath };
    try {
      await host.start(); const pending = host.handle(connection, 'harnesses.configure', entry);
      await expect.poll(() => saving).toBe(true);
      await expect(host.handle(connection, 'harnesses.configure', entry)).rejects.toMatchObject({ code: 'busy' });
      await expect(host.handle(connection, 'turn.send', { projectId: 'test', cwd: root, text: 'test', model: { harness: 'antigravity', model: 'model-one' } })).rejects.toMatchObject({ code: 'busy' });
      release(); await pending;
      expect((await host.handle(connection, 'harnesses.list', { refresh: true })).find(h => h.id === 'antigravity')?.status).toBe('ready');
    } finally { release?.(); await host.stop(); }
  });
  it('reopens a dead transport using the same provider cursor', async () => {
    const root = await setup(); let opened = 0; let resumed: unknown;
    const cursor = { acp: { version: 1 as const, harness: 'antigravity' as const, sessionId: 'saved', profile: 'same-profile' } };
    const harness: Harness = {
      id: 'antigravity',
      async probe() { return { id: 'antigravity', label: 'Antigravity', status: 'ready', models: [{ id: 'test', label: 'Test' }] }; },
      async open(options) { opened++; resumed = options.resume; let closed = false; return { resume: cursor, get isClosed() { return closed; },
        async send() { closed = true; return { status: 'completed' as const }; }, respond() {}, async interrupt() {}, async close() {} }; },
    };
    const host = new AgentHost({ store: new ChatStore(root), harnesses: [harness], env: Promise.resolve(env), mcp: null, version: 'test' });
    const connection = { send() {} }; const model = { harness: 'antigravity' as const, model: 'test' };
    try {
      await host.start(); await host.handle(connection, 'harnesses.list', { refresh: true });
      const chat = await host.handle(connection, 'chats.create', { projectId: 'test', cwd: root, model });
      for (let i = 0; i < 2; i++) {
        await host.handle(connection, 'turn.send', { chatId: chat.id, projectId: 'test', cwd: root, model, text: 'hello' });
        await expect.poll(() => host.handle(connection, 'chats.list', { projectId: 'test' })).toMatchObject([{ status: 'idle' }]);
      }
      expect(opened).toBe(2); expect(resumed).toEqual(cursor);
    } finally { await host.stop(); }
  });
  it('starts login only on an explicit method, rejects duplicates and stops it on shutdown', async () => {
    const root = await setup(); let calls = 0; let aborted = false;
    const harness: Harness = {
      id: 'antigravity',
      async probe() { return { id: 'antigravity', label: 'Antigravity', status: 'signed-out', models: [], authMethods: [{ id: 'login', label: 'Login' }] }; },
      async open() { throw Error('not part of login test'); },
      async authenticate(_env, _id, signal) { calls++; await new Promise<void>((_, reject) => { signal.addEventListener('abort', () => { aborted = true; reject(Error('aborted')); }, { once: true }); }); },
    };
    const host = new AgentHost({ store: new ChatStore(root), harnesses: [harness], env: Promise.resolve(env), mcp: null, version: 'test' });
    const connection = { send() {} };
    try {
      await host.start(); await host.handle(connection, 'harnesses.list', { refresh: true }); expect(calls).toBe(0);
      await expect(host.handle(connection, 'harnesses.authenticate', { harness: 'antigravity', methodId: 'other' })).rejects.toThrow('anunciado');
      await host.handle(connection, 'harnesses.authenticate', { harness: 'antigravity', methodId: 'login' });
      await expect.poll(() => calls).toBe(1);
      await expect(host.handle(connection, 'harnesses.authenticate', { harness: 'antigravity', methodId: 'login' })).rejects.toMatchObject({ code: 'busy' });
      await host.stop(); expect(aborted).toBe(true);
    } finally { await host.stop(); }
  });
});
