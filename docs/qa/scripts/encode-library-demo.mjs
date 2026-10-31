// Encode the actual CDP screencast, preserving the time between captured frames.
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const evidence = resolve(process.argv[2]);
const frames = JSON.parse(await readFile(join(evidence, 'frames.json'), 'utf8'));
if (frames.length < 2) throw Error('Missing screencast frames');
const lines = ['ffconcat version 1.0'];
for (let i = 0; i < frames.length; i++) {
  const seconds = i + 1 < frames.length ? frames[i + 1].time - frames[i].time : 1 / 30;
  if (seconds <= 0 || !/^\d+\.jpg$/.test(frames[i].name)) throw Error('Invalid screencast frame');
  lines.push(`file 'frames/${frames[i].name}'`, `duration ${seconds.toFixed(6)}`);
}
lines.push(`file 'frames/${frames.at(-1).name}'`);
await writeFile(join(evidence, 'frames.ffconcat'), lines.join('\n') + '\n');
await writeFile(join(evidence, 'demo.ass'), `[Script Info]
ScriptType: v4.00+
PlayResX: 1500
PlayResY: 980

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Guide,Arial,22,&H00F1F4F4,&H00FFFFFF,&H800D1319,&H800D1319,0,0,0,0,100,100,0,0,3,9,0,8,345,280,12,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:17.00,Guide,,0,0,0,,Previews grandes de subtítulos: pasá el mouse para animarlos
Dialogue: 0,0:00:17.00,0:00:25.00,Guide,,0,0,0,,Aplicá el estilo a tu selección. Deshacer lo revierte
Dialogue: 0,0:00:25.00,0:00:43.00,Guide,,0,0,0,,Fuentes incluidas y fuentes propias: buscá y previsualizá
Dialogue: 0,0:00:43.00,0:01:02.00,Guide,,0,0,0,,Arrastrá la tarjeta al chat: queda adjunta como referencia
`);
const output = join(evidence, 'Syka-biblioteca-subtitulos-fuentes-demo-2026-10-08.mp4');
const ffmpeg = spawn('C:/ffmpeg/bin/ffmpeg.exe', ['-y','-hide_banner','-loglevel','warning','-f','concat','-safe','0','-i','frames.ffconcat','-vf','ass=demo.ass','-fps_mode','cfr','-r','30','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output], { cwd: evidence, windowsHide: true, stdio: 'inherit' });
await new Promise((ok, fail) => { ffmpeg.once('error',fail); ffmpeg.once('exit',code=>code===0?ok():fail(Error('ffmpeg '+code))); });
console.log(JSON.stringify({output,frames:frames.length,duration:frames.at(-1).time-frames[0].time}));
