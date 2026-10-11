// Offline retrieval of acquired reference evidence. Source documents are data.
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const normalize = text => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const words = text => [...new Set(normalize(text).match(/[\p{L}\p{N}]{3,}/gu) ?? [])];
const aliases = {
  cards: /tarjet|cartas|cards|rounded|redondead|bordes|panel/,
  typography: /tipograf|typograph|kinetic|letras|titulos|texto/,
  continuity: /continu|morph|forma|transici|transition|ancla/,
  launch: /lanzamiento|launch|saas|producto|product/,
  interface: /interfaz|interface|demo|screens|cursor|\bui\b/,
  brand: /marca|brand|identidad|identity/,
  web: /web|landing|sitio|pagina/,
  explainer: /expli|diagrama|diagram|education/,
  data: /datos|data|chart|metric|grafico/,
  audio: /sonido|audio|music|musica|beat|ritmo/,
  threeD: /\b3d\b|three.js|webgl|shader/,
  interactive: /juego|game|playable|interactivo|interactive/,
};
const within = (root, path) => { const p = relative(root, path); return p === '' || (!isAbsolute(p) && p !== '..' && !p.startsWith('..' + sep)); };
export const useCases = ['reel', 'storyboard', 'typography', 'product-launch', 'explainer', 'captions', 'camera-3d-captions', 'ui-motion', 'brand', 'data', 'audio', 'rendering', 'general'];
export function referenceUseCases(row) {
  if (row.useCases) return row.useCases;
  const text = normalize(`${row.title} ${row.searchText} ${(row.patterns ?? []).join(' ')}`);
  const match = {
    reel: /\breels?\b|short.form|9:16|tiktok|vertical|showreel/,
    storyboard: /storyboard|beat.sheet|storytelling|narrative|narrativ|guion/,
    typography: /typography|tipograf|kinetic.type|titulos|\btext\b/,
    'product-launch': /launch|lanzamiento|promo|product|saas/,
    explainer: /explainer|expli|diagram|education|educativ/,
    captions: /caption|subtitul|transcript/,
    'camera-3d-captions': /camera.3d.captions|3d.caption|caption.*camera/,
    'ui-motion': /interface|interfaz|\bui\b|microinteraction|web.animation/,
    brand: /brand|marca|identidad|identity/,
    data: /chart|metric|data.viz|visualizacion.*datos/,
    audio: /sound.design|soundtrack|mixing|musica|\bsfx\b/,
    rendering: /renderer|rendering|ffmpeg|export/,
  };
  const found = Object.entries(match).filter(([, re]) => re.test(text)).map(([key]) => key);
  return found.length ? found : ['general'];
}

export async function localFile(root, path) {
  if (!root || !path) return null;
  const candidate = resolve(root, path);
  if (!within(root, candidate)) throw Error('Reference path escapes library.');
  let file;
  try { file = await realpath(candidate); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  if (!within(root, file)) throw Error('Reference symlink escapes library.');
  return (await stat(file)).isFile() ? file : null;
}

export function rankLibrary(catalog, { query = '', id, kind = 'all', useCase, limit = 4, evidence = 'any', capability = 'native2d' } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 8) throw Error('limit must be 1–8.');
  if (!['all', 'video', 'skill'].includes(kind)) throw Error('Unknown reference kind.');
  if (!['any', 'automatic', 'reviewed'].includes(evidence)) throw Error('Unknown evidence filter.');
  if (!['native2d', 'surface3d', 'any'].includes(capability)) throw Error('Unknown capability.');
  if (useCase !== undefined && !useCases.includes(useCase)) throw Error('Unknown use case.');
  if (!id && !query.trim()) throw Error('Provide a query or reference id.');
  const terms = words(query);
  const intents = Object.entries(aliases).filter(([, re]) => re.test(normalize(query))).map(([key]) => key);
  return catalog.entries.filter(row => (kind === 'all' || row.kind === kind)
    && (!useCase || referenceUseCases(row).includes(useCase))
    && (id || capability !== 'native2d' || row.category !== '3d')
    && (id || intents.includes('interactive') || row.category !== 'interactive')
    && (evidence !== 'reviewed' || row.reviewed)
    && (evidence !== 'automatic' || row.media.some(m => m.contactPath))
    && (!id || row.id === id)).map(row => {
      const haystack = normalize(row.searchText);
      const title = normalize(row.title);
      const matched = terms.filter(term => haystack.includes(term));
      const patterns = intents.filter(intent => row.patterns.includes(intent));
      return { row, score: id ? 100 : matched.reduce((n, word) => n + (title.includes(word) ? 3 : 1), 0) + patterns.length * 4 + (row.reviewed ? 1 : 0), reasons: [...patterns, ...matched] };
    }).filter(r => id || r.score > (r.row.reviewed ? 1 : 0))
    .sort((a, b) => b.score - a.score || a.row.id.localeCompare(b.row.id)).slice(0, limit);
}

