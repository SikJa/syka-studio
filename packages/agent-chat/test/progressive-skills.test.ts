import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceTools, WORKSPACE_TOOLS } from '../src/host/workspace-tools';
import type { TextReadOptions, TextReadResult } from '../src/host/bounded-text';

let fixture: string, project: string, docs: string, skill: string, tools: WorkspaceTools;
const live: WorkspaceTools[] = [];
const body = '---\nname: fixture-motion\ndescription: Native editing fixture\n---\n# Motion\n\n## Contract\nPreserve originals and verify actual edits.\n\n## Brief\nAsk only unresolved production decisions.\n\n## Build\nBuild the native editable motion here.\n\n## Review\nCheck the changed frame and real playback.\n';
const manifest = {
  version: 1, required: ['contract'], sections: [
    { id: 'contract', heading: 'Contract' },
    { id: 'brief', heading: 'Brief' },
    { id: 'build', heading: 'Build', dependencies: [{ name: 'never-auto-load', sectionId: 'build', when: 'Only if the user needs this technique' }] },
    { id: 'review', heading: 'Review' },
  ],
};
const createTools = (personal?: string) => {
  const result = new WorkspaceTools(project, docs, personal, join(fixture, 'catalog.json'));
  live.push(result); return result;
};
beforeEach(async () => {
  fixture = await mkdtemp(join(tmpdir(), 'syka-progressive-skills-')); project = join(fixture, 'project');
  docs = join(fixture, 'docs'); skill = join(docs, 'skills', 'fixture-motion');
  await mkdir(project); await mkdir(skill, { recursive: true });
  await writeFile(join(skill, 'SKILL.md'), body); await writeFile(join(skill, 'syka-sections.json'), JSON.stringify(manifest));
  tools = createTools();
});
afterEach(async () => {
  await Promise.all(live.splice(0).map(instance => instance.close()));
  await rm(fixture, { recursive: true, force: true });
});

describe('bundled skill sections', () => {
  it('loads the mandatory contract and index without eagerly loading later production stages', async () => {
    const read = await tools.call('syka_skills', { action: 'read', path: skill }) as {content:string;loadedSections:string[];omittedSections:string[];next:unknown};
    expect(read.content).toContain('Preserve originals');
    expect(read.content).not.toContain('Ask only unresolved');
    expect(read.content).not.toContain('Build the native');
    expect(read.content).not.toContain('Check the changed');
    expect(read.loadedSections).toEqual(['contract']);
    expect(read.omittedSections).toEqual(['brief','build','review']);
    expect(read.next).toBeNull();
    expect(JSON.stringify(read).length).toBeLessThanOrEqual(24_000);
  });

  it('includes the contract with the selected stage and returns conditional dependencies without following them', async () => {
    for (const selection of [{ mode: 'section', sectionId: 'build' }, { phase: 'build' }]) {
      const read = await tools.call('syka_skills', { action: 'read', path: skill, ...selection }) as { content:string; loadedSections:string[]; dependencies:unknown[]; next:unknown };
      expect(read.loadedSections).toEqual(['contract', 'build']);
      expect(read.content).toContain('Preserve originals'); expect(read.content).toContain('Build the native');
      expect(read.content).not.toContain('Ask only unresolved'); expect(read.content).not.toContain('Check the changed');
      expect(read.dependencies).toEqual(manifest.sections[2]!.dependencies);
      expect(read.next).toBeNull();
    }
    const nextChat = createTools();
    const read = await nextChat.call('syka_skills', { action:'read', path:skill, phase:'review' }) as { content:string };
    expect(read.content).toContain('Preserve originals'); expect(read.content).toContain('Check the changed');
    expect(read.content).not.toContain('Build the native');
  });

  it('applies the same opt-in contract through canonical filename aliases', async () => {
    const first = await tools.call('syka_skills', { action:'read', path:skill });
    expect(await tools.call('syka_skills', { action:'read', path:skill, file:'./SKILL.md' })).toEqual(first);
    await expect(tools.call('syka_skills', { action:'read', path:skill, phase:'build', sectionId:'review' })).rejects.toThrow(/phase/);
    await expect(tools.call('syka_skills', { action:'read', path:skill, phase:'build', endOffset:30 })).rejects.toThrow();
  });

  it('never truncates a required contract to fit the budget', async () => {
    const long = body.replace('Preserve originals and verify actual edits.', 'MANDATORY '.repeat(3000));
    await writeFile(join(skill, 'SKILL.md'), long);
    await expect(tools.call('syka_skills', { action:'read', path:skill })).rejects.toThrow(/mandatory instructions were truncated/);
    const read = await tools.call('syka_skills', { action:'read', path:skill, maxChars:96_000 }) as {content:string;coverage:unknown};
    expect(read.content.match(/MANDATORY /g)).toHaveLength(3000);
    expect(read.coverage).toMatchObject({ mandatoryComplete:true, selectedComplete:true });
    expect(JSON.stringify(read).length).toBeLessThanOrEqual(96_000);
  });

  it('invalidates a changed manifest and refuses missing, duplicate or nested section mappings', async () => {
    await tools.call('syka_skills', { action:'read', path:skill });
    await writeFile(join(skill, 'syka-sections.json'), JSON.stringify({ ...manifest, required:['missing-section'] }));
    await expect(tools.call('syka_skills', { action:'read', path:skill })).rejects.toThrow(/required/);
    await writeFile(join(skill, 'syka-sections.json'), JSON.stringify(manifest));
    await writeFile(join(skill, 'SKILL.md'), body + '\n## Build\nAmbiguous section\n');
    await expect(tools.call('syka_skills', { action:'read', path:skill })).rejects.toThrow(/ambiguous/);
    await writeFile(join(skill, 'SKILL.md'), body.replace('## Contract', '# Contract'));
    await expect(tools.call('syka_skills', { action:'read', path:skill })).rejects.toThrow(/overlap/);
  });

  it('rejects a manifest redirected outside its configured root', async () => {
    const outside = join(fixture, 'outside'); await mkdir(outside);
    await writeFile(join(outside, 'syka-sections.json'), JSON.stringify(manifest));
    const otherSkill = join(docs, 'skills', 'redirected'); await mkdir(otherSkill);
    await writeFile(join(otherSkill, 'SKILL.md'), body);
    // A junction directory redirects the manifest lookup out of docs/skills.
    await symlink(outside, join(otherSkill, 'linked'), 'junction');
    await expect(tools.call('syka_skills', { action:'read', path:otherSkill, file:'linked/syka-sections.json' })).rejects.toThrow(/outside/);
  });
});

