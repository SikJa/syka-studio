import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClaudeUsageTracker, claudeTokens, claudeCumulativeUsage } from '../src/host/claude-usage';
import { ClaudeCliHarness } from '../src/host/claude-cli';
import { AcpHarness } from '../src/host/acp';
import { ProjectUsageStore } from '../src/host/project-usage';
import type { HarnessSession } from '../src/host/harness';
import type { ChatEvent, ContextUsage, TokenUsageReport } from '../src/protocol';

const roots: string[] = [], sessions: HarnessSession[] = [];
const env = { env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? 'C:\\Windows' }, extraDirs: [] };
const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}.mjs`, import.meta.url));
async function setup() { const root = await mkdtemp(join(tmpdir(), 'syka-usage-providers-')); roots.push(root); return root; }
afterEach(async () => {
  for (const session of sessions.splice(0)) await session.close();
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !root.includes('syka-usage-providers-')) throw Error('Invalid cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
const step = (id = 'api-1', model = 'opus') => ({ type: 'assistant', message: { id, model, usage: { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 30, cache_creation_input_tokens: 5 } } });
const final = (multiplier = 1, session_id = 'native-session') => ({ type: 'result', session_id, modelUsage: {
  opus: { inputTokens: 10 * multiplier, outputTokens: 20 * multiplier, cacheReadInputTokens: 30 * multiplier, cacheCreationInputTokens: 5 * multiplier },
  haiku: { inputTokens: 4 * multiplier, outputTokens: 6 * multiplier },
}, usage: { input_tokens: 10, output_tokens: 20 } });

describe('Claude native usage contract', () => {
  it('counts disjoint cache input once and rejects malformed numbers', () => {
    expect(claudeTokens(step().message.usage)).toEqual({ totalTokens: 46, inputTokens: 45, outputTokens: 1, cachedInputTokens: 30, cacheWriteInputTokens: 5 });
    for (const n of [-1, NaN, Infinity, 0.5]) expect(claudeTokens({ input_tokens: n, output_tokens: 5 })).toBeNull();
    expect(claudeTokens({ input_tokens: 1, output_tokens: 2, cache_read_input_tokens: -1 })).toBeNull();
    expect(claudeTokens({ input_tokens: Number.MAX_SAFE_INTEGER, output_tokens: 1 })).toBeNull();
  });
  it('uses the documented resume semantics of the native CLI version', () => {
    expect(claudeCumulativeUsage('2.1.276 (Claude Code)')).toBe(false);
    expect(claudeCumulativeUsage('2.1.277 (Claude Code)')).toBe(true);
    expect(claudeCumulativeUsage('2.2.0 (Claude Code)')).toBe(true);
    expect(() => claudeCumulativeUsage('1.3.14')).toThrow();
  });
  it('reconciles models and subagents across restarts without summing the main-loop result again', async () => {
    const root = await setup(); let ledger = new ProjectUsageStore(root);
    const reports: TokenUsageReport[] = [];
    const run = (multiplier: number) => { const tracker = new ClaudeUsageTracker('native-session', true, report => reports.push(report)); tracker.observe(step()); tracker.observe(step()); tracker.observe(final(multiplier)); tracker.finish(); };
    run(1);
    for (const report of reports.splice(0)) await ledger.record('p', 'claude', '__cli_default__', report);
    ledger = new ProjectUsageStore(root);
    run(2); run(2);
    for (const report of reports) await ledger.record('p', 'claude', '__cli_default__', report);
    const [usage] = await ledger.list(['p']);
    expect(usage.tokens.totalTokens).toBe(150);
    expect(usage.models.map(m => [m.model, m.tokens.totalTokens])).toEqual([['opus', 130], ['haiku', 20]]);
  });
  it('recovers deduplicated main-loop input after a crash and reconciles the later session total', async () => {
    const root = await setup(), ledger = new ProjectUsageStore(root), reports: TokenUsageReport[] = [];
    const tracker = new ClaudeUsageTracker('native-session', true, r => reports.push(r));
    tracker.observe(step()); tracker.observe(step());
    tracker.observe({ ...step('child', 'haiku'), parent_tool_use_id: 'task', session_id: 'child-session' });
    tracker.observe({ type: 'result', session_id: 'native-session', is_error: true, subtype: 'error_during_execution', modelUsage: {}, usage: { input_tokens: 0, output_tokens: 0 } });
    tracker.finish(); tracker.finish();
    expect(reports).toHaveLength(1);
    expect(reports[0].tokens).toMatchObject({ totalTokens: 45, inputTokens: 45 });
    expect(reports[0].tokens).not.toHaveProperty('outputTokens');
    for (const r of reports.splice(0)) await ledger.record('p', 'claude', 'default', r);
    const resumed = new ClaudeUsageTracker('native-session', true, r => reports.push(r)); resumed.observe(final()); resumed.finish();
    for (const r of reports) await ledger.record('p', 'claude', 'default', r);
    expect((await ledger.list(['p']))[0].tokens.totalTokens).toBe(75);
  });
  it('keeps failed results, native zero and reset sessions separate from missing metrics', () => {
    const reports: TokenUsageReport[] = [], tracker = new ClaudeUsageTracker('native-session', true, r => reports.push(r));
    tracker.observe({ ...final(), is_error: true });
    tracker.observe(final(0, 'reset-session')); tracker.finish();
    expect(reports).toHaveLength(4);
    expect(reports[2].sessionId).not.toBe(reports[0].sessionId);
    expect(reports[2].tokens.totalTokens).toBe(0);
    const missing = new ClaudeUsageTracker('x', true, r => reports.push(r)); missing.observe({ type: 'result' }); missing.finish();
    expect(reports).toHaveLength(4);
  });
  it('reconciles a known-model legacy result.usage with later cumulative modelUsage', async () => {
    const root = await setup(), ledger = new ProjectUsageStore(root), reports: TokenUsageReport[] = [];
    const tracker = new ClaudeUsageTracker('native-session', true, r => reports.push(r)); tracker.observe(step());
    tracker.observe({ type: 'result', usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 5 } }); tracker.finish();
    const resumed = new ClaudeUsageTracker('native-session', true, r => reports.push(r)); resumed.observe(final()); resumed.finish();
    for (const r of reports) await ledger.record('p', 'claude', 'default', r);
    expect((await ledger.list(['p']))[0].tokens.totalTokens).toBe(75);
  });
  it('keeps explicit zero usage while avoiding an ambiguous mixed-model aggregate', () => {
    const zero: TokenUsageReport[] = [], zeroTracker = new ClaudeUsageTracker('s', true, r => zero.push(r));
    zeroTracker.observe({ type: 'result', usage: { input_tokens: 0, output_tokens: 0 } }); zeroTracker.finish();
    expect(zero).toHaveLength(1); expect(zero[0].tokens.totalTokens).toBe(0);
    const mixed: TokenUsageReport[] = [], mixedTracker = new ClaudeUsageTracker('s', true, r => mixed.push(r));
    mixedTracker.observe(step('a', 'opus')); mixedTracker.observe(step('b', 'haiku'));
    mixedTracker.observe({ type: 'result', usage: { input_tokens: 100, output_tokens: 200 } }); mixedTracker.finish();
    expect(mixed.map(r => r.tokens.totalTokens)).toEqual([45, 45]);
    expect(mixed.every(r => r.tokens.outputTokens === undefined)).toBe(true);
  });
});

describe('provider subprocess to persistent ledger', () => {
  it('publishes current Claude context separately from cumulative billing, including after resume',async()=>{
    const root=await setup(),events:ChatEvent[]=[];
    const harness=new ClaudeCliHarness({id:'claude',command:process.execPath,args:[fixture('claude-cli'),'usage'],profileDir:root});
    const options={cwd:root,model:'__cli_default__',mcp:null,env,emit:(event:ChatEvent)=>events.push(event)};
    const first=await harness.open(options);sessions.push(first);
    await first.send('first','__cli_default__',options.emit);await first.close();
    const resumed=await harness.open({...options,resume:first.resume});sessions.push(resumed);
    await resumed.send('second','__cli_default__',options.emit);
    expect(events.filter(e=>e.type==='context.updated').map(e=>e.usage)).toEqual([{usedTokens:45,maxTokens:1000},{usedTokens:45,maxTokens:1000}]);
    expect(events.some(e=>e.type==='usage.reported'&&e.usage.tokens.totalTokens===130)).toBe(true);
  });
  it.each(['usage', 'old-usage'])('counts two Claude CLI calls with %s semantics and resumes the native session', async mode => {
    const root = await setup(), ledger = new ProjectUsageStore(root), pending: Promise<unknown>[] = [];
    const harness = new ClaudeCliHarness({ id: 'claude', command: process.execPath, args: [fixture('claude-cli'), mode], profileDir: root });
    const emit = (event: ChatEvent) => { if (event.type === 'usage.reported') pending.push(ledger.record('p', 'claude', '__cli_default__', event.usage)); };
    const options = { cwd: root, model: '__cli_default__', mcp: null, env, emit };
    const session = await harness.open(options); sessions.push(session);
    expect((await session.send('first', '__cli_default__', emit)).status).toBe('completed'); await session.close();
    const resumed = await harness.open({ ...options, resume: session.resume }); sessions.push(resumed);
    expect((await resumed.send('fail', '__cli_default__', emit)).status).toBe('failed');
    await Promise.all(pending);
    expect((await ledger.list(['p']))[0].tokens.totalTokens).toBe(150);
  });
  it.each(['hermes', 'cursor', 'grok', 'opencode'] as const)('connects %s native ACP consumption, ignoring context occupancy and cost', async id => {
    const root = await setup(), ledger = new ProjectUsageStore(root), pending: Promise<unknown>[] = [];
    const harness = new AcpHarness({ id, command: process.execPath, args: [fixture('acp-agent'), 'usage', id], profileDir: root, openCodeAccount: 'syka' });
    const emit = (event: ChatEvent) => { if (event.type === 'usage.reported') pending.push(ledger.record('p', id, 'model-one', event.usage)); };
    const session = await harness.open({ cwd: root, model: 'model-one', mcp: null, env, emit }); sessions.push(session);
    await session.send('first', 'model-one', emit); await session.send('second', 'model-one', emit); await Promise.all(pending);
    const [usage] = await ledger.list(['p']); expect(usage.tokens.totalTokens).toBe(200); expect(usage.models[0].harness).toBe(id);
  });
  it('leaves missing ACP consumption unknown when only usage_update occupancy is available', async () => {
    const root = await setup(), events: ChatEvent[] = [];
    const harness = new AcpHarness({ id: 'hermes', command: process.execPath, args: [fixture('acp-agent'), 'context-only', 'hermes'], profileDir: root });
    const session = await harness.open({ cwd: root, model: 'model-one', mcp: null, env, emit: e => events.push(e) }); sessions.push(session);
    await session.send('hello', 'model-one', e => events.push(e)); expect(events.some(e => e.type === 'usage.reported')).toBe(false);
  });
});

describe('Claude current context occupancy',()=>{
  it('uses latest main request input and cache, never session totals or subagent usage',()=>{
    const windows=new Map<string,number>(),contexts:ContextUsage[]=[];
    const tracker=new ClaudeUsageTracker('s',true,()=>{}, {windows,scope:'profile/opus',emit:c=>contexts.push(c)});
    tracker.observe(step());
    tracker.observe({...step('child','haiku'),parent_tool_use_id:'task'});
    tracker.observe({type:'result',modelUsage:{opus:{inputTokens:999999,outputTokens:100,contextWindow:1000},haiku:{inputTokens:100000,outputTokens:900,contextWindow:200}}});
    expect(contexts).toEqual([{usedTokens:45,maxTokens:1000}]);
    tracker.observe({...step('next'),message:{...step().message,usage:{input_tokens:3,cache_read_input_tokens:9,output_tokens:900}}});
    expect(contexts.at(-1)).toEqual({usedTokens:12,maxTokens:1000});
  });
  it('keeps missing capacity unknown and accepts only the primary model native window',()=>{
    const contexts:ContextUsage[]=[],tracker=new ClaudeUsageTracker('s',true,()=>{}, {windows:new Map(),emit:c=>contexts.push(c)});
    tracker.observe(step());
    tracker.observe({type:'result',modelUsage:{haiku:{inputTokens:1,outputTokens:1,contextWindow:200}}});
    for(const value of [0,-1,1.5,NaN,Infinity,'1000'])tracker.observe({type:'result',modelUsage:{opus:{contextWindow:value}}});
    expect(contexts).toEqual([]);
    tracker.observe({type:'result',modelUsage:{'opus-alias':{canonicalModel:'opus',contextWindow:1000}}});
    expect(contexts).toEqual([{usedTokens:45,maxTokens:1000}]);
  });
  it('isolates model/profile windows and publishes a lower measured context after compaction',()=>{
    const windows=new Map<string,number>(),contexts:ContextUsage[]=[];
    const first=new ClaudeUsageTracker('a',true,()=>{},{windows,scope:'profile-a',emit:c=>contexts.push(c)});
    first.observe(step());first.observe({type:'result',modelUsage:{opus:{contextWindow:1000}}});
    const second=new ClaudeUsageTracker('b',true,()=>{},{windows,scope:'profile-b',emit:c=>contexts.push(c)});
    second.observe(step());expect(contexts).toHaveLength(1);
    second.observe({type:'result',modelUsage:{opus:{contextWindow:2000}}});
    second.observe({type:'system',subtype:'compact_boundary'});
    second.observe({type:'result',modelUsage:{opus:{contextWindow:2000}}});expect(contexts).toHaveLength(2);
    second.observe({type:'assistant',message:{id:'post-compact',model:'opus',usage:{input_tokens:0,cache_read_input_tokens:4,output_tokens:1}}});
    expect(contexts.at(-1)).toEqual({usedTokens:4,maxTokens:2000});
  });
});
