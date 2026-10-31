import {describe, expect, it} from 'vitest';
import {readFile, readdir, stat} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {chatInstructions, withAttachments} from '../src/host/harness';
import {AUDIOVISUAL_CONTRACT} from '../src/host/audiovisual-contract';
import {REFERENCE_LINK_INSTRUCTIONS} from '../src/host/reference-intent';
import {TASK_MODULES} from '../src/host/task-modules';
import {readTextSnapshot} from '../src/host/bounded-text';
import {readBundledSkill} from '../src/host/skill-sections';

const docs = resolve('docs/skills');
const nativeSkills = async () => {
  const directories = (await readdir(docs,{withFileTypes:true})).filter(entry=>entry.isDirectory());
  const result:string[]=[];
  for(const entry of directories) {
    try { await stat(join(docs,entry.name,'syka-sections.json')); result.push(entry.name); }
    catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error; }
  }
  return result.sort();
};

describe('progressive task guidance',()=>{
  it('keeps the audiovisual boundary and reference contract once while separating phase guidance',()=>{
    const instructions=chatInstructions('PROJECT_ROOT','Conservá el verde aprobado.');
    expect(instructions).toContain('PROJECT_ROOT');
    expect(instructions).toContain('Conservá el verde aprobado.');
    expect(instructions.split(AUDIOVISUAL_CONTRACT)).toHaveLength(2);
    expect(instructions.split(REFERENCE_LINK_INSTRUCTIONS)).toHaveLength(2);
    expect(instructions).toContain('apply the requested change');
    expect(instructions).toContain('Only deliver planning when the user requested planning');
    expect(instructions).toContain('preview playback');
    expect(instructions).toContain('Export belongs to the user');
    expect(instructions).toContain('syka_patch_source');
    expect(instructions).toContain('A small correction uses the source and existing decisions, not all phases');
    expect(instructions).toContain('Do not reread a full brief, recipe, production prompt or workflow');
    expect(instructions).toContain('Store a new inference as proposed, not as a user answer');
    // Raised from 13 000 for the gate and quoted-path rules found missing in a real run.
    expect(instructions.length).toBeLessThan(13_400);
    const prompt=withAttachments('Usá la tipografía de este archivo',['C:/reference.png']);
    expect(prompt).toContain('C:/reference.png');
    expect(prompt).not.toContain(REFERENCE_LINK_INSTRUCTIONS);
  });

  it('keeps every advertised native module and specialized route available',async()=>{
    const moduleIndex=await readFile(join(docs,'syka-editing-basics','references','task-modules.md'),'utf8');
    const names=new Set([...TASK_MODULES.map(([name])=>name),...[...moduleIndex.matchAll(/`(syka-[a-z0-9-]+)`/g)].map(match=>match[1]!)]);
    for(const name of names){
      expect((await stat(join(docs,name,'SKILL.md'))).isFile(),name).toBe(true);
      expect((await stat(join(docs,name,'syka-sections.json'))).isFile(),name).toBe(true);
    }
    expect(moduleIndex).toContain('24.000'); expect(moduleIndex).toContain('96.000');
    expect(moduleIndex).toContain('no demuestra que tu modelo haya');
  });

  it('returns complete mandatory instructions and the chosen phase for every segmented native skill',async()=>{
    const names=await nativeSkills(); expect(names.length).toBeGreaterThanOrEqual(28);
    for(const name of names){
      const snapshot=await readTextSnapshot(docs,join(docs,name,'SKILL.md'));
      const orientation=await readBundledSkill(snapshot,{},{});
      expect(orientation,name).toMatchObject({mode:'outline',loadedSections:['contract'],coverage:{mandatoryComplete:true,selectedComplete:true},omittedSections:['brief','build','review']});
      expect(JSON.stringify(orientation).length,name).toBeLessThanOrEqual(24_000);
      for(const phase of ['brief','build','review']){
        const result=await readBundledSkill(snapshot,{mode:'section',sectionId:phase},{});
        expect(result,name+'/'+phase).toMatchObject({loadedSections:['contract',phase],coverage:{mandatoryComplete:true,selectedComplete:true}});
        const content=String(result?.content);
        const contract=snapshot.sections.find(section=>section.heading==='Contract')!;
        const selected=snapshot.sections.find(section=>section.heading===phase[0]!.toUpperCase()+phase.slice(1))!;
        expect(content,name+'/'+phase).toContain(snapshot.content.slice(contract.startOffset,contract.endOffset));
        expect(content,name+'/'+phase).toContain(snapshot.content.slice(selected.startOffset,selected.endOffset));
        expect(content,name+'/'+phase).toContain('Una corrección puntual reutiliza decisiones vigentes');
        expect(JSON.stringify(result).length,name+'/'+phase).toBeLessThanOrEqual(24_000);
      }
      const manifest=JSON.parse(await readFile(join(docs,name,'syka-sections.json'),'utf8'));
      for(const section of manifest.sections){
        for(const dep of section.dependencies??[]){
          expect(dep.when?.length,name+'/'+section.id).toBeGreaterThan(0);
          expect((await stat(join(docs,dep.name,dep.file??'SKILL.md'))).isFile(),dep.name+'/'+(dep.file??'SKILL.md')).toBe(true);
          // A dependency remains a suggestion; it is never inlined in an orientation response.
          expect((orientation?.loadedSections as string[]).every(id=>id==='contract')).toBe(true);
        }
      }
    }
  });

  it('preserves media, timing, provenance and bounded-repair requirements in the relevant native guides',async()=>{
    const read=(name:string)=>readFile(join(docs,name,'SKILL.md'),'utf8');
    expect(await read('syka-captions')).toContain('timestamps reales');
    const audio=await read('syka-local-audio');
    expect(audio).toContain('Mixkit'); expect(audio).toContain('licencias diferentes');
    expect(audio).toContain('medición'); expect(audio).toContain('síntesis local');
    const video=await read('syka-video-references');
    expect(video).toContain('action: read'); expect(video).toContain('No afirmes haber escuchado');
    const scope=chatInstructions('PROJECT_ROOT');
    expect(scope).toContain('Preview, worker, compiler, transcription or tool failure changes verification status');
    expect(scope).toContain('Current explicit user corrections take precedence');
    expect(scope).toContain('Do not use Diffusion cloud accounts, credits or paid model APIs');
  });
});
