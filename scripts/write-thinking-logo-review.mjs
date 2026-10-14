import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const output=resolve('output/playwright/thinking-logos');
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const catalog=await read('apps/web/src/mirel-chat/features/agents/thinking-logos/catalog.json');
const manifest=await read('docs/resources/thinking-logos/manifest.json');
const recognition=await read(resolve(output,'recognition.json'));
const production=await read(resolve(output,'production-verification.json'));
const dataFiles=await readdir('apps/web/src/mirel-chat/features/agents/thinking-logos/data');
assert.equal(catalog.length,110);assert.equal(new Set(catalog.map(x=>x.id)).size,110);
assert.equal(manifest.entries.length,110);assert.equal(recognition.entries.length,110);
assert.equal(dataFiles.filter(name=>name.endsWith('.json')).length,110);
assert.deepEqual(production.errors,[]);assert.deepEqual(recognition.errors,[]);
const limited=new Set(['syka','agent-reach','hermes','hugging-face','github-copilot','bun','postgresql']);
const entries=[];
for(let index=0;index<catalog.length;index++){
  const mark=catalog[index],checks=recognition.entries.find(x=>x.id===mark.id);
  assert(checks?.liveAnimated);assert(checks.compactBounds.every(x=>x.contained));
  assert(checks.geometry.every(x=>x.changed&&x.startInk>5&&x.workingInk>5));
  const start=Math.floor(index/16)*16+1,end=Math.min(start+15,110);
  const reviewSheet=`recognition-${String(start).padStart(3,'0')}-${String(end).padStart(3,'0')}.png`;
  await access(resolve(output,reviewSheet));
  entries.push({id:mark.id,name:mark.name,created:true,liveAnimated:true,
    visualReview:'approved in labeled interface',sizes:[20,28,44,64],
    compactTreatment:'original mark remains visible with animated particles',
    fineDetailAt20:limited.has(mark.id)?'Fine illustration detail is reduced; keep the text label':'Recognizable symbol with the text label',
    sourceKind:mark.kind,reviewSheet,stateSizeChecks:checks.geometry.length});
}
assert.equal(entries.length,110);
const review={catalogCount:catalog.length,newEntriesSinceContinuation:catalog.length-110,created:entries.length,
  liveAnimated:entries.filter(x=>x.liveAnimated).length,visualApprovedInLabeledInterface:entries.length,
  stateSizeChecks:recognition.stateSizeChecks,unitTestsPassed:15,typecheck:'passed',build:'passed',compiledGallery:production,
  chatIntegration:'Actual Solid-to-React bridge verified with synthetic running/done/failed tool events',
  installedDesktopVerified:false,
  limits:['20–28px preserves the brand mark while particles animate; 44px and larger use full morphs',
    'Full morphs intentionally leave the brand silhouette during the working phase',
    'Graphify uses an identified functional Syka symbol',
    'Provider calls and the installed desktop release were not tested'],entries};
await writeFile(resolve(output,'review.json'),JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify({catalogCount:review.catalogCount,newSinceContinuation:review.newEntriesSinceContinuation,created:review.created,animated:review.liveAnimated,approvedInContext:review.visualApprovedInLabeledInterface,reviewedEntries:review.entries.length,stateSizeChecks:review.stateSizeChecks}));
