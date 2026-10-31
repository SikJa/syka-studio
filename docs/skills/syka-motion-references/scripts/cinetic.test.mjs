import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { rankLibrary, retrieveLibrary } from './library.mjs';

const catalog = JSON.parse(await readFile(new URL('../references/cinetic-index.json',import.meta.url),'utf8'));
test('all pinned techniques have attributable text, integrity and no renderer requirement', async () => {
  assert.equal(catalog.entries.length,273);
  assert.equal(new Set(catalog.entries.map(row=>row.id)).size,273);
  assert.equal(new Set(catalog.entries.map(row=>row.techniqueCategory)).size,14);
  for (const row of catalog.entries) {
    const content = await readFile(new URL('../'+row.bundledTextPath,import.meta.url));
    assert.equal(createHash('sha256').update(content).digest('hex'),row.bundledTextSha256);
    assert.equal(row.bundledTextLicense,'MIT');
    assert.match(content.toString(),/Syka adaptation:/);
    assert.equal(row.reviewed,false);
  }
});
test('format, energy and role select useful native candidates within a compact output', async () => {
  const result = await retrieveLibrary({query:'Cinetic producto lanzamiento',collection:'cinetic',techniqueFormat:'launch',energy:'medium',techniqueRole:'workhorse',limit:3});
  assert.equal(result.results.length,3);
  assert.ok(result.results.every(row=>row.collection==='cinetic' && row.techniqueRole==='workhorse' && ['medium','any'].includes(row.energy) && (row.techniqueFormat.includes('launch') || row.techniqueFormat.includes('any'))));
  assert.ok(result.results.every(row=>!row.sourceText && row.sourceAccessible));
  assert.ok(JSON.stringify(result,null,2).length+1<=4000);
  const chosen = await retrieveLibrary({id:result.results[0].id,includeText:true,textLength:256});
  assert.equal(chosen.results[0].sourceTextLicense,'MIT');
  const next = await retrieveLibrary({id:result.results[0].id,includeText:true,textLength:256,textOffset:chosen.results[0].nextTextOffset});
  assert.equal(chosen.results[0].sourceText+next.results[0].sourceText,(await readFile(chosen.results[0].sourcePath,'utf8')).slice(0,512));
});
test('recent selections yield fresh relevant alternatives while an exact choice remains readable', async () => {
  const options = {query:'Cinetic tipografia texto',collection:'cinetic',limit:3,seed:27};
  const first = await retrieveLibrary(options);
  const recentIds = first.results.map(row=>row.id);
  const second = await retrieveLibrary({...options,recentIds});
  assert.ok(second.results.length>=2 && second.results.length<=3);
  assert.ok(second.results.every(row=>!recentIds.includes(row.id)));
  assert.deepEqual((await retrieveLibrary(options)).results,first.results);
  assert.equal((await retrieveLibrary({id:recentIds[0],recentIds,includeText:true})).results[0].recentlyChosen,true);
  const excluded = await retrieveLibrary({...options,excludeIds:recentIds});
  assert.ok(excluded.results.every(row=>!recentIds.includes(row.id)));
});
test('capability, reviewed evidence and invalid filters do not invent supported results', () => {
  assert.ok(rankLibrary(catalog,{query:'cinetic',limit:8}).every(r=>r.row.category!=='3d'));
  assert.equal(rankLibrary(catalog,{query:'cinetic',evidence:'reviewed'}).length,0);
  assert.throws(()=>rankLibrary(catalog,{query:'cinetic',energy:'hyper'}),/energy/);
  assert.throws(()=>rankLibrary(catalog,{query:'cinetic',seed:-1}),/seed/);
});
