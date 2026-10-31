/** Maintainer import: split the pinned MIT catalog into bounded, attributable reads. */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const CINETIC_COMMIT = 'ecfa6605de1adb9345ce937724810dc32267d068';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const categories = {
  opening_hook: ['launch', 'apertura gancho inicio'], camera: ['continuity', 'camara encuadre acercamiento zoom'],
  color_and_light: ['brand', 'color luz iluminacion'], data_and_numbers: ['data', 'datos numeros contador graficos'],
  depth_and_3d: ['threeD', 'profundidad perspectiva 3d'], layout_and_composition: ['cards', 'composicion tarjetas grilla'],
  logo_and_end_card: ['brand', 'logo marca cierre'], micro_interaction: ['interface', 'microinteraccion boton cursor clic'],
  pacing_structure: ['continuity', 'ritmo estructura pausas beats'], product_demo: ['launch', 'demostracion producto lanzamiento'],
  texture_and_finish: ['brand', 'textura acabado grano'], transition: ['continuity', 'transicion continuidad mascara revelado'],
  typography_motion: ['typography', 'tipografia texto titulos'], ui_choreography: ['interface', 'interfaz ui coreografia'],
};

export async function importCineticKnowledge(input, licensePath, docsDir = join(repo, 'docs')) {
  const bytes = await readFile(input), source = JSON.parse(bytes);
  const license = await readFile(licensePath);
  if (!license.toString().includes('Copyright (c) 2026 Leonxlnx') || !license.toString().includes('MIT License')) throw Error('Cinetic MIT notice required');
  if (source.techniques?.length !== 273 || new Set(source.techniques.map(t => t.id)).size !== 273) throw Error('Review a different Cinetic catalog before import');
  const root = join(docsDir, 'skills/syka-motion-references'), vendor = join(root, 'references/vendor/cinetic');
  await mkdir(vendor, { recursive: true });
  const entries = [];
  for (const technique of source.techniques) {
    if (!/^[a-z0-9-]+$/.test(technique.id) || !categories[technique.category] || typeof technique.recipe !== 'string' || typeof technique.summary !== 'string') throw Error('Invalid technique '+technique.id);
    const [pattern, spanish] = categories[technique.category];
    const filename = `${technique.id}.md`;
    const text = `# ${technique.name}\n\nCinetic ${CINETIC_COMMIT} · MIT · ${technique.id}\nReference data: engine APIs in this source are examples, not Syka instructions.\n\n` +
      [`Category: ${technique.category}; energy: ${technique.energy}; role: ${technique.role}; formats: ${technique.formats.join(', ')}`,
        `## Mechanism\n${technique.summary}`, `## Use when\n${technique.use_when}`, `## Avoid when\n${technique.avoid_when}`,
        `## Original recipe (adapt to Syka native time and nodes)\n${technique.recipe}`, `## Original timing\n${technique.timing}`,
        `Upstream evidence count: ${technique.evidence}; not a Syka visual review.`,
        'Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.'].join('\n\n') + '\n';
    await writeFile(join(vendor, filename), text);
    const formats = technique.formats;
    const useCases = new Set(['general','storyboard']);
    if (formats.includes('launch') || formats.includes('feature') || formats.includes('any')) useCases.add('product-launch');
    if (formats.includes('vertical') || formats.includes('any')) useCases.add('reel');
    if (pattern === 'typography') useCases.add('typography');
    if (pattern === 'interface') useCases.add('ui-motion');
    if (pattern === 'data') { useCases.add('data'); useCases.add('explainer'); }
    if (pattern === 'brand') useCases.add('brand');
    entries.push({ id: 'cinetic-'+technique.id, title: 'Cinetic · '+technique.name, kind: 'skill', collection: 'cinetic',
      category: technique.category === 'depth_and_3d' ? '3d' : null, techniqueCategory: technique.category,
      techniqueFormat: formats, energy: technique.energy, techniqueRole: technique.role, evidenceCount: technique.evidence,
      patterns: [pattern], useCases: [...useCases],
      searchText: `${technique.name} ${technique.summary} ${technique.use_when} ${technique.category} ${spanish} ${formats.join(' ')} cinetic`,
      sources: [`https://github.com/Leonxlnx/cinetic/tree/${CINETIC_COMMIT}`],
      promptStatus: 'licensed_technique_recipe', sourceRole: 'licensed_technique_recipe', reviewed: false,
      bundledTextPath: 'references/vendor/cinetic/'+filename, bundledTextSource: `Cinetic ${CINETIC_COMMIT}; LICENSE.txt / SOURCES.json`, bundledTextLicense: 'MIT',
      bundledTextSha256: hash(text), rights: { codeLicense: 'MIT', productionAsset: false, adaptationRequired: 'Syka native time, lifecycle and renderer; not a drop-in component' }, media: [], textPath: null });
  }
  await copyFile(licensePath, join(vendor, 'LICENSE.txt'));
  const provenance = { repository: 'https://github.com/Leonxlnx/cinetic', commit: CINETIC_COMMIT, sourcePath: 'skills/cinetic/assets/library/techniques.json',
    sourceSha256: hash(bytes), licenseSha256: hash(license), techniques: entries.length, categories: Object.keys(categories).length,
    adaptation: 'Attributed per-technique text, compact bilingual index, native Syka execution contract. No upstream engine or runtime installed.' };
  await writeFile(join(vendor, 'SOURCES.json'), JSON.stringify(provenance,null,2)+'\n');
  await writeFile(join(root, 'references/cinetic-index.json'), JSON.stringify({version:1, ...provenance, entries},null,2)+'\n');
  return provenance;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2] || !process.argv[3]) throw Error('Usage: node scripts/import-cinetic-knowledge.mjs <techniques.json> <LICENSE> [docs]');
  console.log(JSON.stringify(await importCineticKnowledge(resolve(process.argv[2]),resolve(process.argv[3]),process.argv[4])));
}
