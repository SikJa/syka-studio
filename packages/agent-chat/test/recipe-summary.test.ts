import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { editingRecipe, summarizeEditingRecipe, type EditingRecipe } from '../src/host/editing-recipe';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, {recursive:true, force:true}); });
const recipe: EditingRecipe = {version:1,label:'Motion',format:'general',objective:'Corregir el título sin cambiar el video',decisions:['Conservar el encuadre','Música aprobada, no reemplazar'],references:['reference.png'],review:['Revisar legibilidad'],skill:'syka-motion-direction'};

it('returns exact decisions without fetching unrelated references or review prose into context', () => {
  const result = summarizeEditingRecipe(recipe);
  expect(result.items.map(item=>item.text)).toEqual(recipe.decisions);
  expect(result.counts).toEqual({decisions:2,references:1,review:1});
  expect(result.complete).toBe(true);
  expect(result).not.toHaveProperty('references');
  expect(result).not.toHaveProperty('recipe');
  expect(summarizeEditingRecipe(recipe,{section:'references'}).items).toEqual([{index:0,text:'reference.png'}]);
});

it('pages long decisions exactly without silently dropping or summarizing a constraint', () => {
  const long = {...recipe,decisions:Array.from({length:40},(_,index)=>`${index}: ${'ñ'.repeat(1900)}`)};
  let offset=0; const all:string[]=[];
  while(true) {
    const page=summarizeEditingRecipe(long,{offset});
    expect(JSON.stringify(page).length).toBeLessThanOrEqual(24_000);
    all.push(...page.items.map(item=>item.text));
    if(page.nextOffset===null) break;
    expect(page.nextOffset).toBeGreaterThan(offset); offset=page.nextOffset;
  }
  expect(all).toEqual(long.decisions);
  expect(summarizeEditingRecipe(long,{maxChars:96_000}).complete).toBe(true);
  expect(()=>summarizeEditingRecipe(long,{maxChars:96_001})).toThrow();
  expect(()=>summarizeEditingRecipe(long,{offset:41})).toThrow();
});

it('reads persisted project knowledge across callers and returns fresh revision after a change', async () => {
  const root = await mkdtemp(join(tmpdir(),'syka-recipe-summary-')); roots.push(root);
  const missing = await editingRecipe(root,{action:'summary'});
  expect(missing).toMatchObject({summary:null,revision:null});
  const first = await editingRecipe(root,{action:'save',recipe,revision:null});
  const before = await readFile(join(root,'.syka','editing-recipe.json'),'utf8');
  const summary = await editingRecipe(root,{action:'summary'});
  expect(summary).toMatchObject({revision:first.revision,summary:{items:[{index:0,text:recipe.decisions[0]},{index:1,text:recipe.decisions[1]}]}});
  expect(await readFile(join(root,'.syka','editing-recipe.json'),'utf8')).toBe(before);
  const nextRecipe={...recipe, decisions:['Ahora conservar también el logo']};
  const next = await editingRecipe(root,{action:'save',recipe:nextRecipe,revision:first.revision});
  const current = await editingRecipe(root,{action:'summary'});
  expect(current.revision).toBe(next.revision); expect(current.revision).not.toBe(first.revision);
  expect(current).toMatchObject({summary:{items:[{index:0,text:nextRecipe.decisions[0]}]}});
  await expect(editingRecipe(root,{action:'save',recipe,revision:first.revision})).rejects.toThrow('Recipe changed');
});
