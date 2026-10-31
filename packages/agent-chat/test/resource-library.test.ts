import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resourceLibrary } from '../src/host/resource-library';
import { WorkspaceTools } from '../src/host/workspace-tools';
import { closeResourceIndexes, resourceIndexMetrics } from '../src/host/resource-index';

let fixture: string, config: string, logos: string, second: string;
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>';
beforeEach(async () => {
  fixture = await mkdtemp(join(tmpdir(), 'syka-resources-test-'));
  config = join(fixture, 'config.json'); logos = join(fixture, 'logos'); second = join(fixture, 'second');
  await mkdir(logos); await mkdir(second);
  await writeFile(join(logos, 'brand.svg'), svg);
  await writeFile(join(second, 'duplicate.svg'), svg);
  await writeFile(join(second, 'other.svg'), svg.replace('L1 1', 'L2 2'));
});
afterEach(async () => {
  await closeResourceIndexes(config);
  // Only this exact freshly-created temp fixture is removed.
  if (!fixture.startsWith(join(tmpdir(), 'syka-resources-test-'))) throw Error('Unexpected fixture path');
  await rm(fixture, { recursive: true, force: true });
});
describe('connected resource libraries', () => {
  it('reuses the inventory for search and pagination and refreshes changed files', async () => {
    await resourceLibrary(config,{action:'add-folder',kind:'logos',path:logos});
    const before=resourceIndexMetrics(config);
    for (const query of ['', 'brand', 'missing']) await resourceLibrary(config,{action:'list',kind:'logos',query,limit:1});
    expect(resourceIndexMetrics(config)).toEqual(before);
    const initial=(await resourceLibrary(config,{action:'list',kind:'logos'})).entries[0]!;
    await writeFile(initial.path,svg.replace('L1 1','L222 222'));
    const updated=await resourceLibrary(config,{action:'list',kind:'logos',refresh:true});
    expect(updated.entries[0]!.sha256).not.toBe(initial.sha256);
    expect(resourceIndexMetrics(config)[0]!.scans).toBe(before[0]!.scans+1);
  });
  it('persists verified hashes and checks filesystem changes after reopening', async () => {
    await resourceLibrary(config,{action:'add-folder',kind:'logos',path:logos});
    const first=await resourceLibrary(config,{action:'list',kind:'logos'});
    await closeResourceIndexes(config);
    expect((await resourceLibrary(config,{action:'list',kind:'logos'})).entries[0]!.sha256).toBe(first.entries[0]!.sha256);
    // The saved inventory answers first; the background reconciliation reuses its hash.
    await vi.waitFor(() => expect(resourceIndexMetrics(config)[0]!.persistedHashes).toBe(1));
    await closeResourceIndexes(config);
    await writeFile(join(logos,'new.svg'),svg.replace('L1 1','L3 3'));
    expect((await resourceLibrary(config,{action:'list',kind:'logos'})).total).toBe(2);
  });
  it('serves later pages from the ordered list and recomputes after a change', async () => {
    for (const name of ['a', 'b', 'c']) await writeFile(join(logos, name + '.svg'), svg.replace('L1 1', `L${name.charCodeAt(0)} 1`));
    await resourceLibrary(config,{action:'add-folder',kind:'logos',path:logos});
    const first = await resourceLibrary(config,{action:'list',kind:'logos',limit:2});
    const scans = resourceIndexMetrics(config)[0]!.stats;
    const second = await resourceLibrary(config,{action:'list',kind:'logos',limit:2,offset:2});
    expect(resourceIndexMetrics(config)[0]!.stats).toBe(scans);
    expect([...first.entries, ...second.entries].map(entry => entry.name).sort()).toEqual(['a.svg', 'b.svg', 'brand.svg', 'c.svg']);
    await writeFile(join(logos, 'd.svg'), svg.replace('L1 1', 'L9 9'));
    await vi.waitFor(async () => expect((await resourceLibrary(config,{action:'list',kind:'logos',limit:2})).total).toBe(5));
  });
  it('answers a reopen from the saved inventory and reconciles nested changes in the background', async () => {
    const nested = join(logos, 'Marcas'); await mkdir(nested);
    await writeFile(join(nested, 'a.svg'), svg.replace('L1 1', 'L4 4'));
    await resourceLibrary(config,{action:'add-folder',kind:'logos',path:logos});
    expect((await resourceLibrary(config,{action:'list',kind:'logos'})).total).toBe(2);
    await closeResourceIndexes(config);
    // A nested change leaves the root folder's own timestamps untouched.
    await writeFile(join(nested, 'b.svg'), svg.replace('L1 1', 'L5 5'));
    expect((await resourceLibrary(config,{action:'list',kind:'logos'})).total).toBe(2);
    await vi.waitFor(async () => expect((await resourceLibrary(config,{action:'list',kind:'logos'})).total).toBe(3));
    expect((await resourceLibrary(config,{action:'list',kind:'logos',refresh:true})).total).toBe(3);
  });
  it('keeps brand variants together, tolerates Antropic and features AI brands', async () => {
    const bundled=join(fixture,'brands');await mkdir(bundled);
    const entries=[{path:'ant.svg',brand:'Anthropic',variant:'symbol',category:'AI'}, {path:'ant-word.svg',brand:'Anthropic',variant:'wordmark',category:'AI'}, {path:'alpha.svg',brand:'Alpha',category:'AI'}];
    for(const [index,entry] of entries.entries())await writeFile(join(bundled,entry.path),svg.replace('L1 1',`L${index+2} 1`));
    await writeFile(join(bundled,'catalog.json'),JSON.stringify({version:1,entries}));
    for(const query of ['ant','Anthropic','Antropic']){
      const found=await resourceLibrary(config,{action:'list',kind:'logos',query,groupBrands:true},bundled);
      expect(found.total).toBe(1);expect(found.entries[0]!.brand).toBe('Anthropic');expect(found.entries[0]!.variants).toHaveLength(2);
    }
    expect((await resourceLibrary(config,{action:'list',kind:'logos',groupBrands:true,limit:1},bundled)).entries[0]!.brand).toBe('Anthropic');
    expect((await resourceLibrary(config,{action:'list',kind:'logos',groupBrands:true,limit:1,offset:1},bundled)).entries[0]!.brand).toBe('Alpha');
  });
  it('discovers bundled editable motions without a personal folder and rejects escaped companions', async () => {
    const motions=join(fixture,'motions');await mkdir(motions);
    await writeFile(join(motions,'OrbitFeature.mp4'),'preview');
    await writeFile(join(motions,'OrbitFeature.tsx'),'export default function OrbitFeature(){}');
    await writeFile(join(motions,'motion-time.ts'),'export const time = 0;');
    const entry={path:'OrbitFeature.mp4',brand:'Syka',title:'Órbita',tags:['orbit'],componentPath:'OrbitFeature.tsx',componentFiles:['OrbitFeature.tsx','motion-time.ts'],usage:'Copy to project'};
    await writeFile(join(motions,'catalog.json'),JSON.stringify({version:1,entries:[entry]}));
    const found=await resourceLibrary(config,{action:'list',kind:'motions',query:'orbita'},undefined,undefined,motions);
    expect(found.entries).toHaveLength(1);
    expect(found.entries[0]).toMatchObject({origin:'bundled',title:'Órbita',componentPath:join(motions,'OrbitFeature.tsx'),componentFiles:[join(motions,'OrbitFeature.tsx'),join(motions,'motion-time.ts')]});
    expect((await resourceLibrary(config,{action:'preview',path:found.entries[0].path},undefined,undefined,motions)).preview).toMatch(/^data:video\/mp4;base64,/);
    await writeFile(join(motions,'catalog.json'),JSON.stringify({version:1,entries:[{...entry,componentFiles:['../private.ts']}]}));
    await expect(resourceLibrary(config,{action:'list',kind:'motions'},undefined,undefined,motions)).rejects.toThrow('fuera');
  });
  it('previews a motion only inside its connected motion folder', async () => {
    const motions=join(fixture,'motions');await mkdir(motions);
    const path=join(motions,'steps.mp4');await writeFile(path,Buffer.from('motion-preview'));
    await resourceLibrary(config,{action:'add-folder',kind:'motions',path:motions});
    expect((await resourceLibrary(config,{action:'preview',path})).preview).toBe('data:video/mp4;base64,'+Buffer.from('motion-preview').toString('base64'));
    const outside=join(fixture,'outside.mp4');await writeFile(outside,Buffer.from('outside'));
    await expect(resourceLibrary(config,{action:'preview',path:outside})).rejects.toThrow('fuera de la biblioteca');
  });
  it('groups effects before pagination and filters a family without hiding its other variants', async () => {
    const bundled=join(fixture,'sounds');await mkdir(bundled);
    const names=['whoosh-1.wav','whoosh-2.wav','pop-1.wav','recording.wav'];
    for(const [i,name]of names.entries())await writeFile(join(bundled,name),Buffer.from('sound-'+i));
    await writeFile(join(bundled,'catalog.json'),JSON.stringify({version:1,entries:names.map(path=>({path,brand:'Syka',audioType:'sfx'}))}));
    const first=await resourceLibrary(config,{action:'list',kind:'sounds',audioType:'sfx',audioFamily:'whoosh',limit:1},undefined,bundled);
    expect(first).toMatchObject({total:2,nextOffset:1,audioCategories:[{id:'pop',title:'Pops',count:1},{id:'whoosh',title:'Whoosh',count:2},{id:'other',title:'Otros sonidos',count:1}]});
    const next=await resourceLibrary(config,{action:'list',kind:'sounds',audioFamily:'whoosh',limit:1,offset:1},undefined,bundled);
    expect(next.entries[0]?.name).not.toBe(first.entries[0]?.name);expect(next.nextOffset).toBeNull();
    expect((await resourceLibrary(config,{action:'list',kind:'sounds',audioFamily:'whoosh',query:'2'},undefined,bundled)).entries.map(e=>e.name)).toEqual(['whoosh-2.wav']);
    await expect(resourceLibrary(config,{action:'list',audioFamily:'missing' as never},undefined,bundled)).rejects.toThrow('Categoría');
  });
  it('provides searchable licensed sounds and music without personal configuration', async () => {
    const bundled=join(fixture,'sounds');await mkdir(bundled);
    const wav=Buffer.alloc(48);wav.write('RIFF');wav.write('WAVE',8);
    await writeFile(join(bundled,'whoosh.wav'),wav);
    await writeFile(join(bundled,'bed.wav'),Buffer.concat([wav,Buffer.from([1])]));
    await writeFile(join(bundled,'catalog.json'),JSON.stringify({version:1,entries:[
      {path:'whoosh.wav',brand:'Syka',title:'Whoosh suave',audioType:'sfx',tags:['barrido','transición'],duration:.62,cuePoint:.31,license:'MIT'},
      {path:'bed.wav',brand:'Syka',title:'Base cálida',audioType:'music',tags:['música','fondo'],duration:20,bpm:96,loop:true,license:'MIT'},
    ]}));
    const found=await resourceLibrary(config,{action:'list',kind:'sounds',query:'transicion'},undefined,bundled);
    expect(found).toMatchObject({total:1,warnings:[],folders:[{kind:'sounds',bundled:true}]});
    expect(found.entries[0]).toMatchObject({title:'Whoosh suave',origin:'bundled',duration:.62,cuePoint:.31,license:'MIT'});
    expect((await resourceLibrary(config,{action:'preview',path:found.entries[0].path},undefined,bundled)).preview).toMatch(/^data:audio\/wav;base64,/);
    expect((await resourceLibrary(config,{action:'list',kind:'sounds',audioType:'music'},undefined,bundled)).entries[0]).toMatchObject({bpm:96,loop:true});
    await expect(readFile(config,'utf8')).rejects.toThrow();
  });
  it('keeps personal sound originals first and refuses out-of-library audio previews', async () => {
    const sounds=join(fixture,'sounds'),bundled=join(fixture,'bundled-sounds');await mkdir(sounds);await mkdir(bundled);
    const bytes=Buffer.from('RIFF original audio');await writeFile(join(sounds,'pop.wav'),bytes);await writeFile(join(bundled,'pop.wav'),bytes);
    await writeFile(join(bundled,'catalog.json'),JSON.stringify({version:1,entries:[{path:'pop.wav',brand:'Syka',audioType:'sfx'}]}));
    await resourceLibrary(config,{action:'add-folder',kind:'sounds',path:sounds},undefined,bundled);
    expect((await resourceLibrary(config,{action:'list',kind:'sounds'},undefined,bundled)).entries).toMatchObject([{origin:'personal'}]);
    await expect(resourceLibrary(config,{action:'preview',path:join(second,'other.svg')},undefined,bundled)).rejects.toThrow();
    expect(JSON.parse(await readFile(config,'utf8')).folders).toEqual([{kind:'sounds',path:sounds}]);
  });
  it('keeps catalog metadata on a personal byte-identical sound before type and acoustic filters', async () => {
    const sounds=join(fixture,'personal-sounds'),bundled=join(fixture,'bundled-sounds');await mkdir(sounds);await mkdir(bundled);
    const bytes=Buffer.from('RIFF known glass cue'),personal=join(sounds,'0007.wav');
    await writeFile(personal,bytes);await writeFile(join(bundled,'click-glass.wav'),bytes);
    await writeFile(join(bundled,'catalog.json'),JSON.stringify({version:1,entries:[{path:'click-glass.wav',brand:'Syka',audioType:'sfx',audioFamily:'click',license:'MIT',provider:'Cuelume',duration:.2,soundProfile:{brightness:'bright',riseMs:8}}]}));
    await resourceLibrary(config,{action:'add-folder',kind:'sounds',path:sounds});
    const found=await resourceLibrary(config,{action:'list',kind:'sounds',audioType:'sfx',includeUnclassified:false,audioFamily:'click',brightness:'bright',attack:'sharp'},undefined,bundled);
    expect(found.entries).toHaveLength(1);
    expect(found.entries[0]).toMatchObject({path:personal,origin:'personal',audioType:'sfx',classificationSource:'catalog',license:'MIT',provider:'Cuelume',duration:.2});
    expect((await resourceLibrary(config,{action:'list',kind:'sounds',audioType:'unclassified'},undefined,bundled)).total).toBe(0);
    await resourceLibrary(config,{action:'classify',kind:'sounds',path:personal,classification:'music',title:'Mi decisión'});
    expect((await resourceLibrary(config,{action:'list',kind:'sounds',audioType:'music'},undefined,bundled)).entries[0]).toMatchObject({origin:'personal',audioType:'music',classificationSource:'manual',title:'Mi decisión',license:'MIT'});
    expect((await resourceLibrary(config,{action:'list',kind:'sounds',audioType:'sfx'},undefined,bundled)).total).toBe(0);
  });
  it('connects the sound catalog to agent tools using the bundled documentation root', async () => {
    const docs=join(fixture,'docs'),sounds=join(docs,'resources','sounds');await mkdir(sounds,{recursive:true});
    await writeFile(join(sounds,'pop.wav'),Buffer.from('RIFF local pop'));
    await writeFile(join(sounds,'catalog.json'),JSON.stringify({version:1,entries:[{path:'pop.wav',brand:'Syka',audioType:'sfx',tags:['burbuja']}]}));
    const tools=new WorkspaceTools(fixture,docs,undefined,config);
    expect(await tools.call('syka_resources',{action:'list',kind:'sounds',query:'burbuja'})).toMatchObject({total:1});
  });
  it('finds a matching filename before deduplicating identical SVGs', async () => {
    await writeFile(join(second,'supabase.svg'),svg);
    await resourceLibrary(config,{action:'add-folder',kind:'logos',path:logos});
    await resourceLibrary(config,{action:'add-folder',kind:'logos',path:second});
    expect((await resourceLibrary(config,{action:'list',kind:'logos',query:'Supabase'})).entries.map(e=>e.name)).toEqual(['supabase.svg']);
  });
  it('provides attributed bundled logos with a clean user profile and passive previews', async () => {
    const bundled=join(fixture,'bundled');await mkdir(join(bundled,'supabase'),{recursive:true});
    await writeFile(join(bundled,'supabase/icon.svg'),svg);
    await writeFile(join(bundled,'catalog.json'),JSON.stringify({version:1,entries:[{path:'supabase/icon.svg',brand:'Supabase',variant:'symbol',theme:'any',url:'https://supabase.com/'}]}));
    const found=await resourceLibrary(config,{action:'list',kind:'logos',query:'Supabase'},bundled);
    expect(found).toMatchObject({total:1,warnings:[],folders:[{bundled:true}]});
    expect(found.entries[0]).toMatchObject({brand:'Supabase',origin:'bundled',variant:'symbol',url:'https://supabase.com/'});
    expect((await resourceLibrary(config,{action:'preview',path:found.entries[0].path},bundled)).preview).toMatch(/^data:image\/svg\+xml;base64,/);
    await resourceLibrary(config,{action:'add-folder',kind:'logos',path:logos},bundled);
    expect(JSON.parse(await readFile(config,'utf8')).folders).toEqual([{kind:'logos',path:logos}]);
    expect((await resourceLibrary(config,{action:'remove-folder',kind:'logos',path:logos},bundled)).folders).toEqual([{kind:'logos',path:bundled,bundled:true}]);
  });
  it('prioritizes personal originals and does not silently ignore a broken bundled catalog', async () => {
    const bundled=join(fixture,'bundled');await mkdir(bundled);
    await writeFile(join(bundled,'brand.svg'),svg);
    await writeFile(join(bundled,'catalog.json'),JSON.stringify({version:1,entries:[{path:'brand.svg',brand:'Brand'}]}));
    await resourceLibrary(config,{action:'add-folder',kind:'logos',path:logos},bundled);
    expect((await resourceLibrary(config,{action:'list',kind:'logos'},bundled)).entries).toHaveLength(1);
    expect((await resourceLibrary(config,{action:'list',kind:'logos'},bundled)).entries[0].origin).toBe('personal');
    await writeFile(join(bundled,'catalog.json'),JSON.stringify({version:1,entries:[{path:'../outside.svg',brand:'Bad'}]}));
    await expect(resourceLibrary(config,{action:'list'},bundled)).rejects.toThrow('fuera');
  });
  it('deduplicates original SVGs and paginates without losing results', async () => {
    await resourceLibrary(config, { action: 'add-folder', kind: 'logos', path: logos });
    await resourceLibrary(config, { action: 'add-folder', kind: 'logos', path: second });
    const first = await resourceLibrary(config, { action: 'list', kind: 'logos', limit: 1 });
    expect(first.total).toBe(2); expect(first.nextOffset).toBe(1);
    const next = await resourceLibrary(config, { action: 'list', kind: 'logos', limit: 1, offset: first.nextOffset! });
    expect(next.nextOffset).toBeNull(); expect(next.entries[0].path).not.toBe(first.entries[0].path);
    const queried = await resourceLibrary(config, { action: 'list', kind: 'logos', query: 'OTHER' });
    expect(queried.entries.map(e => e.name)).toEqual(['other.svg']);
  });
  it('matches brand names separated by spaces or hyphens', async () => {
    await writeFile(join(logos, 'huggingface.svg'), svg.replace('L1 1', 'L4 4'));
    await resourceLibrary(config, { action: 'add-folder', kind: 'logos', path: logos });
    for (const query of ['Hugging Face', 'hugging-face', 'hugging_face']) {
      expect((await resourceLibrary(config, { action: 'list', kind: 'logos', query })).entries.map(e => e.name)).toEqual(['huggingface.svg']);
    }
  });
  it('shows AI logos first by catalog category without overriding an explicit brand search or stale content', async () => {
    const bundled=join(fixture,'ai-logos');await mkdir(bundled);
    const entries=[{path:'alpha.svg',brand:'Alpha',category:'Software'},{path:'zeta.svg',brand:'Zeta',category:['Software','AI']}];
    await writeFile(join(bundled,'alpha.svg'),svg);await writeFile(join(bundled,'zeta.svg'),svg.replace('L1 1','L9 9'));
    const manifest=join(bundled,'catalog.json');await writeFile(manifest,JSON.stringify({version:1,entries}));
    const initial=await resourceLibrary(config,{action:'list',kind:'logos'},bundled);
    expect(initial.entries.map(entry=>entry.brand)).toEqual(['Zeta','Alpha']);
    expect((await resourceLibrary(config,{action:'list',kind:'logos',query:'Alpha'},bundled)).entries[0]?.brand).toBe('Alpha');
    await writeFile(join(bundled,'zeta.svg'),svg.replace('L1 1','L100 100'));
    entries[1]!.brand='Updated Zeta';await writeFile(manifest,JSON.stringify({version:1,entries}));
    const updated=await resourceLibrary(config,{action:'list',kind:'logos'},bundled);
    expect(updated.entries[0]?.brand).toBe('Updated Zeta');
    expect(updated.entries[0]?.sha256).not.toBe(initial.entries[0]?.sha256);
  });
  it('retains both independently connected folders during simultaneous requests', async () => {
    await Promise.all([logos, second].map(path => resourceLibrary(config, { action: 'add-folder', kind: 'logos', path })));
    expect((await resourceLibrary(config, { action: 'list' })).folders).toHaveLength(2);
  });
  it('disconnects a folder without deleting originals and exposes missing-folder warnings', async () => {
    await resourceLibrary(config, { action: 'add-folder', kind: 'logos', path: logos });
    await resourceLibrary(config, { action: 'remove-folder', kind: 'logos', path: logos });
    expect(await readFile(join(logos, 'brand.svg'), 'utf8')).toBe(svg);
    await writeFile(config, JSON.stringify({ version: 1, folders: [{ kind: 'logos', path: join(fixture, 'missing') }] }));
    expect((await resourceLibrary(config, { action: 'list' })).warnings).toHaveLength(1);
  });
  it('previews only passive SVGs within a connected root', async () => {
    await resourceLibrary(config, { action: 'add-folder', kind: 'logos', path: logos });
    expect((await resourceLibrary(config, { action: 'preview', path: join(logos, 'brand.svg') })).preview).toMatch(/^data:image\/svg\+xml;base64,/);
    await expect(resourceLibrary(config, { action: 'preview', path: join(second, 'other.svg') })).rejects.toThrow();
    await writeFile(join(logos, 'active.svg'), '<svg><script>alert(1)</script></svg>');
    await expect(resourceLibrary(config, { action: 'preview', path: join(logos, 'active.svg') })).rejects.toThrow('activos');
  });
  it('lets the agent search but refuses agent reconfiguration', async () => {
    await resourceLibrary(config, { action: 'add-folder', kind: 'logos', path: logos });
    const tools = new WorkspaceTools(fixture, undefined, undefined, config);
    expect(await tools.call('syka_resources', { action: 'list', kind: 'logos', query: 'brand' })).toMatchObject({ total: 1 });
    await expect(tools.call('syka_resources', { action: 'add-folder', kind: 'logos', path: second })).rejects.toThrow();
  });
  it('reconciles edits, additions and removals without forcing a refresh', async () => {
    await resourceLibrary(config,{action:'add-folder',kind:'logos',path:logos});
    const before=await resourceLibrary(config,{action:'list',kind:'logos'});
    await writeFile(join(logos,'brand.svg'),svg.replace('L1 1','L678 678'));
    await vi.waitFor(async()=>expect((await resourceLibrary(config,{action:'list',kind:'logos'})).entries[0].sha256).not.toBe(before.entries[0].sha256));
    const added=join(logos,'new.svg');await writeFile(added,svg.replace('L1 1','L500 500'));
    await vi.waitFor(async()=>expect((await resourceLibrary(config,{action:'list',kind:'logos',query:'new'})).total).toBe(1));
    await rm(added);
    await vi.waitFor(async()=>expect((await resourceLibrary(config,{action:'list',kind:'logos',query:'new'})).total).toBe(0));
  });
});
