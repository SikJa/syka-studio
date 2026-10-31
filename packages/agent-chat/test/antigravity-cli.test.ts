import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AntigravityCliHarness, parseAgyModels, agyFailureMessage } from '../src/host/antigravity-cli';
import type { ChatEvent } from '../src/protocol';

describe('official Antigravity CLI transport',()=>{
  it('distinguishes a missing login from a failed network check', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'syka-agy-status-'));
    const harness = new AntigravityCliHarness({ command: process.execPath, args: [fileURLToPath(new URL('./fixtures/agy-agent.mjs', import.meta.url))], profileDir: cwd });
    try {
      for (const [failure, expected] of [['auth', 'signed-out'], ['network', 'error']] as const) {
        const env = { env: { ...process.env, SYKA_TEST_AGY_FAILURE: failure } as Record<string, string>, extraDirs: [] };
        const info = await harness.probe(env, new AbortController().signal);
        expect(info.status).toBe(expected);
        expect(info.models).toEqual([]);
        if (failure === 'network') await expect(harness.authenticate(env, 'google-browser', new AbortController().signal)).rejects.toThrow('comprobar la sesión');
      }
    } finally { await rm(cwd, { recursive: true, force: true }); }
  });
  it('only accepts live tab-separated model rows, without a fabricated catalog',()=>{
    expect(parseAgyModels('Fetching available models...\nclaude-opus-5-5-low\tOpus\nclaude-opus-5-5-low\tOpus\nweird model\tbad')).toEqual([{id:'claude-opus-5-5-low',label:'Opus'}]);
  });
  for(const scenario of ['SUCCESS','FAILED_RESULT','MISSING_RESULT','EMPTY_RESULT','WAIT_FOREVER']) it(scenario+' preserves MCP configuration and settles the turn',async()=>{
    const cwd=await mkdtemp(join(tmpdir(),'syka-agy-'));
    const path=join(cwd,'.agents','mcp_config.json');
    await mkdir(join(cwd,'.agents'));await writeFile(path,JSON.stringify({custom:true,mcpServers:{personal:{serverUrl:'https://example.test/mcp'}}}));
    const events: ChatEvent[]=[];
    const permissionsPath=join(cwd,'.gemini','antigravity-cli','settings.json');
    const permissions={custom:true,permissions:{allow:['mcp(personal/*)'],deny:['run(rm *)'],ask:['mcp(private/*)']}};
    await mkdir(join(cwd,'.gemini','antigravity-cli'),{recursive:true});await writeFile(permissionsPath,JSON.stringify(permissions));
    const env={env:{...process.env,USERPROFILE:cwd,HOME:cwd} as Record<string,string>,extraDirs:[]};
    const harness=new AntigravityCliHarness({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/agy-agent.mjs',import.meta.url))],profileDir:cwd});
    try {
      expect((await harness.probe(env,new AbortController().signal)).models).toHaveLength(3);
      const session=await harness.open({cwd,model:'claude-opus-5-5-low',env,mcp:null,emit:e=>events.push(e)});
      const running=session.send(scenario,'claude-opus-5-5-low',e=>events.push(e));
      if(scenario==='WAIT_FOREVER') {await new Promise(resolve=>setTimeout(resolve,150));await session.interrupt();}
      expect((await running).status).toBe(scenario==='SUCCESS'?'completed':scenario==='WAIT_FOREVER'?'interrupted':'failed');
      if(scenario==='SUCCESS') {
        expect(events.filter(e => e.type === 'usage.reported').map(e => e.type === 'usage.reported' ? [e.usage.kind, e.usage.tokens.totalTokens] : null)).toEqual([['turn', 30], ['cumulative', 40]]);
        expect(events.filter(e=>e.type==='item.delta')).toHaveLength(2);
        expect(events.some(e=>e.type==='item.completed'&&e.item.kind==='assistant'&&e.item.phase==='final'&&e.item.text==='Hola Syka')).toBe(true);
        expect('antigravityCli' in session.resume).toBe(true);
        await expect(harness.open({cwd,model:'claude-opus-5-5-low',env,mcp:null,emit:()=>{},resume:{acp:{version:1,harness:'antigravity',sessionId:'old',profile:'old'}}})).rejects.toThrow('otra conexión');
      }
      else expect(events.some(e=>e.type==='item.completed'&&e.item.kind==='assistant'&&e.item.phase==='final')).toBe(false);
      expect(JSON.parse(await readFile(path,'utf8'))).toEqual({custom:true,mcpServers:{personal:{serverUrl:'https://example.test/mcp'}}});
      expect(JSON.parse(await readFile(permissionsPath,'utf8'))).toEqual(permissions);
      expect((await session.send('x','invented-model',()=>{})).status).toBe('failed');
      await session.close();
    } finally {await rm(cwd,{recursive:true,force:true});}
  });
  it('uses native full access and preserves Gemini MCP names across turns and native resume',async()=>{
    const cwd=await mkdtemp(join(tmpdir(),'syka-agy-gemini-resume-'));
    const receipts=join(cwd,'receipts.jsonl');
    const env={env:{...process.env,USERPROFILE:cwd,HOME:cwd,SYKA_TEST_AGY_RECEIPTS:receipts} as Record<string,string>,extraDirs:[]};
    const harness=new AntigravityCliHarness({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/agy-agent.mjs',import.meta.url))],profileDir:cwd});
    const options={cwd,model:'gemini-3.8-flash-high',env,mcp:null,emit:()=>{}};
    try {
      await harness.probe(env,new AbortController().signal);
      const session=await harness.open(options);
      for(let i=0;i<2;i++)expect((await session.send('SUCCESS',options.model,()=>{})).status).toBe('completed');
      const resume=structuredClone(session.resume);
      await session.close();
      const reopened=await harness.open({...options,resume});
      expect((await reopened.send('SUCCESS',options.model,()=>{})).status).toBe('completed');
      await reopened.close();
      const rows=(await readFile(receipts,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
      expect(rows).toHaveLength(3);
      expect(rows.every(row=>row.fullAccess&&row.currentServersExplained)).toBe(true);
      expect(rows.map(row=>row.names)).toEqual([rows[0].names,rows[0].names,rows[0].names]);
      expect(rows.map(row=>row.conversation)).toEqual([null,'fixture-session','fixture-session']);
      expect(rows[0].names).toHaveLength(1);
      expect('antigravityCli' in resume&&resume.antigravityCli.mcpNamespace).toMatch(/^syka_[a-f0-9]{12}$/);
      expect(JSON.parse(await readFile(join(cwd,'.agents','mcp_config.json'),'utf8')).mcpServers).toEqual({});
    } finally {await rm(cwd,{recursive:true,force:true});}
  });
  it('upgrades a legacy cursor without discarding its native conversation',async()=>{
    const cwd=await mkdtemp(join(tmpdir(),'syka-agy-legacy-'));
    const env={env:{...process.env,USERPROFILE:cwd,HOME:cwd} as Record<string,string>,extraDirs:[]};
    const harness=new AntigravityCliHarness({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/agy-agent.mjs',import.meta.url))],profileDir:cwd});
    const options={cwd,model:'gemini-3.8-flash-high',env,mcp:null,emit:()=>{}};
    try {
      await harness.probe(env,new AbortController().signal);
      const first=await harness.open(options);
      const cursor=structuredClone(first.resume);
      if(!('antigravityCli' in cursor))throw Error('Wrong cursor');
      cursor.antigravityCli.sessionId='legacy-native-conversation';delete cursor.antigravityCli.mcpNamespace;
      await first.close();
      const restored=await harness.open({...options,resume:cursor});
      expect('antigravityCli' in restored.resume&&restored.resume.antigravityCli.sessionId).toBe('legacy-native-conversation');
      expect('antigravityCli' in restored.resume&&restored.resume.antigravityCli.mcpNamespace).toMatch(/^syka_[a-f0-9]{12}$/);
      await restored.close();
    } finally {await rm(cwd,{recursive:true,force:true});}
  });
  it('keeps concurrent project tool namespaces separate',async()=>{
    const root=await mkdtemp(join(tmpdir(),'syka-agy-concurrent-'));
    const receipts=join(root,'receipts.jsonl');
    const env={env:{...process.env,USERPROFILE:root,HOME:root,SYKA_TEST_AGY_RECEIPTS:receipts} as Record<string,string>,extraDirs:[]};
    const harness=new AntigravityCliHarness({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/agy-agent.mjs',import.meta.url))],profileDir:root});
    try {
      await harness.probe(env,new AbortController().signal);
      const dirs=[join(root,'project-a'),join(root,'project-b')];await Promise.all(dirs.map(dir=>mkdir(dir)));
      const sessions=await Promise.all(dirs.map(cwd=>harness.open({cwd,model:'gemini-3.8-flash-high',env,mcp:null,emit:()=>{}})));
      expect((await Promise.all(sessions.map(session=>session.send('SUCCESS','gemini-3.8-flash-high',()=>{})))).map(outcome=>outcome.status)).toEqual(['completed','completed']);
      await Promise.all(sessions.map(session=>session.close()));
      const rows=(await readFile(receipts,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
      expect(rows).toHaveLength(2);expect(rows[0].names[0]).not.toBe(rows[1].names[0]);
      expect(new Set(rows.map(row=>row.cwd))).toEqual(new Set(dirs));
      for(const cwd of dirs)expect(JSON.parse(await readFile(join(cwd,'.agents','mcp_config.json'),'utf8')).mcpServers).toEqual({});
      expect(JSON.parse(await readFile(join(root,'.gemini','antigravity-cli','settings.json'),'utf8')).permissions.allow).toEqual([]);
    } finally {await rm(root,{recursive:true,force:true});}
  });
  for(const [scenario,expected] of [['QUOTA_RESULT','agotó la cuota'],['QUOTA_STDERR','agotó la cuota'],['RATE_LIMIT_RESULT','limitó esta solicitud'],['TOOL_DENIED','permisos de la CLI'],['STALE_MCP','conexión MCP'],['SILENT_AUTH_EMPTY','sin una respuesta final confirmada']] as const)it('reports '+scenario+' without exposing private stderr or accepting empty results',async()=>{
    const cwd=await mkdtemp(join(tmpdir(),'syka-agy-diagnostic-'));
    const env={env:{...process.env,USERPROFILE:cwd,HOME:cwd} as Record<string,string>,extraDirs:[]};
    const harness=new AntigravityCliHarness({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/agy-agent.mjs',import.meta.url))],profileDir:cwd});
    try {
      await harness.probe(env,new AbortController().signal);
      const session=await harness.open({cwd,model:'gemini-3.8-flash-high',env,mcp:null,emit:()=>{}});
      const outcome=await session.send(scenario,'gemini-3.8-flash-high',()=>{});
      expect(outcome.status).toBe('failed');
      if(outcome.status!=='failed')throw Error('Expected failure');
      expect(outcome.error).toContain(expected);expect(outcome.error).toContain('gemini-3.8-flash-high');
      expect(outcome.error).not.toMatch(/secret|account@example|not logged into/);
      if(scenario==='RATE_LIMIT_RESULT') {expect(outcome.error).toContain('30s');expect(outcome.error).not.toContain('agotó la cuota');}
      await session.close();
    } finally {await rm(cwd,{recursive:true,force:true});}
  });
  it('classifies provider errors without echoing untrusted diagnostics',()=>{
    expect(agyFailureMessage('gemini',['RESOURCE_EXHAUSTED (429). Resets in 4h38m58s. Bearer private-secret'])).toContain('4h38m58s');
    expect(agyFailureMessage('gemini',['arbitrary prompt private-secret'])).toBeUndefined();
  });
  for(const scenario of ['SCHEMA_TOOL','TERMINAL_ERROR_WITH_TEXT','TERMINAL_STDERR_WITH_TEXT','RECOVERED_TOOL_WITH_TEXT'])it('preserves terminal diagnostics and recovery for '+scenario,async()=>{
    const cwd=await mkdtemp(join(tmpdir(),'syka-agy-schema-'));
    const env={env:{...process.env,USERPROFILE:cwd,HOME:cwd} as Record<string,string>,extraDirs:[]};
    const harness=new AntigravityCliHarness({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/agy-agent.mjs',import.meta.url))],profileDir:cwd});
    const events:ChatEvent[]=[];
    try{
      await harness.probe(env,new AbortController().signal);
      const session=await harness.open({cwd,model:'gemini-3.8-flash-high',env,mcp:null,emit:()=>{}});
      const result=await session.send(scenario,'gemini-3.8-flash-high',event=>events.push(event));
      if(scenario==='RECOVERED_TOOL_WITH_TEXT'){
        expect(result).toEqual({status:'completed'});
        expect(events.some(event=>event.type==='item.completed'&&event.item.kind==='assistant'&&event.item.phase==='final')).toBe(true);
      }else{
        expect(result.status).toBe('failed');expect(result.error).toContain('esquema');
        expect(result.error).not.toMatch(/private-secret|agotó la cuota|Bearer/);
        expect(events.some(event=>event.type==='item.completed'&&event.item.kind==='assistant'&&event.item.phase==='final')).toBe(false);
      }
      await session.close();
    }finally{await rm(cwd,{recursive:true,force:true});}
  });
  for(const diagnostic of ['HTTP 429 Too many requests','RESOURCE_EXHAUSTED. Resets in 2m30s.'])it('does not infer an exhausted balance from '+diagnostic,()=>{
    const message=agyFailureMessage('gemini',[diagnostic]);
    expect(message).toContain('limitó esta solicitud');expect(message).toContain('saldo de cuota no fue informado');
    expect(message).not.toContain('agotó la cuota');expect(message).toContain('ni se reintentó automáticamente');
    if(diagnostic.includes('Resets'))expect(message).toContain('2m30s');
  });
});
