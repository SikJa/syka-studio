/** Maintainer import: publisher data only, hash-pinned CC0; preserves existing assets. */
import { readdir, readFile, writeFile, mkdir, copyFile, realpath } from 'node:fs/promises';
import { basename, join, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { soundProfile } from '../packages/agent-chat/src/host/audio-spectrum.ts';
const args = {}; for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
if (!args['--source-dir']) throw Error('Use --source-dir <publisher-packs> [--ffmpeg path] [--ffprobe path]; Node >=22.6.');
const source = await realpath(resolve(args['--source-dir'])), target = resolve('docs/resources/sounds');
const catalog = JSON.parse(await readFile(join(target, 'catalog.json'), 'utf8'));
const packs = JSON.parse(await readFile(join(source, 'packs.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const families = { hit: 'impact', boom: 'impact', thump: 'impact', tap: 'tap', paper: 'texture', swish: 'whoosh', transition: 'whoosh', click: 'click', glitch: 'glitch', zap: 'glitch' };
const translations = { metal: ['metal', 'metálico'], glass: ['glass', 'vidrio', 'cristal'], wood: ['wood', 'madera'], soft: ['soft', 'suave'], heavy: ['heavy', 'pesado'], paper: ['paper', 'papel'], card: ['card', 'carta', 'tarjeta'], cloth: ['cloth', 'tela'], leather: ['leather', 'cuero'], plastic: ['plastic', 'plástico'], bell: ['bell', 'campana'], door: ['door', 'puerta'], book: ['book', 'libro'], low: ['low', 'grave', 'bajo'] };
function run(binary, parameters, maxBuffer = 12000000) {
  const result = spawnSync(binary, parameters, { windowsHide: true, timeout: 30000, maxBuffer });
  if (result.error || result.status !== 0) throw Error(result.error?.message || result.stderr.toString());
  return result.stdout;
}
const known = new Set(catalog.entries.map(entry => entry.sha256));
let added = 0, duplicates = 0;
for (const pack of packs) {
  if (!['impact', 'scifi', 'casino', 'rpg'].includes(pack.id) || pack.license !== 'CC0-1.0' || !pack.archiveUrl.startsWith('https://kenney.nl/media/pages/assets/')) throw Error('Publisher pack not approved');
  if (sha(await readFile(join(source, basename(pack.zip)))) !== pack.sha256) throw Error('Publisher archive changed');
  const folder = await realpath(join(source, pack.id));
  const rel = relative(source, folder); if (isAbsolute(rel) || rel.startsWith('..')) throw Error('Pack outside source directory');
  const license = await readFile(join(folder, 'License.txt'), 'utf8'); if (!license.includes('CC0')) throw Error('CC0 licence missing');
  await copyFile(join(folder, 'License.txt'), join(target, 'LICENSE-KENNEY-' + pack.id.toUpperCase() + '.txt'));
  const files = await readdir(folder, { withFileTypes: true });
  const oggStems = new Set(files.filter(e => e.isFile() && e.name.endsWith('.ogg')).map(e => e.name.slice(0, -4)));
  for (const file of files) {
    if (!file.isFile() || !/\.(ogg|wav)$/i.test(file.name) || /preview/i.test(file.name) || file.name.endsWith('.wav') && oggStems.has(file.name.slice(0, -4))) continue;
    const stem = file.name.slice(0, -4), rule = pack.map.find(([pattern]) => new RegExp(pattern, 'i').test(stem));
    if (!rule || rule[1] === 'skip' || !families[rule[1]]) continue;
    const bytes = await readFile(join(folder, file.name)), hash = sha(bytes);
    if (known.has(hash)) { duplicates++; continue; }
    const path = `kenney/${pack.id}/${file.name}`, dest = join(target, path);
    try { if (!(await readFile(dest)).equals(bytes)) throw Error('Existing asset differs: ' + path); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await mkdir(join(target, 'kenney', pack.id), { recursive: true }); await copyFile(join(folder, file.name), dest); }
    const metadata = JSON.parse(run(args['--ffprobe'] || 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=sample_rate,channels', '-of', 'json', dest], 100000));
    const duration = Number(metadata.format.duration); if (!Number.isFinite(duration) || duration <= 0 || duration > 30) throw Error('Invalid SFX length: ' + path);
    const words = stem.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\d-]+/g, ' ').toLowerCase().trim().split(/\s+/);
    const tags = [...words, ...rule[2], rule[1], pack.id];
    for (const [word, aliases] of Object.entries(translations)) if (tags.includes(word)) tags.push(...aliases);
    catalog.entries.push({ path, brand: pack.name, title: stem.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' '), provider: 'Kenney', audioType: 'sfx', audioFamily: families[rule[1]], tags: [...new Set(tags)], license: pack.license, url: pack.url, sha256: hash, duration, sampleRate: Number(metadata.streams[0].sample_rate), channels: Number(metadata.streams[0].channels) });
    known.add(hash); added++;
  }
  if (!catalog.providers.some(provider => provider.id === pack.id)) catalog.providers.push({ id: pack.id, name: pack.name, url: pack.url, archiveUrl: pack.archiveUrl, sha256: pack.sha256 });
}
let profiled = 0;
for (const entry of catalog.entries.filter(entry => entry.audioType === 'sfx')) {
  const path = join(target, entry.path); if (sha(await readFile(path)) !== entry.sha256) throw Error('Bundled asset changed: ' + entry.path);
  if (entry.duration > 30) continue;
  const data = run(args['--ffmpeg'] || 'ffmpeg', ['-nostdin', '-v', 'error', '-i', path, '-vn', '-map', '0:a:0', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', '-f', 'f32le', '-']);
  entry.soundProfile = soundProfile(data);
  // Existing curated cuePoint stays intact; measured peak is exposed separately.
  if (entry.cuePoint === undefined && entry.soundProfile.peakOffsetSeconds !== null) entry.cuePoint = entry.soundProfile.peakOffsetSeconds;
  profiled++;
}
await writeFile(join(target, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
await mkdir(join(target, 'sources'), { recursive: true });
await writeFile(join(target, 'sources', 'kenney-motion-packs.json'), JSON.stringify({ version: 1, researchSource: 'https://github.com/Bodila51/opus-sound-layer', researchCommit: '52ac266a24b7dfd3cd06a28c34d5af360a8d7586', selectionLicense: 'MIT; see docs/licenses/LICENSE.opus-sound-layer.txt', packs }, null, 2) + '\n');
console.log(JSON.stringify({ added, duplicates, profiled, total: catalog.entries.length }));
