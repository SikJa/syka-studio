import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AgentHost } from '../src/host/host';
import { ChatStore } from '../src/host/store';
import { currentHarnessTrace, harnessTraceFor, HarnessTraceStore } from '../src/host/harness-telemetry';
import type { Harness, HarnessSession, OpenOptions } from '../src/host/harness';
import type { HostMsg } from '../src/protocol';

const fixtures:{host:AgentHost;root:string}[]=[];
afterEach(async()=>{for(const{host,root}of fixtures.splice(0)){await host.stop();await rm(root,{recursive:true,force:true});}});

async function setup() {
  const root=await mkdtemp(join(tmpdir(),'syka-host-trace-')), store=new ChatStore(root), trace=new HarnessTraceStore(root);
  const options:OpenOptions[]=[],sessions:{closed:boolean}[]=[];
  const harness:Harness={id:'codex',probe:async()=>({id:'codex',label:'Fixture',status:'ready',models:[{id:'fixture-model',label:'Fixture model'}]}),open:async(openOptions)=>{
    options.push(openOptions);const state={closed:false};sessions.push(state);
    return {resume:{codex:{threadId:'private-provider-thread'}},get isClosed(){return state.closed;},send:async(text,_model,emit)=>{
      expect(currentHarnessTrace()).toBe(harnessTraceFor(openOptions));
      const finish=harnessTraceFor(openOptions)?.tool('read_file','codex_native',{path:'private-source.tsx'});
      await Promise.resolve();finish?.('read result containing private file text');
      emit({type:'item.completed',item:{id:'fixture-output',kind:'assistant',text:'Edición verificada'}});
      if(text.includes('fail'))return {status:'failed',error:'INVALID_ARGUMENT private-token'};
      return {status:'completed'};
    },respond(){},interrupt:async()=>{},close:async()=>{state.closed=true;}} satisfies HarnessSession;
  }};
  const host=new AgentHost({version:'fixture',store,trace,harnesses:[harness],env:Promise.resolve({env:{},extraDirs:[]}),mcp:null,idleMs:60_000,log:()=>{}});
  fixtures.push({host,root});await host.start();const connection={send(_message:HostMsg){}};
  await host.handle(connection,'harnesses.list',{refresh:true});
  const send=async(chatId?:string,text='change title')=>{
    const count=trace.snapshot().length;
    const result=await host.handle(connection,'turn.send',{chatId,projectId:'private-project-id',cwd:root,text,model:{harness:'codex',model:'fixture-model'}});
    await vi.waitFor(()=>expect(trace.snapshot()).toHaveLength(count+1));return result.chatId;
  };
  return {host,root,trace,options,sessions,send};
}

it('measures accepted turn preparation, session reuse and failure while keeping payloads private',async()=>{
  const test=await setup(),id=await test.send();
  await test.send(id);test.sessions[0].closed=true;await test.send(id,'fail with token');
  const records=test.trace.snapshot();
  expect(records.map(record=>record.session?.action)).toEqual(['new','reuse','resume']);
  expect(records.map(record=>record.session?.reason)).toEqual(['new_chat','active_session','transport_closed']);
  expect(records.map(record=>record.status)).toEqual(['completed','completed','failed']);
  expect(records[2].errors).toContain('tool_schema');
  for(const record of records){
    expect(record.preparationMs).toBeGreaterThanOrEqual(0);expect(record.queueWaitMs).toBe(0);
    expect(record.payloads.some(p=>p.boundary==='host'&&p.category==='user')).toBe(true);
    expect(record.tools).toHaveLength(1);expect(record.nativeUsage).toBeNull();
    expect(record.timing.firstOutputMs).not.toBeNull();
  }
  expect(test.options).toHaveLength(2);
  await test.trace.flush();expect(await readFile(test.trace.path,'utf8')).not.toMatch(/private-token|private-project-id|private-source|private-provider-thread|change title/);
});

it('records a rejected admission without opening or attributing a provider turn',async()=>{
  const test=await setup();
  await expect(test.host.handle({send(){}},'turn.send',{projectId:'private-project',cwd:test.root,text:'do not leak',model:{harness:'codex',model:'fixture-model',fast:true}})).rejects.toMatchObject({code:'bad-request'});
  const [record]=test.trace.snapshot();
  expect(record.admission).toBe('rejected');expect(record.status).toBe('failed');expect(record.session).toBeNull();
  expect(record.nativeUsage).toBeNull();expect(test.options).toHaveLength(0);
  expect(JSON.stringify(record)).not.toContain('do not leak');
});
