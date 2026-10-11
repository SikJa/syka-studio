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
    if (!['CC0-1.0', 'MIT'].includes(entry.license) || !Number.isFinite(entry.duration) || entry.duration <= 0) throw Error('Missing sound rights/duration: ' + entry.path);
    bytes += data.length; if (entry.soundProfile) profiled++;
    const provider = entry.path.startsWith('kenney/') ? entry.path.split('/')[1] : entry.provider;
    providers[provider] = (providers[provider] || 0) + 1;
    types[entry.audioType] = (types[entry.audioType] || 0) + 1;
  }
  for (const id of Object.keys(providers).filter(id => id !== 'Syka')) {
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