export async function retrieveLibrary(options = {}) {
  let catalog = options.catalog ?? JSON.parse(await readFile(resolve(skillRoot, 'references/collection-index.json'), 'utf8'));
  if (!options.catalog && !options.library) {
    try {
      const supplement = JSON.parse(await readFile(resolve(skillRoot, 'references/stack-index.json'), 'utf8'));
      const ids = new Set(catalog.entries.map(row => row.id));
      const added = supplement.entries.filter(row => !ids.has(row.id));
      catalog = { ...catalog, entries: [...catalog.entries, ...added], coverage: { ...catalog.coverage, supplementalStackEntries: added.length, stackSnapshot: supplement.snapshot } };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  // Research copies are explicit. Product use never discovers a personal archive.
  const location = options.library;
  let root = null;
  if (location) { try { root = await realpath(location); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
  if (root && !options.catalog) catalog = JSON.parse(await readFile(resolve(root, 'catalog.json'), 'utf8'));
  const maxChars = options.maxChars ?? 16000;
  if (!Number.isInteger(maxChars) || maxChars < 3000 || maxChars > 60000) throw Error('max-chars must be 3000–60000.');
  const result = { schemaVersion: 2, delivery: root ? 'explicit_research_archive' : 'bundled_offline_knowledge', knowledgeAvailable: true, coverage: catalog.coverage, libraryAvailable: Boolean(root), evidenceContract: catalog.evidenceContract, results: [], budgetLimited: false };
  const size = () => JSON.stringify(result, null, 2).length + 1;
  for (const { row, score, reasons } of rankLibrary(catalog, options)) {
    const archived = await localFile(root, row.textPath);
    const bundled = archived ? null : await localFile(skillRoot, row.bundledTextPath);
    const source = archived || bundled;
    const out = { id: row.id, kind: row.kind, title: row.title, author: row.author, score, reasons,
      sources: row.sources, promptStatus: row.promptStatus, patterns: row.patterns, useCases: referenceUseCases(row),
      reviewed: row.reviewed, ownAnalysis: row.ownAnalysis ?? null, sourceAccessible: Boolean(source), sourcePath: source,
      sourceStorage: archived ? 'explicit_research_archive' : bundled ? row.sourceRole === 'syka_original_study' ? 'bundled_original_study' : 'bundled_MIT_text' : 'metadata_and_written_study',
      sourceTextAttribution: bundled ? row.bundledTextSource : null, sourceTextLicense: bundled ? row.bundledTextLicense : null,
      sourceRole: row.sourceRole, rights: row.rights, media: [] };
    for (const m of row.media) out.media.push({ role: m.role, videoPath: await localFile(root, m.path), contactPath: await localFile(root, m.contactPath), automaticEvidencePath: await localFile(root, m.analysisPath), durationSeconds: m.durationSeconds, visualReview: m.visualReview });
    result.results.push(out);
    if (size() > maxChars - 100) { result.results.pop(); result.budgetLimited = true; break; }
    if (options.includeText && source) {
      const text = await readFile(source, 'utf8');
      out.sourceCharacters = text.length;
      out.sourceTruncated = true;
      out.sourceText = '';
      let lo = 0, hi = text.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        out.sourceText = text.slice(0, mid);
        if (size() <= maxChars - 100) lo = mid; else hi = mid - 1;
      }
      out.sourceText = text.slice(0, lo);
      out.sourceTruncated = lo !== text.length;
      result.budgetLimited ||= out.sourceTruncated;
    }
  }
  return result;
}

function parse(args) {
  const out = {}, values = { '--query': 'query', '--id': 'id', '--kind': 'kind', '--use-case': 'useCase', '--limit': 'limit', '--evidence': 'evidence', '--library': 'library', '--max-chars': 'maxChars', '--capability': 'capability' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--include-text') out.includeText = true;
    else if (values[args[i]] && args[i + 1] && !args[i + 1].startsWith('--')) {
      const key = values[args[i]];
      out[key] = ['limit', 'maxChars'].includes(key) ? Number(args[++i]) : args[++i];
    } else throw Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(await retrieveLibrary(parse(process.argv.slice(2))), null, 2) + '\n'); }
  catch (e) { process.stderr.write(e.message + '\n'); process.exitCode = 1; }
}
