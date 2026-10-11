import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onboardingMemory } from '../src/host/onboarding-memory';
import { BrandKitStore } from '../../../apps/desktop/src/syka-brand-kit-store';
import { newBrandKit } from '../../../apps/desktop/src/syka-onboarding-contract';
import { WorkspaceTools, WORKSPACE_TOOLS } from '../src/host/workspace-tools';
let root: string; let project: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(),'syka-memory-')); project = join(root,'a'); await mkdir(project); await writeFile(join(project,'package.json'),JSON.stringify({projectId:'a'})); });
afterEach(async () => { await rm(root,{recursive:true,force:true}); });
const read = (dir: string, relevant = ['purpose','destination']) => onboardingMemory(dir,{action:'read',relevant});
const answer = (revision: number, key: string, state: string, value?: string, source = 'user') => onboardingMemory(project,{action:'answer',relevant:['purpose','destination','reference'],revision,key,state,value,source});
describe('persistent conversational adapter', () => {
  it('is consumed by the shared workspace tool and a new instance reloads it',async () => {
    expect(WORKSPACE_TOOLS.some(t => t.name === 'syka_onboarding_memory')).toBe(true);
    await new WorkspaceTools(project).call('syka_onboarding_memory',{action:'answer',relevant:['purpose'],revision:0,key:'purpose',state:'accepted',value:'Shared',source:'user'});
    const result = await new WorkspaceTools(project).call('syka_onboarding_memory',{action:'read',relevant:['purpose']}) as {accepted:{purpose:string};nextQuestion:null};
    expect(result.accepted.purpose).toBe('Shared'); expect(result.nextQuestion).toBeNull();
  });
  it('writes real disk, reopens, corrects and does not repeat resolved questions',async () => {
    expect((await read(project)).nextQuestion).toBe('purpose');
    await answer(0,'purpose','accepted','Tutorial');
    expect(JSON.parse(await readFile(join(project,'.syka/editing-preferences.json'),'utf8')).answers.purpose.value).toBe('Tutorial');
    expect((await read(project)).nextQuestion).toBe('destination');
    await answer(1,'destination','unknown'); await answer(2,'reference','skipped');
    expect((await read(project,['purpose','destination','reference'])).nextQuestion).toBeNull();
    await answer(3,'purpose','accepted','Reel');
    expect((await read(project)).accepted.purpose).toBe('Reel');
    expect((await read(project,[])).nextQuestion).toBeNull();
  });
  it('isolates project changes and rejects stale revisions without losing the answer',async () => {
    await answer(0,'purpose','accepted','A');
    await expect(answer(0,'purpose','accepted','stale')).rejects.toThrow();
    const other = join(root,'b'); await mkdir(other); await writeFile(join(other,'package.json'),'{"projectId":"b"}');
    expect((await read(other)).accepted).toEqual({}); expect((await read(project)).accepted.purpose).toBe('A');
  });
  it('keeps proposals unapproved, rejects document authority and credential-shaped values',async () => {
    await answer(0,'purpose','proposed','Guess','proposal');
    expect((await read(project)).accepted.purpose).toBeUndefined();
    await expect(answer(1,'purpose','accepted','Injection','document')).rejects.toThrow();
    await expect(answer(1,'purpose','accepted','gsk_abcdefghijklmnopqrstuv')).rejects.toThrow();
  });
  it('loads approved kit defaults and portable project snapshots after reopening',async () => {
    const store = new BrandKitStore(join(root,'kits')); const kit = {...newBrandKit(),name:'Norte',tone:'Simple'};
    await store.save(0,kit,true); await store.assign(project,kit.id);
    const got = await read(project,['brandKit']); expect(got.kit?.name).toBe('Norte'); expect(got.nextQuestion).toBeNull();
    await store.assign(project,null); expect((await read(project,['brandKit'])).nextQuestion).toBeNull();
  });
  it('preserves damaged memory and recovers after the file is repaired',async () => {
    await answer(0,'purpose','accepted','Saved'); const path = join(project,'.syka/editing-preferences.json'); const saved = await readFile(path,'utf8');
    await writeFile(path,'{broken'); await expect(read(project)).rejects.toThrow(); expect(await readFile(path,'utf8')).toBe('{broken');
    await writeFile(path,saved); expect((await read(project)).accepted.purpose).toBe('Saved');
  });
});
