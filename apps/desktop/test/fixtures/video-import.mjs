import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
const args = process.argv.slice(2), mode = process.env.SYKA_VIDEO_IMPORT_FIXTURE;
if (mode === 'hang') { console.log('waiting'); setInterval(() => {}, 1000); }
else if (args.includes('-show_streams')) console.log(JSON.stringify({ streams: [{codec_type:'video', width:640, height:360}], format:{duration:mode==='truncated'?0.1:12} }));
else if (args.includes('--dump-single-json') || args.includes('--print')) {
  const info = {id:'jNQXAC9IVRw',title:'Public fixture con ñandúes',duration:['long','large-metadata'].includes(mode)?43200:19,live_status:mode === 'live'?'is_live':'not_live',channel:'Fixture',thumbnail:'https://i.ytimg.com/vi/jNQXAC9IVRw/default.jpg',formats:[{url:'https://private-secret.invalid/token',...(mode==='large-metadata'?{fragments:'x'.repeat(9*1024*1024)}:{})}]};
  if(mode==='invalid-json')process.stdout.write('{"id":');
  else if(mode==='overflow-json')process.stdout.write('{"title":"'+'x'.repeat(9*1024*1024)+'"}');
  else {const keys=args.includes('--print')?args[args.indexOf('--print')+1].match(/\{([^}]+)\}/)[1].split(','):Object.keys(info);const bytes=Buffer.from(JSON.stringify(Object.fromEntries(keys.filter(k=>k in info).map(k=>[k,info[k]]))));const split=bytes.indexOf(Buffer.from('ñ'))+1;process.stdout.write(bytes.subarray(0,split));process.stdout.write(bytes.subarray(split));}
  process.stderr.write('Fixture diagnostic stays separate from JSON\n');
}
else if (mode === 'download-hang') { console.log('SYKA_PROGRESS: 1%'); setInterval(() => {}, 1000); }
else {
  if(mode==='nonseekable-mp4'&&args.includes('--download-sections')&&!args[args.indexOf('-f')+1].split('/')[0].includes('protocol^=m3u8')) { console.error('The progressive fragmented MP4 requires reading the preceding video to seek.'); process.exit(1); }
  const output = args[args.indexOf('-o')+1].replace('%(ext)s','mp4');
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,Buffer.alloc(512));
  console.log('SYKA_PROGRESS: 80.0%');
}
