/** Verify assets that must work from the installed app, without personal folders. */
import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function checkSoundCatalog(docsDir) {
  const root = await realpath(join(docsDir, 'resources', 'sounds'));
  const catalog = JSON.parse(await readFile(join(root, 'catalog.json'), 'utf8'));
  if (catalog.version !== 1 || !Array.isArray(catalog.entries) || !catalog.entries.length) throw Error('Empty or invalid bundled sound catalog');
  const paths = new Set(), providers = {}, types = {};
  let bytes = 0, profiled = 0;
  for (const entry of catalog.entries) {
    if (typeof entry.path !== 'string' || /^(?:[a-z]:|\/|\\)/i.test(entry.path) || entry.path.split(/[\\/]/).includes('..') || paths.has(entry.path)) throw Error('Invalid or duplicated bundled sound path');
    paths.add(entry.path);
    const path = await realpath(join(root, entry.path)), rel = relative(root, path);
    if (isAbsolute(rel) || rel.startsWith('..') || !(await stat(path)).isFile()) throw Error('Sound outside app resources: ' + entry.path);
    const data = await readFile(path);
    if (createHash('sha256').update(data).digest('hex') !== entry.sha256) throw Error('Bundled sound hash mismatch: ' + entry.path);
    if ((entry.path.startsWith('cuelume/') || entry.provider === 'Cuelume') &&
      (!entry.path.startsWith('cuelume/') || entry.provider !== 'Cuelume' || entry.license !== 'MIT')) throw Error('Cuelume rights metadata missing: ' + entry.path);
    if ((entry.path.startsWith('earshot/') || entry.provider === 'Earshot') &&
      (!entry.path.startsWith('earshot/') || entry.provider !== 'Earshot' || entry.license !== 'MIT' || entry.audioType !== 'sfx')) throw Error('Earshot rights metadata missing: ' + entry.path);
    if ((entry.path.startsWith('bencho/') || entry.provider === 'Bencho') &&
      (!entry.path.startsWith('bencho/') || entry.provider !== 'Bencho' || entry.license !== 'MIT' || entry.audioType !== 'sfx')) throw Error('Bencho rights metadata missing: ' + entry.path);
    const allowedLicense = ['CC0-1.0', 'MIT'].includes(entry.license) || (entry.provider === 'OpenDesign' && entry.path.startsWith('opendesign/') && entry.license === 'Apache-2.0');
    if (!allowedLicense || !Number.isFinite(entry.duration) || entry.duration <= 0) throw Error('Missing sound rights/duration: ' + entry.path);
    bytes += data.length; if (entry.soundProfile) profiled++;
    const provider = entry.path.startsWith('kenney/') ? entry.path.split('/')[1] : entry.provider;
    providers[provider] = (providers[provider] || 0) + 1;
    types[entry.audioType] = (types[entry.audioType] || 0) + 1;
  }
  if (providers.Cuelume) {
    const license = await readFile(join(root, 'LICENSE-CUELUME.txt'), 'utf8');
    const source = JSON.parse(await readFile(join(root, 'sources', 'cuelume.json'), 'utf8'));
    if (!license.includes('MIT License') || !license.includes('Daniel Belyi') ||
      createHash('sha256').update(license).digest('hex') !== source.licenseSha256 ||
      source.provider !== 'Cuelume' || source.license !== 'MIT' || !/^[a-f0-9]{40}$/.test(source.commit) || !Array.isArray(source.files))
      throw Error('Cuelume license or provenance missing');
    const sourcePaths = new Map(source.files.map(file => [file.path, file.sha256]));
    for (const entry of catalog.entries.filter(entry => entry.provider === 'Cuelume')) {
      if (!entry.path.startsWith('cuelume/') || entry.license !== 'MIT' || sourcePaths.get(entry.path) !== entry.sha256)
        throw Error('Unverified Cuelume derivative: ' + entry.path);
    }
  }
  if (providers.OpenDesign) {
    const license = await readFile(join(root, 'LICENSE-OPENDESIGN.txt'), 'utf8');
    const source = JSON.parse(await readFile(join(root, 'sources/opendesign.json'), 'utf8'));
    if (!license.includes('Apache License') || source.provider !== 'OpenDesign' || source.license !== 'Apache-2.0' ||
      source.licenseSha256 !== createHash('sha256').update(license).digest('hex') || source.originalReferencePostAudio !== false || !Array.isArray(source.files)) throw Error('OpenDesign license/provenance missing');
    const files = new Map(source.files.map(file => [file.path, file]));
    for (const entry of catalog.entries.filter(entry => entry.provider === 'OpenDesign')) {
      const provenance = files.get(entry.path);
      if (entry.license !== 'Apache-2.0' || entry.audioType !== 'music' || !entry.compositionFamily || provenance?.sha256 !== entry.sha256 || !/^[a-f0-9]{40}$/.test(provenance?.gitBlob ?? '')) throw Error('Unverified OpenDesign score: ' + entry.path);
    }
  }
  if (providers.Earshot) {
    const license = await readFile(join(root,'LICENSE-EARSHOT.txt'));
    const credits = await readFile(join(root,'CREDITS-EARSHOT-FIT.md'));
    const source = JSON.parse(await readFile(join(root,'sources/earshot.json'),'utf8'));
    if (!license.toString().includes('MIT License') || !license.toString().includes('Leon Lin') || !credits.toString().includes('CC0 1.0') ||
      source.provider !== 'Earshot' || source.license !== 'MIT' || !/^[a-f0-9]{40}$/.test(source.commit) || !/^[a-f0-9]{64}$/.test(source.sourceTreeSha256 ?? '') ||
      source.licenseSha256 !== createHash('sha256').update(license).digest('hex') || source.creditsSha256 !== createHash('sha256').update(credits).digest('hex') || source.render?.modelsLoaded !== false || !Array.isArray(source.files)) throw Error('Earshot license/provenance missing');
    const files = new Map(source.files.map(file=>[file.path,file]));
    for (const entry of catalog.entries.filter(entry=>entry.provider==='Earshot')) {
      const proof = files.get(entry.path);
      if (proof?.sha256 !== entry.sha256 || proof.measurements?.checks?.ok !== true || proof.sourceCue !== entry.sourceCue || entry.sourceCommit !== (proof.sourceCommit ?? source.commit) || !/^[a-f0-9]{64}$/.test(proof?.recipeSha256 ?? '') ||
        entry.sourceCue?.startsWith('fit/') && (entry.recordingLicense !== 'CC0-1.0' || proof.recordingSource?.license !== 'CC0 1.0' || !proof.recordingSource?.url?.startsWith('https://freesound.org/'))) throw Error('Unverified Earshot derivative: '+entry.path);
    }
    if (source.version >= 3) {
      const kitRoot=await realpath(join(docsDir,'skills/syka-local-audio/resources/earshot-launch'));
      const kit=JSON.parse(await readFile(join(kitRoot,'kit.lock.json'),'utf8'));
      const kitLicense=await readFile(join(kitRoot,'LICENSE.txt'));
      if(kit.earshot!=='0.4.0'||kit.source?.modelsLoaded!==false||kit.source.commit!==source.commit||createHash('sha256').update(kitLicense).digest('hex')!==source.licenseSha256)throw Error('Launch kit provenance missing');
      const names=new Set();let roles=0,takes=0;
      for(const role of Object.values(kit.roles).filter(Boolean)) {
        roles++;
        if(!['onset','peak','end'].includes(role.align)||!Number.isFinite(role.bed_db)||!Number.isFinite(role.offset_ms))throw Error('Invalid launch role');
        for(const take of role.takes) {
          if(!/^[a-zA-Z0-9_.-]+\.wav$/.test(take.file)||names.has(take.file)||take.checks.length||!Number.isFinite(take.l50_lufs))throw Error('Invalid launch take');
          names.add(take.file);takes++;
          const path=await realpath(join(kitRoot,take.file));
          if(relative(kitRoot,path).startsWith('..')||createHash('sha256').update(await readFile(path)).digest('hex')!==take.sha256)throw Error('Launch take hash mismatch');
        }
      }
      if(roles!==20||takes!==72)throw Error('Incomplete Earshot launch kit');
    }
  }
  if(providers.Bencho) {
    const license=await readFile(join(root,'LICENSE-BENCHO.txt')),credits=await readFile(join(root,'CREDITS-BENCHO.md'));
    const source=JSON.parse(await readFile(join(root,'sources/bencho.json'),'utf8'));
    if(source.provider!=='Bencho'||source.freeOnly!==true||source.license!=='MIT'||source.commit!=='30ab35a575eb83eed8f086a6893d4d6426f4fa91'||source.render?.modelsLoaded!==false||source.files?.length!==24||providers.Bencho!==24||
      !license.toString().includes('Copyright (c) 2026 Lorenzo Cabra')||!credits.toString().includes('Copyright (c) 2026 Daniel Belyi')||
      source.licenseSha256!==createHash('sha256').update(license).digest('hex')||source.creditsSha256!==createHash('sha256').update(credits).digest('hex'))throw Error('Bencho license/provenance missing');
    const files=new Map(source.files.map(file=>[file.path,file]));
    for(const entry of catalog.entries.filter(entry=>entry.provider==='Bencho')) {
      const proof=files.get(entry.path);
      if(proof?.sha256!==entry.sha256||proof.sourceCue!==entry.sourceCue||entry.sourceCommit!==source.commit||!/^[a-f0-9]{64}$/.test(proof.recipeSha256)||entry.sampleRate!==48000||entry.channels!==2||entry.bitDepth!==24||entry.cuePoint<0||entry.cuePoint>=entry.duration)throw Error('Unverified Bencho derivative: '+entry.path);
      const bytes=await readFile(join(root,entry.path));
      if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE'||bytes.readUInt32LE(24)!==48000||bytes.readUInt16LE(22)!==2||bytes.readUInt16LE(34)!==24||bytes.readUInt32LE(40)!==Math.round(entry.duration*48000)*6||!bytes.includes(license)||!bytes.includes(credits))throw Error('Invalid Bencho WAV or embedded notices: '+entry.path);
    }
  }
  for (const id of Object.keys(providers).filter(id => !['Syka','Cuelume','OpenDesign','Earshot','Bencho'].includes(id))) {
    const license = await readFile(join(root, 'LICENSE-KENNEY-' + id.toUpperCase() + '.txt'), 'utf8');
    if (!license.includes('CC0')) throw Error('CC0 license missing for ' + id);
  }
  await readFile(join(root, 'LICENSE-SYKA.txt'), 'utf8');
  if (providers.impact || providers.scifi || providers.casino || providers.rpg) {
    await readFile(join(root, 'sources', 'kenney-motion-packs.json'), 'utf8');
    await readFile(join(docsDir, 'licenses', 'LICENSE.opus-sound-layer.txt'), 'utf8');
  }
  return { count: paths.size, bytes, mebibytes: Math.round(bytes / 1024 ** 2 * 100) / 100, profiled, providers, types };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  console.log(JSON.stringify(await checkSoundCatalog(process.argv[2] || join(repo, 'docs'))));
}
