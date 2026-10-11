import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AntigravityCliHarness, parseAgyModels } from '../src/host/antigravity-cli';
import type { ChatEvent } from '../src/protocol';

describe('official Antigravity CLI transport',()=>{
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
      expect((await harness.probe(env,new AbortController().signal)).models).toHaveLength(2);
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
      expect(JSON.parse(await readFile(path,'utf8'))).toEqual({custom:true,mcpServers:{personal:{serverUrl:'https://example.test/mcp'}}});
      expect(JSON.parse(await readFile(permissionsPath,'utf8'))).toEqual(permissions);
      expect((await session.send('x','invented-model',()=>{})).status).toBe('failed');
      await session.close();
    } finally {await rm(cwd,{recursive:true,force:true});}
  });
});
