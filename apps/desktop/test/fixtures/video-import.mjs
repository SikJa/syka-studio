import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
const args = process.argv.slice(2), mode = process.env.SYKA_VIDEO_IMPORT_FIXTURE;
if (mode === 'hang') { console.log('waiting'); setInterval(() => {}, 1000); }
else if (args.includes('-show_streams')) console.log(JSON.stringify({ streams: [{codec_type:'video', width:640, height:360}], format:{duration:mode==='truncated'?0.1:12} }));
else if (args.includes('--dump-single-json')) console.log(JSON.stringify({id:'jNQXAC9IVRw',title:'Public fixture',duration:mode === 'long' ? 43200 : 19,live_status:mode === 'live'?'is_live':'not_live',channel:'Fixture',thumbnail:'https://i.ytimg.com/vi/jNQXAC9IVRw/default.jpg',formats:[{url:'https://private-secret.invalid/token'}]}));
else if (mode === 'download-hang') { console.log('SYKA_PROGRESS: 1%'); setInterval(() => {}, 1000); }
else {
  const output = args[args.indexOf('-o')+1].replace('%(ext)s','mp4');
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,Buffer.alloc(512));
  console.log('SYKA_PROGRESS: 80.0%');
}
