import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { AcpHarness } from '../src/host/acp';
import { AntigravityCliHarness } from '../src/host/antigravity-cli';
import { ClaudeCliHarness } from '../src/host/claude-cli';
import { bindHarnessTrace, HarnessTurnTrace, payloadSize } from '../src/host/harness-telemetry';
import type { HarnessSession, OpenOptions } from '../src/host/harness';

const roots:string[]=[],sessions:HarnessSession[]=[];
afterEach(async()=>{for(const session of sessions.splice(0))await session.close();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function root(){const dir=await mkdtemp(join(tmpdir(),'syka-provider-trace-'));roots.push(dir);return dir;}
function options(cwd:string,model:string):OpenOptions{return{cwd,model,mcp:null,env:{env:{...process.env,USERPROFILE:cwd,HOME:cwd} as Record<string,string>,extraDirs:[]},instructions:'Private standing rules',emit(){}};}

describe('provider transport measurements without model calls',()=>{
  it('measures ACP instructions only when sent and keeps first-request failure recoverable',async()=>{
    const cwd=await root(), opts=options(cwd,'model-one');let active=new HarnessTurnTrace('cursor');
    bindHarnessTrace(opts,()=>active);
    const harness=new AcpHarness({id:'cursor',command:process.execPath,args:[fileURLToPath(new URL('./fixtures/acp-agent.mjs',import.meta.url)),'echo-prompt','cursor'],profileDir:cwd});
    const session=await active.run(()=>harness.open(opts));sessions.push(session);
    expect((await active.run(()=>session.send('First private request','model-one',()=>{}))).status).toBe('completed');
    const first=active;active=new HarnessTurnTrace('cursor');
    expect((await active.run(()=>session.send('Second private request','model-one',()=>{}))).status).toBe('completed');
    expect(first.record.instructionReuse).toBe('sent');expect(active.record.instructionReuse).toBe('confirmed_session');
    expect(first.record.payloads.filter(p=>p.category==='instructions').map(p=>p.chars)).toEqual([opts.instructions!.length]);
    expect(active.record.payloads.some(p=>p.category==='instructions')).toBe(false);
    expect(JSON.stringify(first.finish('completed'))).not.toMatch(/standing rules|private request/);
  });

  it('measures Antigravity native tool schema failure without claiming instruction persistence or quota',async()=>{
    const cwd=await root(),opts=options(cwd,'gemini-3.8-flash-high'),trace=new HarnessTurnTrace('antigravity');
    bindHarnessTrace(opts,()=>trace);
    const harness=new AntigravityCliHarness({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/agy-agent.mjs',import.meta.url))],profileDir:cwd});
    await harness.probe(opts.env,new AbortController().signal);
    const session=await trace.run(()=>harness.open(opts));sessions.push(session);
    expect((await trace.run(()=>session.send('SCHEMA_TOOL',opts.model,()=>{}))).status).toBe('failed');
    expect(trace.record.instructionReuse).toBe('per_invocation_unverified_persistence');
    expect(trace.record.errors).toContain('tool_schema');expect(trace.record.errors).not.toContain('quota');
    expect(trace.record.tools[0]).toMatchObject({name:'write_file',boundary:'antigravity_cli',status:'failed',upstream:'unknown'});
    expect(trace.record.payloads.some(p=>p.category==='wire_request')).toBe(true);
    expect(JSON.stringify(trace.finish('failed'))).not.toMatch(/private-secret|Private standing/);
  });

  it('captures Claude full tool output before collectResult truncates it and rejects a nonzero terminal exit',async()=>{
    const cwd=await root(),fixture=join(cwd,'claude-fixture.mjs'),output='large native result '.repeat(7000);
    await writeFile(fixture,`const args=process.argv.slice(2);if(args.includes('--version')){console.log('2.1.289 (Claude Code)');process.exit(0)}
      process.stdin.once('data',d=>{const r=JSON.parse(String(d).split('\\n')[0]);
      if(r.type==='control_request'){console.log(JSON.stringify({type:'control_response',response:{request_id:r.request_id,response:{models:[]}}}));process.exit(0)}
      const input=r.message.content.map(part=>part.text).join('');
      console.log(JSON.stringify({type:'assistant',message:{content:[{type:'tool_use',id:'private-call-id',name:'Read',input:{file_path:'private-file.tsx'}}]}}));
      console.log(JSON.stringify({type:'user',message:{content:[{type:'tool_result',tool_use_id:'private-call-id',content:${JSON.stringify(output)}}]}}));
      console.log(JSON.stringify({type:'result',is_error:false}));process.exit(input==='bad-exit'?1:0);});`);
    const opts=options(cwd,'__cli_default__');let active=new HarnessTurnTrace('claude');bindHarnessTrace(opts,()=>active);
    const harness=new ClaudeCliHarness({id:'claude',command:process.execPath,args:[fixture],profileDir:cwd});
    const session=await active.run(()=>harness.open(opts));sessions.push(session);
    const displayed:string[]=[];
    expect((await active.run(()=>session.send('fixture',opts.model,event=>{if(event.type==='item.completed'&&event.item.kind==='tool'&&event.item.output)displayed.push(event.item.output);}))).status).toBe('completed');
    expect(displayed[0].length).toBeLessThan(2100);expect(active.record.tools[0].textResponse).toEqual(payloadSize(output));
    expect(active.record.instructionReuse).toBe('per_invocation_unverified_persistence');
    expect(JSON.stringify(active.finish('completed'))).not.toMatch(/private-call-id|private-file|large native result/);
    active=new HarnessTurnTrace('claude');expect((await active.run(()=>session.send('bad-exit',opts.model,()=>{}))).status).toBe('failed');
  });
});
