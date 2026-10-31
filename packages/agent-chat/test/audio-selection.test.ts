import { closeResourceIndexes } from '../src/host/resource-index';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, readdir, open, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { resourceLibrary } from '../src/host/resource-library';
import { CreativeResearch } from '../src/host/creative-research';
import { WorkspaceTools } from '../src/host/workspace-tools';
import { createMusic } from '../src/host/music-create';
import type { Worker } from 'node:worker_threads';
// @ts-expect-error The portable dependency-free generator intentionally ships as JavaScript.
import { HARMONIES } from '../../../docs/skills/syka-local-audio/scripts/music-composition.mjs';

let root:string, config:string, personal:string;
beforeEach(async()=>{ root=await mkdtemp(join(tmpdir(),'syka-audio-choice-')); config=join(root,'profile','resources.json'); personal=join(root,'personal'); await mkdir(personal); await resourceLibrary(config,{action:'add-folder',kind:'sounds',path:personal}); });
afterEach(async()=>{await closeResourceIndexes(config);if(!root.startsWith(join(tmpdir(),'syka-audio-choice-')))throw Error('Unexpected fixture root');await rm(root,{recursive:true,force:true});});
describe('audio discovery and classification',()=>{
  it('finds personal music by name and keeps uncertain files available without claiming they are music',async()=>{
    await writeFile(join(personal,'piano-elegante.wav'),'piano'); await writeFile(join(personal,'0007.wav'),'unknown'); await writeFile(join(personal,'click.wav'),'click');
    const found=await resourceLibrary(config,{action:'list',kind:'sounds',audioType:'music'});
    expect(found.entries.map(entry=>entry.name).sort()).toEqual(['0007.wav','piano-elegante.wav']);
    expect(found.entries.find(entry=>entry.name==='piano-elegante.wav')).toMatchObject({audioType:'music',classificationSource:'filename'});
    expect(found.entries.find(entry=>entry.name==='0007.wav')?.audioType).toBeUndefined();
    expect((await resourceLibrary(config,{action:'list',kind:'sounds',audioType:'unclassified'})).total).toBe(1);
  });
  it('persists folder classification and file corrections, invalidating a changed file annotation',async()=>{
    const path=join(personal,'001.wav');await writeFile(path,'track');
    await resourceLibrary(config,{action:'classify',kind:'sounds',path:personal,classification:'music'});
    expect((await resourceLibrary(config,{action:'list',kind:'sounds',audioType:'music'})).entries[0]).toMatchObject({audioType:'music',classificationSource:'folder'});
    await resourceLibrary(config,{action:'classify',kind:'sounds',path,classification:'sfx',tags:['vidrio'],license:'CC0'});
    expect((await resourceLibrary(config,{action:'list',kind:'sounds',audioType:'sfx'})).entries[0]).toMatchObject({audioType:'sfx',classificationSource:'manual',tags:['vidrio'],license:'CC0'});
    await writeFile(path,'replaced track with other bytes');
    expect((await resourceLibrary(config,{action:'list',kind:'sounds',audioType:'music'})).entries[0]).toMatchObject({audioType:'music',classificationSource:'folder'});
    expect(JSON.parse(await readFile(config,'utf8')).folders).toHaveLength(1);
  });
  it('refuses classification outside connected folders and through a junction',async()=>{
    const outside=join(root,'outside');await mkdir(outside);await writeFile(join(outside,'track.wav'),'outside');
    await symlink(outside,join(personal,'escape'),process.platform==='win32'?'junction':'dir');
    await expect(resourceLibrary(config,{action:'classify',kind:'sounds',path:join(personal,'escape','track.wav'),classification:'music'})).rejects.toThrow('personales conectadas');
  });
  it('rejects malformed or oversized classification metadata before searching',async()=>{
    await writeFile(config+'.audio.json',JSON.stringify({version:1,entries:[{path:personal,scope:'folder',audioType:'music',tags:4}]}));
    await expect(resourceLibrary(config,{action:'list',kind:'sounds'})).rejects.toThrow('Clasificación de audio inválida');
    await writeFile(config+'.audio.json',' '.repeat(1024*1024+1));
    await expect(resourceLibrary(config,{action:'list',kind:'sounds'})).rejects.toThrow('supera 1 MiB');
  });
  it('finds partial audio descriptions and prevents a known-vocal candidate for an instrumental ask',async()=>{
    const piano=join(personal,'piano.wav'),vocal=join(personal,'vocals-piano.wav');await writeFile(piano,'p');await writeFile(vocal,'v');
    const found=await resourceLibrary(config,{action:'list',kind:'sounds',audioType:'music',query:'quiero música piano elegante instrumental'});
    expect(found.entries.map(entry=>entry.name)).toEqual(['piano.wav']);
  });
  it('can select and verify a full-length lossless track above the former 24 MiB cap',async()=>{
    const path=join(personal,'piano-largo.wav'),handle=await open(path,'wx');
    try {await handle.truncate(25*1024*1024);} finally {await handle.close();}
    const research=new CreativeResearch(root,undefined,config);
    const found=await research.resources({action:'list',kind:'sounds',audioType:'music',query:'piano'});
    const target=join(root,'music-copy.wav');await copyFile(path,target);
    await expect(research.call({action:'choose',id:found.entries[0]!.id,role:'music',reason:'Base sin pérdida verificada.',projectAsset:'music-copy.wav'})).resolves.toMatchObject({role:'music',imported:'music-copy.wav'});
  });
  it('shares SFX history and refuses silent recent-music reuse on a new piece',async()=>{
    for(const name of ['click-a.wav','click-b.wav','piano.wav'])await writeFile(join(personal,name),name);
    const first=new CreativeResearch(root,undefined,config),secondRoot=join(root,'project-b');await mkdir(secondRoot);const second=new CreativeResearch(secondRoot,undefined,config);
    const one=await first.resources({action:'list',kind:'sounds',audioType:'sfx',query:'click'});await first.call({action:'choose',id:one.entries[0]!.id,role:'sfx',reason:'Seleccionado para el gesto.'});
    expect((await first.resources({action:'list',kind:'sounds',audioType:'sfx',query:'click'})).entries[0]!.id).not.toBe(one.entries[0]!.id);
    expect((await second.resources({action:'list',kind:'sounds',audioType:'sfx',query:'click'})).entries[0]!.id).not.toBe(one.entries[0]!.id);
    const music=await first.resources({action:'list',kind:'sounds',audioType:'music',query:'piano'});await first.call({action:'choose',id:music.entries[0]!.id,role:'music',reason:'Elegida para la primera pieza.'});
    const sameProject=await first.resources({action:'list',kind:'sounds',audioType:'music',query:'piano',newPiece:true});
    await expect(first.call({action:'choose',id:sameProject.entries[0]!.id,role:'music',reason:'Otra pieza en el mismo proyecto.'})).rejects.toThrow('otra composición');
    await first.resources({action:'list',kind:'sounds',audioType:'music',query:'piano'});
    await expect(first.call({action:'choose',id:music.entries[0]!.id,role:'music',reason:'Mantener la base durante una corrección.'})).resolves.toMatchObject({role:'music'});
    for(let index=0;index<130;index++)await first.call({action:'choose',id:one.entries[0]!.id,role:'sfx',reason:'Un gesto más no debe borrar el historial de música.'});
    expect((await first.call({action:'status'}) as any).choices.some((entry:any)=>entry.role==='music')).toBe(true);
    const again=await second.resources({action:'list',kind:'sounds',audioType:'music',query:'piano',newPiece:true});
    expect(again).toMatchObject({musicDecision:{state:'source_or_create_or_ask',freshCandidates:0}});
    await expect(second.call({action:'choose',id:again.entries[0]!.id,role:'music',reason:'Otra pieza.'})).rejects.toThrow('otra composición');
  },20000);
});
describe('local composition lifecycle',()=>{
  it('creates distinct harmonies and portable stems through the real agent tool',async()=>{
    const docs=resolve('docs'); const tools=new WorkspaceTools(root,docs,undefined,config);
    try {
      const [a,b]=await Promise.all([tools.call('syka_music_create',{style:'editorial',duration:4,seed:7}),tools.call('syka_music_create',{style:'editorial',duration:4,seed:7})]) as any[];
      expect(a.state).toBe('created');expect(b.state).toBe('created');
      expect(a.composition.compositionFamily).not.toBe(b.composition.compositionFamily);
      expect(a.selection.imported).toBe(a.relativePath);
      expect(a.clippedSamples).toBe(0);expect(a.duration).toBe(4);expect(a.stems.length).toBeGreaterThan(1);
      expect((await readFile(a.path)).subarray(0,4).toString()).toBe('RIFF');
      expect((await tools.call('syka_creative_selection',{action:'status'}) as any).choices.some((entry:any)=>entry.role==='music')).toBe(true);
      const resumed=new WorkspaceTools(root,docs,undefined,config);
      try {
        const status=await resumed.call('syka_creative_selection',{action:'status'}) as any;
        expect(status.choices.find((entry:any)=>entry.role==='music').projectAsset).toBe(b.relativePath);
        const revision=await resumed.call('syka_resources',{action:'list',kind:'sounds',audioType:'music'}) as any;
        expect(revision.recordedMusic.projectAsset).toBe(b.relativePath);
      } finally {await resumed.close();}
    } finally {await tools.close();}
  },30000);
  it('cancels queued creation on workspace close instead of starting a late worker',async()=>{
    const tools=new WorkspaceTools(root,resolve('docs'),undefined,config);
    const pending=tools.call('syka_music_create',{style:'cinematic',duration:60}).then(()=>({created:true}),()=>({created:false}));
    await tools.close();
    expect(await pending).toEqual({created:false});
    expect(await readdir(root)).not.toContain('03 Assets reutilizables');
  });
  it('terminates an active synthesis worker on cancellation',async()=>{
    const jobs=new Set<Worker>(), abort=new AbortController(); let settled=false;
    const pending=createMusic(root,resolve('docs'),{style:'pulse',duration:60},[],jobs,abort.signal).then(()=>({created:true}),()=>({created:false})).finally(()=>{settled=true;});
    const deadline=Date.now()+10000;
    while(!jobs.size&&!settled&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,1));
    try {expect(jobs.size).toBe(1);} finally {abort.abort();}
    expect(await pending).toEqual({created:false});
    expect(jobs.size).toBe(0);
  },15000);
  it('asks for direction without publishing another bed when local harmony choices are exhausted',async()=>{
    const result=await createMusic(root,resolve('docs'),{style:'editorial',duration:60},HARMONIES.map((entry:{id:string})=>'syka-harmony:'+entry.id));
    expect(result.state).toBe('needs_direction');
    expect(await readdir(join(root,'03 Assets reutilizables','Audio','Musica creada'))).toEqual([]);
  });
});
