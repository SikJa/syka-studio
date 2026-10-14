import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { VideoImportService, normalizeVideoMetadata } from '../src/video-import/service';
import { formatVideoTime, isEmptyVideoImportStarter, parseVideoTime, validateVideoRange, youtubeUrl, youtubeUrlsInText } from '../src/video-import/types';
const url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'syka-video-import-')); await mkdir(join(root,'project')); });
afterEach(async () => { if (!resolve(root).startsWith(resolve(tmpdir()) + '/') && !resolve(root).startsWith(resolve(tmpdir()) + '\\')) throw Error('Unexpected cleanup path'); if (!root.includes('syka-video-import-')) throw Error('Unexpected test folder'); await rm(root,{recursive:true,force:true}); });
const fixture = fileURLToPath(new URL('./fixtures/video-import.mjs',import.meta.url));
function service(mode='normal', integrated: unknown[] = []) {
  const command = () => ({command:process.execPath,prefix:[fixture]});
  return new VideoImportService({runtimeDir:root,ytDlp:command,ffmpeg:()=>process.execPath,ffprobe:command,env:{...process.env,SYKA_VIDEO_IMPORT_FIXTURE:mode},
    validateProject:async dir=>{if(dir !== join(root,'project')) throw Error('Not a project');}, integrate:async(...data)=>{integrated.push(data);return true;}});
}
async function until(s:VideoImportService,id:string,state:string) { for(let n=0;n<200;n++){const j=s.status(id);if(j.state===state)return j;if(j.state==='error')throw Error(j.error);await new Promise(r=>setTimeout(r,20));}throw Error('State timeout: '+s.status(id).state); }
describe('YouTube import boundaries',()=>{
  it('canonicalizes individual videos and strips tracking, playlist, fragments and timestamps',()=>{
    for (const input of ['https://youtu.be/jNQXAC9IVRw?si=abc','https://www.youtube.com/shorts/jNQXAC9IVRw','https://m.youtube.com/live/jNQXAC9IVRw?t=3',url+'&list=anything#fragment']) expect(youtubeUrl(input)).toBe(url);
    for (const input of ['file:///private', 'https://youtube.com.evil.invalid/watch?v=jNQXAC9IVRw','https://youtube.com@localhost/watch?v=jNQXAC9IVRw','https://youtube.com:8080/watch?v=jNQXAC9IVRw','https://youtube.com/playlist?list=123','--exec=anything','https://youtu.be/not-an-id']) expect(youtubeUrl(input)).toBeNull();
    expect(youtubeUrlsInText('Editá ('+url+'). y '+url)).toEqual([url]);
  });
  it('requires ranges for 12h/live archives, rejects active streams, enforces valid finite bounds',()=>{
    const long=normalizeVideoMetadata({id:'jNQXAC9IVRw',duration:43200,was_live:true},url);
    expect(()=>validateVideoRange(long)).toThrow('Elegí');
    expect(validateVideoRange(long,{start:7200,end:8100})).toEqual({start:7200,end:8100});
    for (const range of [{start:0,end:43200},{start:-1,end:2},{start:1,end:1},{start:NaN,end:3},{start:43199,end:43201},{start:0.0001,end:0.0002}]) expect(()=>validateVideoRange(long,range)).toThrow();
    const live=normalizeVideoMetadata({id:'jNQXAC9IVRw',duration:100,live_status:'is_live'},url);
    expect(()=>validateVideoRange(live,{start:0,end:10})).toThrow('directo');
    expect(()=>validateVideoRange(normalizeVideoMetadata({id:'jNQXAC9IVRw'},url))).toThrow('Elegí');
    expect(()=>normalizeVideoMetadata({id:'BaW_jenozKc'},url)).toThrow('no coincide');
  });
  it('parses user-facing time without treating invalid minutes as valid seconds',()=>{
    expect(parseVideoTime('1:02:03.5')).toBe(3723.5); expect(parseVideoTime('90')).toBe(90); expect(parseVideoTime('1:90')).toBeNull(); expect(parseVideoTime('-1')).toBeNull();expect(formatVideoTime(3723)).toBe('1:02:03');
  });
  it('seeds only an untouched blank project and preserves any existing authored content',()=>{
    expect(isEmptyVideoImportStarter('export default function Project() { return ( <stage background="#161616"> </stage> ) }')).toBe(true);
    expect(isEmptyVideoImportStarter('export default function Project() { return ( <stage background="#161616" id="abc123"> </stage> ); }')).toBe(true);
    for(const source of ['export default function Project() { return (<stage background="#161616"><text>Keep me</text></stage>) }','export default function Project() { const meaning = 42; return (<stage background="#161616"></stage>) }','export default function Project() { return (<stage background="#ffffff"></stage>) }']) expect(isEmptyVideoImportStarter(source)).toBe(false);
  });
  it('persists the selected origin range and only sanitized metadata, then integrates editable media',async()=>{
    const integrated:unknown[]=[],s=service('normal',integrated),job=s.inspect(url);
    await until(s,job.id,'ready');await s.start(job.id,join(root,'project'),{start:4,end:16},true);
    const done=await until(s,job.id,'done');
    expect(done.result).toMatchObject({sourceRange:{start:4,end:16},duration:12,timelineCreated:true});
    const origin=JSON.parse(await readFile(done.result!.provenancePath,'utf8'));
    expect(origin.timeMap.sourceStartSeconds).toBe(4);expect(origin.transcription.state).toBe('not-requested');expect(JSON.stringify(origin)).not.toContain('private-secret');
    expect(integrated).toHaveLength(1);expect((await readdir(join(root,'video-imports')))).toEqual([]);
  });
  it('reads a long archive whose full metadata exceeds 8 MiB without truncating JSON or losing Unicode',async()=>{
    const s=service('large-metadata'),job=s.inspect(url),ready=await until(s,job.id,'ready');
    expect(ready.metadata).toMatchObject({title:'Public fixture con ñandúes',duration:43200,requiresRange:true});
    await s.start(job.id,join(root,'project'),{start:7200,end:7212});
    expect((await until(s,job.id,'done')).result?.sourceRange).toEqual({start:7200,end:7212});
  });
  it('downloads a later section without selecting the fragmented progressive MP4 that requires reading all earlier content',async()=>{
    const s=service('nonseekable-mp4'),job=s.inspect(url);await until(s,job.id,'ready');
    await s.start(job.id,join(root,'project'),{start:4,end:16});
    expect((await until(s,job.id,'done')).result?.duration).toBe(12);
  });
  it('reports malformed or oversized JSON clearly and never adds a file to the project',async()=>{
    for(const mode of ['invalid-json','overflow-json']){
      const s=service(mode),job=s.inspect(url);
      for(let n=0;n<200&&s.status(job.id).state==='inspecting';n++)await new Promise(r=>setTimeout(r,20));
      expect(s.status(job.id)).toMatchObject({state:'error'});expect(s.status(job.id).error).toMatch(/metadatos|JSON/);
      expect(s.status(job.id).error).not.toContain('SyntaxError');
    }
    expect(await readdir(join(root,'project'))).toEqual([]);
  });
  it('cancels a real child process and never starts transcription or a download afterwards',async()=>{
    const s=service('hang'),job=s.inspect(url);await new Promise(r=>setTimeout(r,100));
    expect((await s.cancel(job.id)).state).toBe('cancelled');
    await expect(s.start(job.id,join(root,'project'),{start:0,end:10})).rejects.toThrow('Primero');
  });
  it('refuses active streams before spawning the download and validates project destination',async()=>{
    const live=service('live'),j=live.inspect(url);await until(live,j.id,'ready');await expect(live.start(j.id,join(root,'project'),{start:0,end:10})).rejects.toThrow('directo');
    const s=service(),v=s.inspect(url);await until(s,v.id,'ready');await s.start(v.id,join(root,'missing'),{start:0,end:12});
    await new Promise(r=>setTimeout(r,50));expect(s.status(v.id).state).toBe('error');
  });
  it('cancels an in-progress download, removes staging and rejects duplicate starts',async()=>{
    const s=service('download-hang'),j=s.inspect(url);await until(s,j.id,'ready');
    await s.start(j.id,join(root,'project'),{start:0,end:12});
    await expect(s.start(j.id,join(root,'project'),{start:0,end:12})).rejects.toThrow('Primero');
    await new Promise(r=>setTimeout(r,100));
    expect(s.inspect(url).id).toBe(j.id);
    expect((await s.cancel(j.id)).state).toBe('cancelled');
    expect(await readdir(join(root,'video-imports'))).toEqual([]);
    expect(await readdir(join(root,'project'))).toEqual([]);
  });
  it('refuses an incomplete download before adding media to the project',async()=>{
    const integrated:unknown[]=[],s=service('truncated',integrated),j=s.inspect(url);await until(s,j.id,'ready');
    await s.start(j.id,join(root,'project'),{start:0,end:12});
    for(let i=0;i<100&&s.status(j.id).state==='downloading';i++)await new Promise(r=>setTimeout(r,20));
    expect(s.status(j.id)).toMatchObject({state:'error'});expect(s.status(j.id).error).toContain('duración');
    expect(integrated).toEqual([]);expect(await readdir(join(root,'project'))).toEqual([]);
  });
});
