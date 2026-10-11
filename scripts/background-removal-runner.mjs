// Adapter around HyperFrames' Apache-2.0 CLI. It never changes the source.
import { readdir, rename, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const modules = resolve(process.argv[2]), config = JSON.parse(process.argv[3]);
const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
const require = createRequire(join(modules, 'hyperframes', 'package.json'));
async function ffmpeg(args) {
  await new Promise((resolve, reject) => { const child = spawn(process.env.SYKA_BACKGROUND_FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args], { windowsHide: true }); let error = ''; child.stderr.on('data', data => error = (error + data).slice(-2000)); child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(Error(error))); });
}
try {
  const dist = join(modules, 'hyperframes', 'dist');
  const pipeline = (await readdir(dist)).find(name => /^pipeline-[\w-]+\.js$/.test(name));
  if (!pipeline) throw Error('La versión instalada de HyperFrames no incluye el recorte local.');
  const { render } = await import(pathToFileURL(join(dist, pipeline)).href);
  let inputPath = config.inputPath;
  let frameRate;
  if (config.kind === 'video') {
    const metadata = await new Promise((resolve, reject) => { const proc = spawn(process.env.SYKA_BACKGROUND_FFPROBE || 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,avg_frame_rate', '-of', 'json', inputPath], { windowsHide: true }); let text = ''; proc.stdout.on('data', data => text += data); proc.on('error', reject); proc.on('close', code => { try { if (code !== 0) throw Error('No se pudo leer el video.'); resolve(JSON.parse(text)); } catch (error) { reject(error); } }); });
    if (config.end > Number(metadata.format?.duration) + .05) throw Error('El tramo pedido supera la duración del video.');
    const dimensions = metadata.streams.find(stream => stream.width);
    if (!dimensions || dimensions.width * dimensions.height > 3840 * 2160) throw Error('El recorte local admite videos de hasta 4K.');
    const [num, den] = String(dimensions.avg_frame_rate).split('/').map(Number); frameRate = num / den;
    if (!Number.isFinite(frameRate) || frameRate < 1 || frameRate > 120) throw Error('La tasa de fotogramas del video no es compatible.');
    inputPath = join(config.folder, 'fragmento.mp4');
    // Bound preprocessing, preserve audio and dimensions; no silent full-stream run.
    await ffmpeg(['-ss', String(config.start), '-i', config.inputPath, '-t', String(config.end - config.start), '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-c:a', 'aac', '-y', inputPath]);
  }
  const subject = join(config.folder, config.kind === 'image' ? 'sujeto.png' : 'sujeto.webm');
  const background = config.separate ? join(config.folder, config.kind === 'image' ? 'fondo.png' : 'fondo.webm') : undefined;
  const result = await render({ inputPath, outputPath: subject, backgroundOutputPath: config.kind === 'video' ? background : undefined, quality: config.quality, device: 'auto', onProgress: event => emit(event) });
  if (config.kind === 'image' && background) {
    const sharp = require('sharp');
    const { data: fg, info } = await sharp(subject).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgb = await sharp(inputPath).rotate().resize(info.width, info.height).ensureAlpha().raw().toBuffer();
    for (let pixel = 3; pixel < rgb.length; pixel += 4) rgb[pixel] = 255 - fg[pixel];
    await sharp(rgb, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(background);
  }
  let subjectFrames, backgroundFrames;
  if (config.kind === 'video') {
    const withAudio = join(config.folder, 'sujeto-audio.webm');
    await ffmpeg(['-i', subject, '-i', inputPath, '-map', '0:v:0', '-map', '1:a?', '-c:v', 'copy', '-c:a', 'libopus', '-y', withAudio]);
    await rename(withAudio, subject);
    // WebCodecs ignores VP9 alpha. Native Diffusion uses lossless PNG sequences
    // for deterministic preview/export, while the portable WebM is kept too.
    emit({ kind: 'info', message: 'Preparing native transparent layers' });
    subjectFrames = join(config.folder, 'sujeto-fotogramas'); await mkdir(subjectFrames);
    await ffmpeg(['-c:v', 'libvpx-vp9', '-i', subject, '-vsync', '0', '-y', join(subjectFrames, '%06d.png')]);
    if (background) { backgroundFrames = join(config.folder, 'fondo-fotogramas'); await mkdir(backgroundFrames); await ffmpeg(['-c:v', 'libvpx-vp9', '-i', background, '-vsync', '0', '-y', join(backgroundFrames, '%06d.png')]); }
  }
  await writeFile(join(config.folder, 'recorte.json'), JSON.stringify({ version: 1, original: config.inputPath, start: config.start, end: config.end, model: 'u2net_human_seg', engine: 'hyperframes@0.8.140', provider: result.provider, subject, background, backgroundReconstructed: false }, null, 2));
  emit({ kind: 'result', subject, background, subjectFrames, backgroundFrames, frameRate, provider: result.provider });
} catch (error) { process.stderr.write(String(error.stack || error)); process.exitCode = 1; }
