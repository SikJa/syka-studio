import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AcpHarness } from '../src/host/acp';
import { acpModels, hermesModelLabel } from '../src/host/acp-models';
import { hermesAcpLaunch } from '../src/host/hermes-acp-bridge';
import type { HarnessSession, OpenOptions } from '../src/host/harness';
import type { ChatEvent } from '../src/protocol';

const roots: string[] = [], sessions: HarnessSession[] = [];
const env = { env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? 'C:\\Windows' }, extraDirs: [] };
const first = 'openai-codex:gpt-6.1-sol', second = 'openai-codex:gpt-5.6-sol';
async function setup(mode = '') {
  const root = await mkdtemp(join(tmpdir(), 'syka-model-config-test-')); roots.push(root);
  const harness = new AcpHarness({ id:'hermes', command:process.execPath, args:[fileURLToPath(new URL('./fixtures/acp-model-config.mjs', import.meta.url)),mode], profileDir:root });
  const options: OpenOptions = {cwd:root,model:first,mcp:null,env,emit:()=>{}};
  return {root,harness,options};
}
afterEach(async () => {
  for (const session of sessions.splice(0)) await session.close();
  for (const root of roots.splice(0)) { if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !root.includes('syka-model-config-test-')) throw Error('Invalid cleanup'); await rm(root,{recursive:true,force:true}); }
});

describe('Hermes models and ACP reasoning configuration', () => {
  it('shows the model before its account, retaining the exact model ID', async () => {
    const {harness} = await setup();
    const result = await harness.probe(env, new AbortController().signal);
    expect(result.models).toEqual([
      {id:first,label:'GPT-6.1-Sol',efforts:['low','medium','high'],defaultEffort:'medium'},
      {id:second,label:'GPT-5.6-Sol',efforts:['low','high','max'],defaultEffort:'high'},
    ]);
    expect(result.defaultModel).toBe(first);
    expect(hermesModelLabel('custom:local:model-name','model-name')).toBe('model-name');
    expect(hermesModelLabel(first,'ChatGPT or Codex Subscription')).toBe('GPT-6.1-Sol');
  });
  it('negotiates a supported effort before sending the prompt', async () => {
    const {harness,options} = await setup(), events:ChatEvent[] = [];
    const session = await harness.open(options); sessions.push(session);
    expect((await session.send('fixture',first,event=>events.push(event),'high')).status).toBe('completed');
    expect(events.filter(event=>event.type==='item.delta').map(event=>event.text).join('')).toBe(JSON.stringify({model:first,effort:'high'}));
  });
  it('uses the new model reasoning options after switching models', async () => {
    const {harness,options} = await setup(), events:ChatEvent[] = [];
    const session = await harness.open(options); sessions.push(session);
    expect((await session.send('fixture',second,event=>events.push(event),'max')).status).toBe('completed');
    expect(events.filter(event=>event.type==='item.delta').map(event=>event.text).join('')).toBe(JSON.stringify({model:second,effort:'max'}));
  });
  it('does not send a prompt for an unsupported effort or fast mode', async () => {
    const {harness,options} = await setup(), events:ChatEvent[] = [];
    const session = await harness.open(options); sessions.push(session);
    expect(await session.send('must not run',first,event=>events.push(event),'ultra')).toMatchObject({status:'failed',error:expect.stringContaining('no está anunciado')});
    expect((await session.send('must not run',first,event=>events.push(event),undefined,true)).status).toBe('failed');
    expect(events).toEqual([]);
  });
  it('does not silently continue when an agent ignores the requested effort', async () => {
    const {harness,options} = await setup('no-ack'), events:ChatEvent[] = [];
    const session = await harness.open(options); sessions.push(session);
    expect(await session.send('must not run',first,event=>events.push(event),'high')).toMatchObject({status:'failed',error:expect.stringContaining('no confirmó')});
    expect(events).toEqual([]);
  });
  it('does not assign current-model effort capabilities to another model', () => {
    const result = acpModels({models:{currentModelId:'one',availableModels:[{modelId:'one',name:'One'},{modelId:'two',name:'Two'}]},configOptions:[{id:'thought',category:'thought_level',type:'select',currentValue:'high',options:[{value:'high',name:'High'}]}]},'hermes');
    expect(result[0]?.efforts).toEqual(['high']); expect(result[1]?.efforts).toBeUndefined();
  });
  it('keeps custom ACP executables and arguments untouched', async () => {
    const {root} = await setup();
    expect(await hermesAcpLaunch(process.execPath,[],root)).toBeUndefined();
    expect(await hermesAcpLaunch(join(root,'hermes-acp.exe'),['--custom'],root)).toBeUndefined();
  });
});
