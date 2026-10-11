import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {mkdtemp,mkdir,readFile,rm,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {WorkspaceTools} from '../src/host/workspace-tools';
import {revealTiming} from '../../../docs/skills/syka-motion-transitions/examples/motion-timing';
let fixture:string;let tools:WorkspaceTools;
beforeEach(async()=>{fixture=await mkdtemp(join(tmpdir(),'syka-workspace-test-'));tools=new WorkspaceTools(fixture);});
afterEach(async()=>{await rm(fixture,{recursive:true,force:true});});
describe('project workspace capabilities',()=>{
  it('discovers the bundled workflows and reads their executable support files',async()=>{
    const bundled=new WorkspaceTools(fixture,resolve(import.meta.dirname,'../../../docs'));
    const result=await bundled.call('syka_skills',{action:'list'}) as {skills:{name:string;path:string}[]};
    for(const name of ['syka-editing-basics','syka-captions','syka-local-audio','syka-motion-reference','syka-motion-direction','syka-motion-transitions','syka-edit-review','syka-visual-direction','syka-media-use','syka-explainer-edit','syka-faceless-explainer','syka-music-video','syka-pr-to-video','syka-slideshow','syka-motion-brief','syka-motion-reels','syka-motion-storyboard','syka-motion-typography','syka-camera-3d-captions']){
      const skill=result.skills.find(s=>s.name===name);expect(skill,name).toBeDefined();
      expect(await bundled.call('syka_skills',{action:'read',path:skill!.path})).toMatchObject({content:expect.stringContaining('name: '+name)});
    }
    const audio=result.skills.find(s=>s.name==='syka-local-audio')!;
    expect(await bundled.call('syka_skills',{action:'read',path:audio.path,file:'scripts/synthesize.py'})).toMatchObject({content:expect.stringContaining('import wave')});
    const motion=result.skills.find(s=>s.name==='syka-motion-transitions')!;
    const production=result.skills.find(s=>s.name==='syka-motion-direction')!;
    const prompt=await bundled.call('syka_skills',{action:'read',path:production.path,file:'references/production-prompt.md'}) as {content:string};
    expect(prompt.content).toBe(await readFile(join(production.path,'references/production-prompt.md'),'utf8'));
    for(const file of ['references/native-motion.md','examples/NativeReveal.tsx','examples/motion-timing.ts']){
      const support=await bundled.call('syka_skills',{action:'read',path:motion.path,file}) as {content:string};
      expect(support.content).toBe(await readFile(join(motion.path,file),'utf8'));
    }
    const direction=result.skills.find(s=>s.name==='syka-visual-direction')!;
    for(const file of ['references/frame-template.md','references/prompt-guide.md']){
      const support=await bundled.call('syka_skills',{action:'read',path:direction.path,file}) as {content:string};
      expect(support.content).toBe(await readFile(join(direction.path,file),'utf8'));
    }
  });
  it('creates a reusable component and never overwrites it',async()=>{
    await tools.call('syka_files',{action:'create',path:'components/Title.tsx',content:'export const Title = () => <text>Hola</text>;'});
    expect(await readFile(join(fixture,'components/Title.tsx'),'utf8')).toContain('Hola');
    await expect(tools.call('syka_files',{action:'create',path:'components/Title.tsx',content:'wrong'})).rejects.toThrow();
    expect(await tools.call('syka_files',{action:'list',path:'components'})).toMatchObject({entries:[{name:'Title.tsx'}]});
  });
  it('reads YAML assets and paginates large text without losing content',async()=>{
    await writeFile(join(fixture,'assets.yml'),'0123456789');
    expect(await tools.call('syka_files',{action:'read',path:'assets.yml',offset:2,length:3})).toMatchObject({content:'234',nextOffset:5});
    await expect(tools.call('syka_files',{action:'read',path:'assets.yml',offset:-1})).rejects.toThrow();
  });
  it('creates, discovers and reads a project skill and support file',async()=>{
    await tools.call('syka_files',{action:'create',path:'.agents/skills/reels/SKILL.md',content:'---\nname: reels\ndescription: Edit reels\n---\nUse captions.'});
    await tools.call('syka_files',{action:'create',path:'.agents/skills/reels/template.tsx',content:'export default () => <text>Reel</text>;'});
    const result=await tools.call('syka_skills',{action:'list'}) as {skills:{path:string}[]};
    expect(result.skills.some(s=>s.path===join(fixture,'.agents/skills/reels'))).toBe(true);
    expect(await tools.call('syka_skills',{action:'read',path:'.agents/skills/reels',file:'template.tsx'})).toMatchObject({content:'export default () => <text>Reel</text>;'});
  });
  it('rejects paths outside the project or skill roots',async()=>{
    await expect(tools.call('syka_files',{action:'create',path:'../outside.txt',content:'no'})).rejects.toThrow();
    await mkdir(join(fixture,'unrelated'));
    await writeFile(join(fixture,'unrelated','SKILL.md'),'no');
    await expect(tools.call('syka_skills',{action:'read',path:join(fixture,'unrelated')})).rejects.toThrow();
  });
});

describe('native motion example timing',()=>{
  it('preserves the requested reveal and exit for a long clip',()=>{
    expect(revealTiming(4)).toEqual({inEnd:0.5,outStart:3.8,duration:4});
  });
  it('keeps a reading interval even when requested motion exceeds the clip',()=>{
    for(const duration of [1/30,0.1,0.5,2]){
      const t=revealTiming(duration,0.8,0.5);
      expect(t.inEnd).toBeGreaterThanOrEqual(0);
      expect(t.outStart-t.inEnd).toBeGreaterThanOrEqual(duration*0.4-1e-9);
      expect(t.outStart).toBeLessThanOrEqual(duration);
    }
  });
  it('keeps staggered lines aligned to a common exit in scene time',()=>{
    const end=3.8;
    const a=revealTiming(end-0.2);
    const b=revealTiming(end-(0.2+2/30));
    expect(0.2+a.outStart).toBeCloseTo(0.2+2/30+b.outStart);
  });
  it('rejects invalid times before authoring an unusable track',()=>{
    for(const duration of [0,-1,NaN,Infinity])expect(()=>revealTiming(duration)).toThrow(RangeError);
    expect(()=>revealTiming(4,-0.5)).toThrow(RangeError);
    expect(()=>revealTiming(4,0.5,Infinity)).toThrow(RangeError);
  });
});

describe('skill reads by unique name',()=>{
  const skillName='syka-test-unique-workspace-motion';
  async function createSkill(root='.agents/skills'){
    const path=join(fixture,root,skillName);
    await mkdir(join(path,'references'),{recursive:true});
    await writeFile(join(path,'SKILL.md'),'---\nname: '+skillName+'\ndescription: Test workflow\n---\nNative timeline');
    await writeFile(join(path,'references','timing.md'),'Source-local timing');
    return path;
  }
  it('reads the entrypoint and support file with the same results as explicit path',async()=>{
    const path=await createSkill();
    for(const file of [undefined,'references/timing.md']){
      const named=await tools.call('syka_skills',{action:'read',name:skillName,file});
      expect(named).toEqual(await tools.call('syka_skills',{action:'read',path,file}));
    }
  });
  it('explains how to recover from a missing identifier or unknown name',async()=>{
    await expect(tools.call('syka_skills',{action:'read'})).rejects.toThrow('requires path or name');
    await expect(tools.call('syka_skills',{action:'read',name:skillName})).rejects.toThrow('not found in configured roots');
  });
  it('requires an explicit path for duplicate names and honors it when supplied',async()=>{
    const first=await createSkill();
    const second=await createSkill('.codex/skills');
    const request=tools.call('syka_skills',{action:'read',name:skillName});
    await expect(request).rejects.toThrow('ambiguous');
    await expect(request).rejects.toThrow(first);
    await expect(request).rejects.toThrow(second);
    expect(await tools.call('syka_skills',{action:'read',name:skillName,path:second})).toMatchObject({path:join(second,'SKILL.md')});
  });
  it('does not count the same file twice when configured roots overlap',async()=>{
    const path=await createSkill();
    const overlapping=new WorkspaceTools(fixture,undefined,path);
    expect(await overlapping.call('syka_skills',{action:'read',name:skillName})).toMatchObject({path:join(path,'SKILL.md')});
  });
  it('reads a legacy bundled Markdown skill using its listed filename',async()=>{
    const docs=join(fixture,'docs');
    await mkdir(join(docs,'skills'),{recursive:true});
    await writeFile(join(docs,'skills','test-motion-guide.md'),'Guide contents');
    const bundled=new WorkspaceTools(fixture,docs);
    expect(await bundled.call('syka_skills',{action:'read',name:'test-motion-guide.md'})).toMatchObject({content:'Guide contents'});
  });
  it('rejects names used as paths and support-file traversal',async()=>{
    await createSkill();
    await writeFile(join(fixture,'outside.md'),'Do not read');
    for(const name of ['../'+skillName,'..\\'+skillName,'.','C:'+skillName]){
      await expect(tools.call('syka_skills',{action:'read',name})).rejects.toThrow('not a path');
    }
    await expect(tools.call('syka_skills',{action:'read',name:skillName,file:'../../../outside.md'})).rejects.toThrow('inside the named skill directory');
  });
  it('resolves junctions before reading by name or explicit path',async()=>{
    const path=await createSkill();
    const outside=join(fixture,'outside');
    await mkdir(outside);
    await writeFile(join(outside,'secret.md'),'Do not read');
    await symlink(outside,join(path,'redirect'),'junction');
    for(const selector of [{name:skillName},{path}]){
      await expect(tools.call('syka_skills',{action:'read',...selector,file:'redirect/secret.md'})).rejects.toThrow('outside configured roots');
    }
  });
});
