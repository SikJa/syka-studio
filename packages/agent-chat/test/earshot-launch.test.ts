import { describe,expect,it } from 'vitest';
import { mkdtemp,readFile,writeFile,rm,readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createLaunchAudio,launchBedLevel,launchGain,launchPlace,launchStopPoints,LAUNCH_ROLES } from '../src/host/earshot-launch';
import { optionalEarshotAnalysis } from '../src/host/earshot-analysis';
import { WORKSPACE_TOOLS,WorkspaceTools } from '../src/host/workspace-tools';
import { SourceTools } from '../src/host/source-tools';
import { undoSourceEdit,redoSourceEdit } from '../src/host/edit-journal';
import { mediaProcess } from '../src/host/media-analysis';
import { resolveLocalTool } from '../src/host/local-tools';
import { resourceLibrary } from '../src/host/resource-library';
const docs=resolve('docs'),kitFolder=join(docs,'skills/syka-local-audio/resources/earshot-launch');
const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>typeof e[1]==='string'));
const ffmpeg=resolveLocalTool('ffmpeg',{env}).path;
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');

describe('Earshot 0.4 portable launch',()=>{
  it('meters stereo K-weighted levels without cancelling opposite phase; silence has no bed',()=>{
    const pcm=Buffer.alloc(48000*8);
    for(let i=0;i<48000;i++){const y=.1*Math.sin(2*Math.PI*1000*i/48000);pcm.writeFloatLE(y,i*8);pcm.writeFloatLE(-y,i*8+4);}
    // Independently measured by unmodified upstream kit.bed_level on this signal.
    expect(launchBedLevel(pcm)).toBeCloseTo(-19.99,1);
    expect(launchBedLevel(Buffer.alloc(48000*8))).toBeNull();
    expect(launchBedLevel(Buffer.alloc(20))).toBeNull();
  });
  it('matches relative bed power math, caps hot single effects and preserves fallback',()=>{
    const role={bed_db:8.5,level_db:-8};
    expect(launchGain({peak_db:-1,l50_lufs:-15},role,-24)).toBeCloseTo(-1.16,1);
    expect(launchGain({peak_db:-1,l50_lufs:-40},role,-12)).toBe(0);
    expect(launchGain({peak_db:-1,l50_lufs:-15},role,null)).toBe(-8);
    expect(launchGain({peak_db:3,l50_lufs:1},{...role,level_db:0},null)).toBe(-4);
  });
  it('makes pre-hit editable music dips and recovers at each event',()=>{
    const points=launchStopPoints(10,-14,[2,5,5.2]);
    expect(points[0]).toEqual({time:0,value:-14});
    expect(points.find(p=>p.time===1.635)?.value).toBe(-23);
    expect(points.find(p=>p.time===2)?.value).toBe(-14);
    expect(points.find(p=>p.time===5)?.value).toBe(-23);
    expect(points.find(p=>p.time===5.2)?.value).toBe(-14);
    expect(points.at(-1)).toEqual({time:10,value:-14});
  });
  it('bundles complete clean upstream launch roles and 26 searchable additions with valid hashes',async()=>{
    const kit=JSON.parse(await readFile(join(kitFolder,'kit.lock.json'),'utf8'));
    expect(Object.keys(kit.roles).filter(k=>kit.roles[k])).toEqual(expect.arrayContaining([...LAUNCH_ROLES]));
    expect(kit.source).toMatchObject({commit:'591fa3e028032e6dce56620a20e932e35667e8d8',modelsLoaded:false});
    let takes=0;
    for(const role of Object.values(kit.roles).filter(Boolean) as any[])for(const take of role.takes){
      takes++;expect(take.checks).toEqual([]);expect(hash(await readFile(join(kitFolder,take.file)))).toBe(take.sha256);
      expect(take.peak_db).toBeLessThan(-.9);if(role.width!==undefined)expect(Math.abs(take.corr-role.width)).toBeLessThan(.051);
    }
    expect(takes).toBe(72);
    const short=kit.roles['whoosh.short'];
    const take={...short.takes[0],peak_s:.12};
    expect(launchPlace(take,{...short,align:'peak',offset_ms:37},1)).toBe(.917);
    const resources=await resourceLibrary(join(tmpdir(),'nonexistent-earshot-profile.json'),{action:'list',kind:'sounds',query:'earshot 0.4',limit:100},undefined,join(docs,'resources/sounds'));
    expect(resources.total).toBeGreaterThanOrEqual(26);
    const catalog=JSON.parse(await readFile(join(docs,'resources/sounds/catalog.json'),'utf8'));
    const old=JSON.parse(await readFile(join(docs,'resources/sounds/sources/earshot.json'),'utf8'));
    expect(catalog.entries.filter((e:any)=>e.provider==='Earshot')).toHaveLength(79);
    expect(old.files.filter((e:any)=>e.sourceCommit==='925ebe56a1b755e5d354ab642bb8f344440cfa9c')).toHaveLength(53);
  });
  it('prepares native clips with trim, deterministic takes, source insertion and undo; never changes composition automatically',async()=>{
    const root=await mkdtemp(join(tmpdir(),'syka-launch-native-'));
    try {
      const original='export default () => <scene><text>Original</text></scene>;\n';await writeFile(join(root,'index.tsx'),original);
      const tools=new WorkspaceTools(root,docs);
      const request={action:'create',duration:3,seed:27,cues:[{id:'early',role:'whoosh.short',seconds:0},{id:'one',role:'key',seconds:1},{id:'two',role:'key',seconds:1.03},{id:'end',role:'click.confirm',seconds:2.99}]};
      const result=await tools.call('syka_launch_audio',request) as any;
      const plan=JSON.parse(await readFile(join(root,result.plan),'utf8'));
      expect(await readFile(join(root,'index.tsx'),'utf8')).toBe(original);
      expect(plan.cues[0]).toMatchObject({start:0});expect(plan.cues[0].sourceIn).toBeGreaterThan(0);
      expect(plan.cues[2].audioCueSeconds).toBeCloseTo(1.087,3);
      expect(plan.cues.at(-1).end).toBeLessThanOrEqual(3);
      const second=await tools.call('syka_launch_audio',request) as any;
      expect(JSON.parse(await readFile(join(root,second.plan),'utf8')).cues).toEqual(plan.cues);
      const source=new SourceTools(root),read=await source.call('syka_read_source',{path:'index.tsx'}) as any;
      await source.call('syka_edit_source',{path:'index.tsx',expectedSha256:read.sha256,content:result.componentImport+'\nexport default () => <scene><text>Original</text>'+result.componentJSX+'</scene>;\n'});
      expect(await readFile(join(root,'index.tsx'),'utf8')).toContain('<EarshotLaunchAudio />');
      const component=await readFile(join(root,result.component),'utf8');expect(component.match(/<audio /g)).toHaveLength(4);expect(component).toContain('sourceIn={');
      expect(result.component.startsWith('components/')).toBe(true);
      const componentRead=await source.call('syka_read_source',{path:result.component}) as any;
      await source.call('syka_edit_source',{path:result.component,expectedSha256:componentRead.sha256,content:component.replace('Earshot ·','QA ·')});
      await undoSourceEdit({projectDir:root});expect(await readFile(join(root,result.component),'utf8')).toBe(component);
      await redoSourceEdit({projectDir:root});expect(await readFile(join(root,result.component),'utf8')).toContain('QA ·');
      await tools.close();
    }finally{await rm(root,{recursive:true,force:true});}
  });
  it.skipIf(!ffmpeg)('uses a real bed at its actual gain/trim and writes a single editable music track',async()=>{
    const root=await mkdtemp(join(tmpdir(),'syka-launch-bed-'));
    try {
      await mediaProcess(ffmpeg!,['-v','error','-f','lavfi','-i','sine=frequency=440:duration=5','-ac','2',join(root,'bed.wav')],100000);
      const result=await createLaunchAudio(root,docs,{action:'create',duration:3,seed:5,bed:'bed.wav',bedSourceIn:1,bedVolumeDb:-12,includeBed:true,stopDown:true,cues:[{id:'cut',role:'hit',seconds:1.5}]},{env}) as any;
      const plan=JSON.parse(await readFile(join(root,result.plan),'utf8'));
      expect(plan.cues[0].bedLufs).toBeLessThan(-20);expect(plan.musicEnvelope).not.toEqual([]);
      const component=await readFile(join(root,result.component),'utf8');expect(component.match(/<audio /g)).toHaveLength(2);expect(component).toContain('property="volume"');expect(component).toContain('time={2.5}');
      const low=await createLaunchAudio(root,docs,{action:'create',duration:3,seed:5,bed:'bed.wav',bedSourceIn:1,bedVolumeDb:-18,cues:[{id:'cut',role:'hit',seconds:1.5}]},{env}) as any;
      expect(low.cues[0].volume-result.cues[0].volume).toBeCloseTo(-6,1);
    }finally{await rm(root,{recursive:true,force:true});}
  },30000);
  it('rejects duplicate ids, dense runs, disabled models and cancelled work without creating output',async()=>{
    const root=await mkdtemp(join(tmpdir(),'syka-launch-invalid-'));
    try {
      await expect(createLaunchAudio(root,docs,{action:'create',duration:2,cues:[{id:'x',role:'key',seconds:1},{id:'x',role:'key',seconds:1.02}]})).rejects.toThrow('único');
      await expect(createLaunchAudio(root,docs,{action:'create',duration:2,cues:Array.from({length:6},(_,i)=>({id:'x'+i,role:'key',seconds:1+i*.001}))})).rejects.toThrow('denso');
      await expect(createLaunchAudio(root,docs,{action:'create',duration:2,stopDown:true,cues:[{id:'x',role:'hit',seconds:1}]})).rejects.toThrow('includeBed');
      await expect(createLaunchAudio(root,docs,{action:'create',duration:2,cues:[{id:'x',role:'hit',seconds:1}]},undefined,AbortSignal.abort())).rejects.toThrow();
      const status=await optionalEarshotAnalysis(root,{action:'status'},{env:{SYKA_EARSHOT_PYTHON:''}});expect(status).toMatchObject({modelsLoaded:false,automaticDownloads:false});
      await expect(optionalEarshotAnalysis(root,{action:'rank',sources:['missing.wav'],query:'soft'})).rejects.toThrow('useModels');
      await expect(optionalEarshotAnalysis(root,{action:'rank',useModels:true,sources:['missing.wav'],query:'soft'},{env:{SYKA_EARSHOT_PYTHON:''}})).rejects.toThrow('no configurado');
      expect(await readdir(root)).toEqual([]);
      expect(WORKSPACE_TOOLS.map(t=>t.name)).toEqual(expect.arrayContaining(['syka_launch_audio','syka_earshot_analyze']));
    }finally{await rm(root,{recursive:true,force:true});}
  });
});
