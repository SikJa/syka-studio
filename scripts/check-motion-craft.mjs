/** Offline distribution check for the pinned, selectively read motion references. */
import { readFile, realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export async function checkMotionCraft(docs) {
  const root = await realpath(join(docs, 'skills/syka-motion-references'));
  const index = JSON.parse(await readFile(join(root, 'references/motion-craft-index.json'), 'utf8'));
  if (index.sourceRef !== 'open-design-v0.25.0' || index.entries.length !== 216) throw Error('Unexpected motion craft snapshot');
  const paths = new Set(), ids = new Set(), counts = { 'motion-lab': 0, 'huashu-art-motion': 0 };
  let bytes = 0;
  for (const row of index.entries) {
    const provider = Object.keys(counts).find(provider => row.id.startsWith(provider + '-'));
    if (!provider || ids.has(row.id) || paths.has(row.bundledTextPath) || row.bundledTextLicense !== 'MIT' || !row.bundledTextPath.startsWith(`references/vendor/${provider}/`)) throw Error('Invalid reference entry');
    const path = await realpath(join(root, row.bundledTextPath)), rel = relative(root, path);
    if (isAbsolute(rel) || rel.startsWith('..') || !(await lstat(path)).isFile()) throw Error('Reference escapes resources');
    const content = await readFile(path);
    if (createHash('sha256').update(content).digest('hex') !== row.bundledTextSha256) throw Error('Reference hash mismatch: ' + row.id);
    bytes += content.length; counts[provider]++; ids.add(row.id); paths.add(row.bundledTextPath);
  }
  const provenance = JSON.parse(await readFile(join(docs, 'licenses/opendesign-motion-sources.json'), 'utf8'));
  for (const provider of Object.keys(counts)) for (const name of ['LICENSE', 'SOURCES.md']) {
    const source = provenance.files.find(file => file.path === `skills/${provider}/${name}`);
    const content = await readFile(join(root, 'references/vendor', provider, name));
    if (!source || createHash('sha256').update(content).digest('hex') !== source.sha256) throw Error('Missing original attribution: ' + provider);
  }
  if (counts['motion-lab'] !== 160 || counts['huashu-art-motion'] !== 56) throw Error('Reference collection incomplete');
  return { references: ids.size, ...counts, bytes };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  console.log(JSON.stringify(await checkMotionCraft(process.argv[2] || join(repo, 'docs'))));
}
