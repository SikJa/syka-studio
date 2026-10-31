import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bindHarnessTrace, currentHarnessTrace, harnessTraceFor, HarnessTraceStore, HarnessTurnTrace, payloadSize, registerTraceTools, traceFailure } from '../src/host/harness-telemetry';
import { startEditorToolBridge } from '../src/host/editor-tool-bridge';
import type { OpenOptions } from '../src/host/harness';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, {recursive:true,force:true}); });
async function directory() { const root = await mkdtemp(join(tmpdir(),'syka-harness-trace-')); roots.push(root); return root; }

describe('local harness boundary measurements', () => {
  it('keeps exact payload sizes and native usage without storing content, private IDs or estimates', async () => {
    const root=await directory(), store=new HarnessTraceStore(root), trace=store.begin('codex',12,34);
    const secret='Bearer PRIVATE_TOKEN C:\\Private\\customer.txt private-project-id', value='á'.repeat(129453)+secret;
    trace.payload('codex_dynamic','user',secret);
    trace.payload('codex_dynamic','instructions',secret);
    const done=trace.tool('read_file','codex_native',{path:secret});
    done({content:[{type:'text',text:value}]});done('duplicate ignored');
    trace.usage({sessionId:secret,kind:'cumulative',tokens:{totalTokens:1000,inputTokens:800,outputTokens:200,cachedInputTokens:500},historical:true});
    trace.ready();trace.activity(true);store.save(trace,'completed');await store.flush();
    const data=JSON.parse(await readFile(store.path,'utf8')), record=data.records[0];
    expect(record.tools).toHaveLength(1);expect(record.tools[0].textResponse).toEqual(payloadSize(value));
    expect(record.preparationMs).toBe(12);expect(record.queueWaitMs).toBe(34);
    expect(record.nativeUsage).toEqual([{kind:'cumulative',tokens:{totalTokens:1000,inputTokens:800,outputTokens:200,cachedInputTokens:500},historical:true}]);
    expect(record.timing.firstOutputMs).not.toBeNull();
    expect(record.unknown).toContain('provider_cache_behavior');
    expect(data.accounting).toBe('boundary_observations_overlap_do_not_sum');
    const json=JSON.stringify(data);expect(json).not.toMatch(/PRIVATE_TOKEN|customer|private-project-id|Bearer/);
    expect(new HarnessTurnTrace('opencode').finish('completed').nativeUsage).toBeNull();
  });

  it('isolates concurrent turns and resolves a persistent callback against its current turn', async () => {
    const first=new HarnessTurnTrace('codex'), second=new HarnessTurnTrace('opencode'), options={};
    let active:HarnessTurnTrace|undefined=first;bindHarnessTrace(options,()=>active);
    await Promise.all([first.run(async()=>{await Promise.resolve();expect(currentHarnessTrace()).toBe(first);}),second.run(async()=>{await Promise.resolve();expect(currentHarnessTrace()).toBe(second);})]);
    first.run(()=>{expect(harnessTraceFor(options)).toBe(first);active=second;expect(harnessTraceFor(options)).toBe(second);active=undefined;expect(harnessTraceFor(options)).toBeUndefined();});
  });

  it('attributes actual MCP tool responses before UI truncation to successive active turns',async()=>{
    const cwd=await directory();await writeFile(join(cwd,'index.tsx'),'// '+ 'content '.repeat(4500));
    let active:HarnessTurnTrace|undefined=new HarnessTurnTrace('opencode');const first=active;
    const options:OpenOptions={cwd,model:'fixture',mcp:null,env:{env:{},extraDirs:[]},emit:()=>{}};
    bindHarnessTrace(options,()=>active);
    const bridge=await first.run(()=>startEditorToolBridge(options));
    try{
      const call=async(id:number)=>{
        const response=await fetch(bridge.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{name:'syka_read_source',arguments:{path:'index.tsx',mode:'full',maxChars:96000}}})});
        expect(response.status).toBe(200);return response.json();
      };
      const one=await call(1);expect(one.result.isError).not.toBe(true);
      const second=new HarnessTurnTrace('opencode');active=second;const two=await call(2);
      expect(first.record.tools).toHaveLength(1);expect(second.record.tools).toHaveLength(1);
      expect(second.record.tools[0].readMode).toBe('full');
      expect(second.record.tools[0].response).toEqual(payloadSize(two.result));
      expect(second.record.tools[0].textResponse!.chars).toBeGreaterThan(30_000);
      active=undefined;await call(3);expect(first.record.tools).toHaveLength(1);expect(second.record.tools).toHaveLength(1);
    }finally{await bridge.close();}
  });

  it('bounds retained turns, records and names, and tolerates unwriteable diagnostic storage',async()=>{
    const root=await directory(),store=new HarnessTraceStore(root);
    registerTraceTools([{name:'syka_safe_fixture'}]);
    for(let i=0;i<105;i++){
      const trace=store.begin('claude');for(let j=0;j<(i===104?110:1);j++)trace.payload('host','user','private');
      if(i===104)for(let j=0;j<140;j++)trace.tool('private name@example.test','claude_cli',{})('private');
      store.save(trace,'completed');
    }
    await store.flush();const data=JSON.parse(await readFile(store.path,'utf8'));
    expect(data.records.length).toBeLessThanOrEqual(100);expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThan(2_000_000);
    const last=data.records.at(-1);expect(last.payloads).toHaveLength(96);expect(last.droppedPayloads).toBe(14);
    expect(last.tools).toHaveLength(128);expect(last.droppedTools).toBe(12);expect(last.tools[0].name).toBe('native_tool');
    const blocked=join(root,'file');await writeFile(blocked,'keep');const bad=new HarnessTraceStore(blocked);
    expect(()=>bad.save(bad.begin('codex'),'failed','Bearer private')).not.toThrow();await expect(bad.flush()).resolves.toBeUndefined();
    expect(await readFile(blocked,'utf8')).toBe('keep');
  });

  it('classifies known failures without asserting quota from rate limits or retaining diagnostics',()=>{
    expect(traceFailure('invalid arguments: ArtifactMetadata got string, want object')).toBe('tool_schema');
    expect(traceFailure('HTTP 429 RESOURCE_EXHAUSTED')).toBe('rate_limit');
    expect(traceFailure('Individual quota reached')).toBe('quota');
    expect(traceFailure('unknown raw message Bearer private')).toBe('other');
    const circular:Record<string,unknown>={};circular.self=circular;expect(payloadSize(circular)).toBeNull();
    const trace=new HarnessTurnTrace('codex');trace.nativeTool('private-id','read_file','codex_native','done','provider completion without start');
    expect(trace.record.tools[0].durationMs).toBeNull();
  });
});
