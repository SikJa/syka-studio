import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,writeFile,readFile,readdir,access,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
const calls=vi.hoisted(()=>({args:[] as string[][],mode:'normal',fullMetadataBytes:0}));
vi.mock('node:child_process',()=>({spawn:vi.fn((binary:string,args:string[])=>{
 const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),pid:undefined,exitCode:null,kill:vi.fn()});
 calls.args.push(args);
 queueMicrotask(async()=>{try{
  if(binary==='download'&&(args.includes('--dump-single-json')||args.includes('--print'))){
   const info:Record<string,unknown>={id:'test',title:'Una charla con ñandúes',duration:['long','huge'].includes(calls.mode)?43200:2};
   if(calls.mode==='huge')info.formats=[{fragments:'x'.repeat(9*1024*1024)}];
   calls.fullMetadataBytes=Buffer.byteLength(JSON.stringify(info));
   if(calls.mode==='invalid-json')child.stdout.write('{"id":');
   else if(calls.mode==='overflow-json')child.stdout.write('{"title":"'+'x'.repeat(9*1024*1024)+'"}');
   else {const keys=args.includes('--print')?args[args.indexOf('--print')+1]!.match(/\{([^}]+)\}/)![1]!.split(','):Object.keys(info);const json=JSON.stringify(Object.fromEntries(keys.filter(k=>k in info).map(k=>[k,info[k]]))),bytes=Buffer.from(json),at=bytes.indexOf(Buffer.from('ñ'))+1;child.stdout.write(bytes.subarray(0,at));child.stdout.write(bytes.subarray(at));}
  }
  else if(binary==='download'){const path=args[args.indexOf('--output')+1]!.replace('%(ext)s','mp4');await writeFile(path,'downloaded');}
  else if(binary==='probe')child.stdout.write(JSON.stringify({format:{duration:2},streams:[{codec_type:'video'},{codec_type:'audio'}]}));
  else if(binary==='ffmpeg'){if(calls.mode==='fail'){child.stderr.write('sample failed');child.emit('close',1);return;}await writeFile(args.at(-1)!,Buffer.from('fixture'))}
  child.emit('close',0);
 }catch(e){child.emit('error',e)}});return child;
})}));
import {publicVideoUrl,ReferenceVideos,type ReferenceManifest} from '../src/host/reference-video';
afterEach(()=>{calls.args=[];calls.mode='normal';calls.fullMetadataBytes=0;vi.unstubAllEnvs()});
describe('video reference lifecycle',()=>{
 it('accepts individual network links, drops tracking, and rejects lookalike/private/profile URLs',()=>{
  expect(publicVideoUrl('https://www.instagram.com/p/DeK6sw9CbIT/?mdxt=token')?.url).toBe('https://www.instagram.com/p/DeK6sw9CbIT/');
  for(const url of ['https://www.tiktok.com/@person/video/1234','https://vm.tiktok.com/Abcd/','https://x.com/user/status/1234','https://youtu.be/BaW_jenozKc','https://www.youtube.com/shorts/BaW_jenozKc'])expect(publicVideoUrl(url)).not.toBeNull();
  for(const url of ['http://localhost/v.mp4','file:///tmp/video','https://instagram.com.evil.test/p/a/','https://user:password@instagram.com/p/a/','https://instagram.com:4433/p/a/','https://www.instagram.com/person/','https://youtube.com/playlist?list=123'])expect(publicVideoUrl(url)).toBeNull();
 });
 it('persists re-openable frames and audio, deletes the downloaded source, and preserves local originals',async()=>{
  const root=await mkdtemp(join(tmpdir(),'syka-reference-')),service=new ReferenceVideos(root,{ytDlp:'download',ffmpeg:'ffmpeg',ffprobe:'probe'});
  const result=await service.call({action:'analyze',source:'https://x.com/user/status/1234',focus:'Cómo aparecen los subtítulos',frames:3,includeAudio:true});
  const m=result.output as ReferenceManifest;
  expect(result.images).toHaveLength(3);expect(m.frames.map(f=>f.time)).toEqual([0,.96,1.92]);
  expect(m.temporarySourceRemoved).toBe(true);await expect(access(join(root,'03 Assets reutilizables/Referencias',m.id,'download'))).rejects.toThrow();
  const reopened=await service.call({action:'read',id:m.id});expect(reopened.images).toHaveLength(3);await access(m.audioPath!);
  const local=join(root,'original.mp4');await writeFile(local,'original');
  await service.call({action:'analyze',source:local,focus:'Los textos',frames:2});expect(await readFile(local,'utf8')).toBe('original');
  const download=calls.args.find(args=>args.includes('--output'))!;expect(download).toContain('--ignore-config');expect(download).toContain('--no-cache-dir');expect(download).not.toContain('--cookies-from-browser');
 });
 it('cleans failed partial downloads and requires a range for long videos',async()=>{
  const root=await mkdtemp(join(tmpdir(),'syka-reference-fail-')),service=new ReferenceVideos(root,{ytDlp:'download',ffmpeg:'ffmpeg',ffprobe:'probe'});
  calls.mode='fail';await expect(service.call({action:'analyze',source:'https://x.com/user/status/1234',focus:'Texto'})).rejects.toThrow('sample failed');
  expect(await readdir(join(root,'03 Assets reutilizables/Referencias'))).toEqual([]);
  calls.mode='long';await expect(service.call({action:'analyze',source:'https://youtu.be/BaW_jenozKc',focus:'Ritmo'})).rejects.toThrow('Elegí el tramo');
  expect(calls.args.filter(a=>a.includes('--output'))).toHaveLength(1);
 });
 it('bounds an initial inspection of a long video and never keeps its source or prepares audio',async()=>{
  const root=await mkdtemp(join(tmpdir(),'syka-reference-peek-')),service=new ReferenceVideos(root,{ytDlp:'download',ffmpeg:'ffmpeg',ffprobe:'probe'});
  calls.mode='long';
  const result=await service.call({action:'analyze',source:'https://youtu.be/BaW_jenozKc',focus:'Inspección visual inicial para sugerir dirección',initialInspection:true,start:30,end:900,frames:24,includeAudio:true,keepSource:true});
  const m=result.output as ReferenceManifest;
  expect(result.images).toHaveLength(4);expect(m.sourceStart).toBe(30);expect(m.audioPath).toBeUndefined();expect(m.sourcePath).toBeUndefined();expect(m.temporarySourceRemoved).toBe(true);
  const download=calls.args.find(args=>args.includes('--output'))!;
  expect(download[download.indexOf('--download-sections')+1]).toBe('*30-50');
  await expect(access(join(root,'03 Assets reutilizables/Referencias',m.id,'download'))).rejects.toThrow();
 });
 it('inspects long archives with more than 8 MiB of raw metadata using compact JSON and only downloads the requested excerpt',async()=>{
  const root=await mkdtemp(join(tmpdir(),'syka-reference-large-json-')),service=new ReferenceVideos(root,{ytDlp:'download',ffmpeg:'ffmpeg',ffprobe:'probe',node:'node'});
  calls.mode='huge';
  const result=await service.call({action:'analyze',source:'https://youtu.be/BaW_jenozKc',focus:'Primera mirada',initialInspection:true,start:7200});
  expect(calls.fullMetadataBytes).toBeGreaterThan(8*1024*1024);expect(result.images).toHaveLength(4);
  const inspect=calls.args.find(a=>a.includes('--print'))!;expect(inspect).toContain('node:node');expect(inspect).not.toContain('--dump-single-json');
  const download=calls.args.find(a=>a.includes('--output'))!;expect(download[download.indexOf('--download-sections')+1]).toBe('*7200-7220');
  expect(download[download.indexOf('--format')+1]!.split('/')[0]).toContain('protocol^=m3u8');expect(download).toContain('ffmpeg_i:-rw_timeout 20000000');
 });
 it('explains invalid or oversized metadata without continuing to download or suggesting an account problem',async()=>{
  for(const mode of ['invalid-json','overflow-json']){
   const root=await mkdtemp(join(tmpdir(),'syka-reference-bad-json-')),service=new ReferenceVideos(root,{ytDlp:'download',ffmpeg:'ffmpeg',ffprobe:'probe'});
   calls.mode=mode;await expect(service.call({action:'analyze',source:'https://youtu.be/BaW_jenozKc',focus:'Primera mirada',initialInspection:true})).rejects.toThrow(/metadatos|JSON/);
   expect(await readdir(join(root,'03 Assets reutilizables/Referencias'))).toEqual([]);
  }
  expect(calls.args.filter(a=>a.includes('--output'))).toHaveLength(0);
 });
 it('clamps the initial excerpt to actual duration and leaves a local original intact',async()=>{
  const root=await mkdtemp(join(tmpdir(),'syka-reference-short-')),service=new ReferenceVideos(root,{ytDlp:'download',ffmpeg:'ffmpeg',ffprobe:'probe'});
  await service.call({action:'analyze',source:'https://x.com/user/status/1234',focus:'Primera mirada',initialInspection:true});
  const download=calls.args.find(args=>args.includes('--output'))!;expect(download[download.indexOf('--download-sections')+1]).toBe('*0-2');
  const local=join(root,'original.mp4');await writeFile(local,'original');
  const result=await service.call({action:'analyze',source:local,focus:'Primera mirada',initialInspection:true,keepSource:true,includeAudio:true});
  expect(result.images).toHaveLength(4);expect(await readFile(local,'utf8')).toBe('original');expect((result.output as ReferenceManifest).audioPath).toBeUndefined();
 });
 it('retains a requested source without expiry, then releases only that source',async()=>{
  const root=await mkdtemp(join(tmpdir(),'syka-reference-retain-')),service=new ReferenceVideos(root,{ytDlp:'download',ffmpeg:'ffmpeg',ffprobe:'probe'});
  const r=await service.call({action:'analyze',source:'https://x.com/user/status/1234',focus:'Un fragmento para editar',keepSource:true,frames:2});const m=r.output as ReferenceManifest;
  await access(m.sourcePath!);await service.call({action:'release',id:m.id});await expect(access(m.sourcePath!)).rejects.toThrow();
  expect((await service.call({action:'read',id:m.id})).images).toHaveLength(2);
  await expect(service.call({action:'dispose',id:'../../original'})).rejects.toThrow('ID');
 });
 it('recovers an abandoned download without evicting finished evidence',async()=>{
  const root=await mkdtemp(join(tmpdir(),'syka-reference-crash-')),id='ref-00000000-0000-0000-0000-000000000000',folder=join(root,'03 Assets reutilizables/Referencias',id);
  await mkdir(join(folder,'download'),{recursive:true});await writeFile(join(folder,'owner.json'),JSON.stringify({pid:2147483647}));await writeFile(join(folder,'download/partial'),'partial');
  const service=new ReferenceVideos(root,{ytDlp:'download',ffmpeg:'ffmpeg',ffprobe:'probe'});
  await service.call({action:'analyze',source:'https://x.com/user/status/1234',focus:'Los textos',frames:2});await expect(access(folder)).rejects.toThrow();
 });
 it('leaves abandoned desktop downloads for the configured storage policy',async()=>{
  const root=await mkdtemp(join(tmpdir(),'syka-reference-policy-')),runtime=join(root,'runtime'),id='ref-00000000-0000-0000-0000-000000000000',folder=join(root,'03 Assets reutilizables/Referencias',id);
  await mkdir(runtime);vi.stubEnv('SYKA_RUNTIME_ROOT',runtime);
  await mkdir(join(folder,'download'),{recursive:true});await writeFile(join(folder,'owner.json'),JSON.stringify({pid:2147483647}));await writeFile(join(folder,'download/partial'),'waiting for the retention deadline');
  const service=new ReferenceVideos(root,{ytDlp:'download',ffmpeg:'ffmpeg',ffprobe:'probe'});
  await service.call({action:'analyze',source:'https://x.com/user/status/1234',focus:'Los textos',frames:2});
  expect(await readFile(join(folder,'download/partial'),'utf8')).toBe('waiting for the retention deadline');
 });
});
