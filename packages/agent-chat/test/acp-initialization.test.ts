import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AcpHarness, acpFailureMessage } from '../src/host/acp';
import type { HarnessSession } from '../src/host/harness';
import type { ChatEvent } from '../src/protocol';
const roots: string[] = [], sessions: HarnessSession[] = [];
const env = { env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? 'C:\\Windows' }, extraDirs: [] };
async function setup(mode: string) {
  const root = await mkdtemp(join(tmpdir(), 'syka-acp-init-')); roots.push(root);
  const harness = new AcpHarness({ id: 'cursor', command: process.execPath, args: [fileURLToPath(new URL('./fixtures/acp-agent.mjs', import.meta.url)), mode, 'cursor'], profileDir: root });
  return { harness, root };
}
afterEach(async () => {
  for (const session of sessions.splice(0)) await session.close();
  for (const root of roots.splice(0)) { if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !root.includes('syka-acp-init-')) throw Error('Invalid cleanup'); await rm(root, { recursive: true, force: true }); }
});
describe('ACP v1 optional implementation metadata', () => {
  it('reports known error categories without echoing diagnostics or inferring quota from 429',()=>{
    expect(acpFailureMessage(Error('INVALID_ARGUMENT private-secret'))).toContain('esquema');
    expect(acpFailureMessage(Error('HTTP 429 private-secret'))).toContain('no informó si se agotó');
    expect(acpFailureMessage(Error('Individual quota reached private-secret'))).toContain('se agotó la cuota');
    expect(acpFailureMessage(Error('ECONNRESET connection closed private-secret'))).toContain('conexión');
    expect(acpFailureMessage(Error('unrecognized private-secret'))).not.toContain('private-secret');
  });
  it('resends initial instructions after a failed first prompt instead of marking them retained',async()=>{
    const {harness,root}=await setup('echo-prompt-fail-once');
    const session=await harness.open({cwd:root,model:'model-one',mcp:null,env,emit:()=>{},instructions:'Required project rules'});sessions.push(session);
    expect((await session.send('first','model-one',()=>{})).status).toBe('failed');
    expect('acp' in session.resume&&session.resume.acp.instructionsHash).toBeUndefined();
    const events:ChatEvent[]=[];
    expect((await session.send('retry','model-one',event=>events.push(event))).status).toBe('completed');
    expect(events.filter(event=>event.type==='item.delta').map(event=>event.text).join('')).toBe('Required project rules\n\nUser request:\nretry');
    expect('acp' in session.resume&&session.resume.acp.instructionsHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('retains instructions across reopen and sends updated rules exactly once',async()=>{
    const {harness,root}=await setup('echo-prompt');
    const options={cwd:root,model:'model-one',mcp:null,env,emit:()=>{},instructions:'Stable editing rules'};
    let session=await harness.open(options);sessions.push(session);
    const send=async(text:string)=>{const events:ChatEvent[]=[];expect((await session.send(text,'model-one',event=>events.push(event))).status).toBe('completed');return events.filter(event=>event.type==='item.delta').map(event=>event.text).join('');};
    expect(await send('first')).toBe('Stable editing rules\n\nUser request:\nfirst');
    expect(await send('second')).toBe('second');
    await session.close();session=await harness.open({...options,resume:session.resume});sessions.push(session);
    expect(await send('resumed')).toBe('resumed');
    await session.close();session=await harness.open({...options,instructions:'Updated editing rules',resume:session.resume});sessions.push(session);
    expect(await send('update')).toBe('Updated editing rules\n\nUser request:\nupdate');
    expect(await send('continue')).toBe('continue');
  });
  it('does not forward private thought chunks into the chat or durable event stream', async () => {
    const { harness, root } = await setup('private-thought');
    const events: ChatEvent[] = [];
    const session = await harness.open({ cwd: root, model: 'model-one', mcp: null, env, emit: event => events.push(event) }); sessions.push(session);
    expect((await session.send('fixture', 'model-one', event => events.push(event))).status).toBe('completed');
    expect(JSON.stringify(events)).not.toContain('PRIVATE_REASONING_IN_ENGLISH');
    expect(JSON.stringify(events)).toContain('hello world');
    expect(events.filter(e => e.type === 'item.started' && e.item.kind === 'reasoning')).toHaveLength(1);
  });
  it('loads the catalog and opens a session when Cursor omits agentInfo', async () => {
    const { harness, root } = await setup('no-agent-info');
    expect(await harness.probe(env, new AbortController().signal)).toMatchObject({ status: 'ready', defaultModel: 'model-one', models: [{ id: 'model-one' }, { id: 'future-model' }] });
    const session = await harness.open({ cwd: root, model: 'model-one', mcp: null, env, emit: () => {} }); sessions.push(session);
    expect((await session.send('fixture', 'model-one', () => {})).status).toBe('completed');
  });
  it.each(['wrong-binary', 'malformed-agent-info', 'v2'])('rejects %s without declaring a missing login', async mode => {
    const { harness } = await setup(mode);
    expect(await harness.probe(env, new AbortController().signal)).toMatchObject({ status: 'error', models: [] });
  });
});