describe('legacy skills and file compatibility', () => {
  it('keeps an external skill complete even when a sidecar with the same filename exists', async () => {
    const external = join(project, '.agents', 'skills', 'imported'); await mkdir(external, { recursive:true });
    const full = body + 'External required instructions.\n'.repeat(1500);
    await writeFile(join(external, 'SKILL.md'), full);
    await writeFile(join(external, 'syka-sections.json'), JSON.stringify(manifest));
    const read = await tools.call('syka_skills', { action:'read', path:external }) as {content:string;coverage:unknown};
    expect(read.content).toBe(full); expect(read.coverage).toMatchObject({ fullFile:true });
    expect(JSON.stringify(read).length).toBeLessThanOrEqual(96_000);
    await expect(tools.call('syka_skills', { action:'read', path:external, phase:'build' })).rejects.toThrow(/no bundled section/);
  });

  it('refuses an implicit partial external read and lets explicit pages reconstruct it', async () => {
    const external = join(project, '.agents', 'skills', 'large'); await mkdir(external, { recursive:true });
    const content = '# Imported\r\n' + 'Conservar esta instrucción 😀.\r\n'.repeat(4000);
    await writeFile(join(external, 'SKILL.md'), content);
    await expect(tools.call('syka_skills', { action:'read', path:external })).rejects.toThrow(/Complete skill exceeds/);
    let args:TextReadOptions={mode:'range'}, collected='';
    for(let count=0;count<30;count++) {
      const page=await tools.call('syka_skills',{action:'read',path:external,...args}) as TextReadResult;
      collected+=page.content;
      if(!page.next)break;
      args=page.next as TextReadOptions;
    }
    expect(collected).toBe(content);
  });

  it('does not allow a partial personal-skill read to replace unread instructions', async () => {
    const personal = join(fixture, 'profile', 'skills'); await mkdir(personal, {recursive:true});
    const writer = createTools(personal);
    const created = await writer.call('syka_skills', {action:'create',name:'fixture-personal',content:body}) as {path:string;revision:string};
    const path=join(personal,'fixture-personal');
    await writer.call('syka_skills', {action:'read',path,mode:'section',sectionId:'contract'});
    await expect(writer.call('syka_skills',{action:'save',name:'fixture-personal',revision:created.revision,content:'discard unread rules'})).rejects.toThrow(/partial skill/);
    expect(await readFile(created.path,'utf8')).toBe(body);
    await writer.call('syka_skills',{action:'read',path});
    const updated = body.replace('Build the native', 'Update the native');
    await writer.call('syka_skills',{action:'save',name:'fixture-personal',revision:created.revision,content:updated});
    const otherChat=createTools(personal);
    expect(await otherChat.call('syka_skills',{action:'read',path})).toMatchObject({content:updated});
  });

  it('retains revision-only save compatibility when a recreated tool has no local coverage record', async () => {
    const personal=join(fixture,'profile','skills'); await mkdir(personal,{recursive:true});
    const first=createTools(personal);
    const created=await first.call('syka_skills',{action:'create',name:'legacy-save',content:body}) as {path:string;revision:string};
    const recreated=createTools(personal),updated=body+'\nApproved new instruction.\n';
    await recreated.call('syka_skills',{action:'save',name:'legacy-save',revision:created.revision,content:updated});
    expect(await readFile(created.path,'utf8')).toBe(updated);
    await expect(first.call('syka_skills',{action:'save',name:'legacy-save',revision:created.revision,content:body})).rejects.toThrow(/cambió/);
  });

  it('keeps legacy character offsets while enforcing bounded serialized file results', async () => {
    await writeFile(join(project,'text.md'),'0123456789');
    expect(await tools.call('syka_files',{action:'read',path:'text.md',offset:2,length:3})).toMatchObject({content:'234',nextOffset:5});
    await expect(tools.call('syka_files',{action:'read',path:'text.md',length:96_001})).rejects.toThrow(/96000/);
    await expect(tools.call('syka_files',{action:'read',path:'text.md',offset:1,startLine:1})).rejects.toThrow(/not both/);
    const recipeSchema=WORKSPACE_TOOLS.find(tool=>tool.name==='syka_editing_recipe')!.inputSchema as {properties:Record<string,unknown>};
    expect(recipeSchema.properties.action).toMatchObject({enum:['read','summary','save']});
    expect(recipeSchema.properties.maxChars).toMatchObject({maximum:96_000});
  });
});
