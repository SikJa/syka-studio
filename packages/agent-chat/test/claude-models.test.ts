import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claudeModels, discoverClaudeModels, ClaudeCliHarness } from '../src/host/claude-cli';
import { inheritedEnv } from '../src/host/env';

describe('Claude native model discovery', () => {
  it('refreshes a cold session catalog and retains native options through transient empty probes',async()=>{
    const root=await mkdtemp(join(tmpdir(),'syka-claude-catalog-'));
    let session:Awaited<ReturnType<ClaudeCliHarness['open']>>|undefined;
    try {
      const fixture=join(root,'cli.cjs'),catalogFile=join(root,'models.json'),receipt=join(root,'turn-args.json');
      await writeFile(catalogFile,JSON.stringify([{value:'opus',displayName:'Opus native',supportsEffort:true,supportedEffortLevels:['high','xhigh']}]));
      await writeFile(fixture,`const fs=require('node:fs');const args=process.argv.slice(2);
        if(args.includes('--version')){console.log('2.1.289 (Claude Code)');process.exit(0)}
        if(args.includes('auth')){console.log('{"loggedIn":true}');process.exit(0)}
        process.stdin.once('data',d=>{
          const r=JSON.parse(d);if(r.type==='control_request'){console.log(JSON.stringify({type:'control_response',response:{request_id:r.request_id,response:{models:JSON.parse(fs.readFileSync(${JSON.stringify(catalogFile)},'utf8'))}}}));}
          else{fs.writeFileSync(${JSON.stringify(receipt)},JSON.stringify(args));console.log(JSON.stringify({type:'result',is_error:false}));process.exit(0)}
        });`);
      const env=inheritedEnv(),harness=new ClaudeCliHarness({id:'claude',command:process.execPath,args:[fixture],profileDir:root});
      session=await harness.open({cwd:root,model:'opus',env,mcp:null,emit:()=>{}});
      // Opening before the catalog arrives used to permanently capture [].
      expect(await session.send('QA','opus',()=>{},'high')).toEqual({status:'completed'});
      await writeFile(catalogFile,'[]');
      const probe=await harness.probe(env,AbortSignal.timeout(15000));
      expect(probe.models[0]).toMatchObject({id:'opus',efforts:['high','xhigh']});
      expect(await session.send('QA again','opus',()=>{},'xhigh')).toEqual({status:'completed'});
      const args=JSON.parse(await readFile(receipt,'utf8'));
      expect(args[args.indexOf('--model')+1]).toBe('opus');expect(args[args.indexOf('--effort')+1]).toBe('xhigh');
    } finally {await session?.close();if(!root.startsWith(join(tmpdir(),'syka-claude-catalog-')))throw Error('Unexpected fixture root');await rm(root,{recursive:true,force:true});}
  });
  it('an already open session sees a later native catalog refresh',async()=>{
    const root=await mkdtemp(join(tmpdir(),'syka-claude-live-catalog-'));
    let session:Awaited<ReturnType<ClaudeCliHarness['open']>>|undefined;
    try {
      const fixture=join(root,'cli.cjs');
      await writeFile(fixture,`const a=process.argv.slice(2);if(a.includes('--version')){console.log('2.1.289 (Claude Code)');process.exit(0)}if(a.includes('auth')){console.log('{"loggedIn":true}');process.exit(0)}process.stdin.once('data',d=>{const r=JSON.parse(d);if(r.type==='control_request'){console.log(JSON.stringify({type:'control_response',response:{request_id:r.request_id,response:{models:[{value:'opus',displayName:'Opus',supportsEffort:true,supportedEffortLevels:['high']}]}}}));}else{console.log('{"type":"result","is_error":false}');process.exit(0)}});`);
      const env=inheritedEnv(),harness=new ClaudeCliHarness({id:'claude',command:process.execPath,args:[fixture],profileDir:root});
      session=await harness.open({cwd:root,model:'opus',env,mcp:null,emit:()=>{}});
      await harness.probe(env,AbortSignal.timeout(15000));
      expect(await session.send('QA','opus',()=>{},'high')).toEqual({status:'completed'});
    } finally {await session?.close();if(!root.startsWith(join(tmpdir(),'syka-claude-live-catalog-')))throw Error('Unexpected fixture root');await rm(root,{recursive:true,force:true});}
  });
  it('uses advertised IDs and labels, discarding duplicates and malformed entries', () => {
    expect(claudeModels([{ value: 'sonnet', displayName: 'Sonnet native' }, { value: 'sonnet', displayName: 'Duplicate' }, { value: '--danger', displayName: 'Bad' }]))
      .toEqual([{ id: 'sonnet', label: 'Sonnet native' }]);
    expect(claudeModels(undefined)).toEqual([]);
  });
  it('only initializes the CLI; never sends a prompt to discover models', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syka-claude-models-'));
    try {
      const fixture = join(root, 'cli.cjs');
      await writeFile(fixture, `process.stdin.once('data', d => { const r=JSON.parse(d); if(r.type!=='control_request'||r.request.subtype!=='initialize')process.exit(2); process.stdout.write(JSON.stringify({type:'control_response',response:{request_id:r.request_id,response:{models:[{value:'sonnet',displayName:'Sonnet live'}]}}})+'\\n'); });`);
      expect(await discoverClaudeModels({ id: 'claude', command: process.execPath, args: [fixture], profileDir: root }, inheritedEnv()))
        .toEqual([{ id: 'sonnet', label: 'Sonnet live' }]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('preserves model-specific native effort levels without inventing them for older models', () => {
    expect(claudeModels([
      {value:'opus',displayName:'Opus',supportsEffort:true,supportedEffortLevels:['low','medium','high','xhigh','max','high','--bad',null]},
      {value:'sonnet',displayName:'Sonnet',supportsEffort:true,supportedEffortLevels:['low','medium','high','max']},
      {value:'haiku',displayName:'Haiku',supportsEffort:false,supportedEffortLevels:['high']},
    ])).toEqual([
      {id:'opus',label:'Opus',efforts:['low','medium','high','xhigh','max']},
      {id:'sonnet',label:'Sonnet',efforts:['low','medium','high','max']},
      {id:'haiku',label:'Haiku'},
    ]);
  });
  it('passes the selected effort to the CLI and rejects unsupported levels before launching a turn', async () => {
    const root=await mkdtemp(join(tmpdir(),'syka-claude-effort-'));
    let session: Awaited<ReturnType<ClaudeCliHarness['open']>> | undefined;
    try {
      const fixture=join(root,'cli.cjs'), receipt=join(root,'argv.json');
      await writeFile(fixture, `const fs=require('node:fs');const args=process.argv.slice(2);
        if(args.includes('--version')){console.log('2.1.219 (Claude Code)');process.exit(0)}
        if(args.includes('auth')){console.log('{"loggedIn":true}');process.exit(0)}
        process.stdin.once('data',d=>{
          const r=JSON.parse(d);if(r.type==='control_request'){console.log(JSON.stringify({type:'control_response',response:{request_id:r.request_id,response:{models:[{value:'opus',displayName:'Opus',supportsEffort:true,supportedEffortLevels:['low','max']}]}}}));}
          else{fs.writeFileSync(${JSON.stringify(receipt)},JSON.stringify(args));console.log(JSON.stringify({type:'result',is_error:false}));process.exit(0)}
        });`);
      const env=inheritedEnv();
      const harness=new ClaudeCliHarness({id:'claude',command:process.execPath,args:[fixture],profileDir:root});
      const catalog=await harness.probe(env,AbortSignal.timeout(15000));
      expect(catalog.models[0]?.efforts).toEqual(['low','max']);
      session=await harness.open({cwd:root,model:'opus',env,mcp:null,emit:()=>{}});
      expect(await session.send('QA','opus',()=>{},'xhigh')).toMatchObject({status:'failed'});
      await expect(readFile(receipt)).rejects.toMatchObject({code:'ENOENT'});
      expect(await session.send('QA','opus',()=>{},'max')).toEqual({status:'completed'});
      const args=JSON.parse(await readFile(receipt,'utf8'));
      expect(args.slice(args.indexOf('--effort'),args.indexOf('--effort')+2)).toEqual(['--effort','max']);
      expect(args).toContain('--dangerously-skip-permissions');
      expect(args).toContain('--strict-mcp-config');
    } finally {await session?.close();await rm(root,{recursive:true,force:true});}
  });
});
