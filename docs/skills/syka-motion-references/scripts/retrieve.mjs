// Offline, bounded reference retrieval. Never executes or downloads source text.
import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultLibrary = resolve(skillRoot, '../../references/prompt-motion');
const aliases = {
  'saas-launch': /saas|lanzamiento|launch|producto|product|app|spotify|marca/,
  'kinetic-type': /tipograf|typograph|kinetic|letras|palabras|texto|words|showreel/,
  'anchor-morph': /morph|forma|shape|continuidad|continuity|transform|ancla|anchor/,
  'ui-demo': /interfaz|interface|cursor|boton|\b(?:click|button|timeline|slider|toggle|ui|demo)\b/,
  'spoken-word': /discurso|speech|spoken.word|arquitectura|architecture|palabras.*(?:constru|soporte)/,
  'explainer': /expli|diagrama|diagram|tutorial|recurs|lesson/,
  'data-story': /datos|data|grafico|chart|metric|cifra|contador|counter/,
  'gallery': /galeria|gallery|carrusel|carousel|coleccion|portfolio|fotos|photos|album/,
  'portal-parallax': /portal|parallax|collage|zoom infinito|infinite zoom/,
  'three-dimensional': /\b3d\b|three|shader|glsl|webgl/,
  'audio-sync': /musica|music|bpm|beat|sonido|sound|audio|ritmo|compas/,
  'interactive': /juego|game|playable|interactivo|interactive/,
};
const stop = new Set('the and for with from this that make create video animation motion de la el un una en con para por del los las que y mi of to a an is it as on or my'.split(' '));
const clean = text => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const tokens = text => [...new Set((clean(text).match(/[\p{L}\p{N}]{2,}/gu) ?? []).filter(x => !stop.has(x)))];
const within = (root, path) => { const rel = relative(root, path); return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep)); };

export async function loadCatalog(path = resolve(skillRoot, 'references/catalog.json')) {
  const data = JSON.parse(await readFile(path, 'utf8'));
  if (data.schemaVersion !== 1 || !Array.isArray(data.entries)) throw Error('Unsupported reference catalog.');
  return data;
}

export function rankReferences(catalog, { query = '', id, limit = 3, capability = 'native2d', visualOnly = false, completeOnly = false } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 8) throw Error('limit must be 1–8.');
  if (!['native2d', 'html', 'surface3d', 'any'].includes(capability)) throw Error('Unknown capability.');
  if (id) return catalog.entries.filter(e => e.id === id).map(entry => ({ entry, score: null, reasons: ['exact reference id'] }));
  if (!query.trim()) throw Error('Provide a query or reference id.');
  const terms = tokens(query);
  const intent = Object.entries(aliases).filter(([, re]) => re.test(clean(query))).map(([tag]) => tag);
  const df = new Map(terms.map(term => [term, catalog.entries.filter(e => Object.keys(e.searchTerms).some(word => clean(word) === term)).length]));
  const candidates = [];
  for (const entry of catalog.entries) {
    if (visualOnly && entry.visualReview !== 'sampled_frames_reviewed') continue;
    if (completeOnly && entry.prompt?.status !== 'declared_complete') continue;
    if (capability === 'native2d' && entry.tags.includes('three-dimensional') && !entry.tags.includes('anchor-morph') && !entry.tags.includes('kinetic-type')) continue;
    if (!intent.includes('interactive') && entry.category === 'interactive') continue;
    const matchedIntent = intent.filter(t => entry.tags.includes(t));
    const title = clean(entry.title + ' ' + entry.author);
    const bag = new Map(Object.entries(entry.searchTerms).map(([w, n]) => [clean(w), n]));
    const matchedWords = terms.filter(t => title.includes(t) || bag.has(t));
    if (!matchedIntent.length && !matchedWords.length) continue;
    let score = matchedIntent.length * 4;
    for (const term of matchedWords) {
      const frequency = Math.min(bag.get(term) ?? 1, 5);
      const idf = Math.log(1 + (catalog.entries.length + 1) / ((df.get(term) ?? 0) + 1));
      score += idf * (title.includes(term) ? 1.5 : 0.45) * frequency / (frequency + 1);
    }
    const reviewed = entry.visualReview === 'sampled_frames_reviewed';
    if (reviewed) score += 4;
    if (entry.prompt?.status === 'declared_complete') score += 1;
    if (entry.prompt?.characters >= 1500) score += 1;
    if (entry.tags.includes('external-generation') && capability !== 'any') score -= 3;
    if (entry.tags.includes('interactive') && !intent.includes('interactive')) score -= 3;
    candidates.push({ entry, score: Math.round(score * 100) / 100,
      reasons: [...matchedIntent.map(t => `intent: ${t}`), ...matchedWords.map(t => `word: ${t}`), ...(reviewed ? ['sampled visual evidence'] : [])] });
  }
  candidates.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  const seen = new Set();
  return candidates.filter(({ entry }) => { if (seen.has(entry.promptGroup)) return false; seen.add(entry.promptGroup); return true; }).slice(0, limit);
}

async function localPrompt(entry, library) {
  if (!entry.prompt) return null;
  let root;
  try { root = await realpath(library); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const candidate = resolve(root, entry.prompt.path);
  if (!within(root, candidate)) throw Error('Prompt path escapes library.');
  let path;
  try { path = await realpath(candidate); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!within(root, path)) throw Error('Prompt symlink escapes library.');
  return { path, content: await readFile(path, 'utf8') };
}

export async function retrieve(options = {}) {
  const maxChars = options.maxChars ?? 14000;
  if (!Number.isInteger(maxChars) || maxChars < 3000 || maxChars > 60000) throw Error('max-chars must be 3000–60000.');
  const catalog = options.catalog ?? await loadCatalog();
  const ranked = rankReferences(catalog, options);
  const result = { schemaVersion: 1, query: options.query ?? null, matched: ranked.length,
    evidenceContract: catalog.evidenceContract, maxChars, results: [], returned: 0, budgetLimited: false };
  const size = () => JSON.stringify(result, null, 2).length + 1;
  for (const { entry, score, reasons } of ranked) {
    const local = await localPrompt(entry, options.library ?? defaultLibrary);
    const row = { id: entry.id, title: entry.title, author: entry.author, score, reasons,
      tags: entry.tags, postUrl: entry.postUrl, viewUrl: entry.viewUrl,
      sources: entry.sources, promptStatus: entry.prompt?.status ?? 'website_only_not_retained',
      textVariantsDiffer: entry.textVariantsDiffer ?? false, visualReview: entry.visualReview,
      analysisFile: entry.analysisFile ? resolve(skillRoot, entry.analysisFile) : null,
      observations: entry.observations ?? null, transferable: entry.transferable ?? null,
      nativeAdaptation: entry.nativeAdaptation ?? null, capabilityGaps: entry.capabilityGaps ?? null,
      modelEvidence: entry.modelEvidence, rights: entry.rights,
      localPromptAvailable: Boolean(local), localPromptPath: local?.path ?? null,
      promptGroup: entry.promptGroup };
    result.results.push(row);
    if (size() > maxChars - 100) { result.results.pop(); break; }
    if (options.includePrompt && local) {
      row.promptCharacters = local.content.length;
      row.promptTruncated = true;
      row.promptText = '';
      let lo = 0, hi = local.content.length;
      while (lo < hi) {
        const middle = Math.ceil((lo + hi) / 2);
        row.promptText = local.content.slice(0, middle);
        if (size() <= maxChars - 100) lo = middle; else hi = middle - 1;
      }
      row.promptText = local.content.slice(0, lo);
      row.promptTruncated = lo !== local.content.length;
    }
  }
  result.returned = result.results.length;
  result.budgetLimited = result.returned < result.matched || result.results.some(r => r.promptTruncated);
  return result;
}

function parseArgs(args) {
  const out = {};
  const flags = { '--visual-only': 'visualOnly', '--complete-only': 'completeOnly', '--include-prompt': 'includePrompt' };
  const values = { '--query': 'query', '--id': 'id', '--limit': 'limit', '--capability': 'capability', '--max-chars': 'maxChars', '--library': 'library' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (flags[arg]) out[flags[arg]] = true;
    else if (values[arg] && args[i + 1] && !args[i + 1].startsWith('--')) out[values[arg]] = ['limit', 'maxChars'].includes(values[arg]) ? Number(args[++i]) : args[++i];
    else throw Error(`Unknown or incomplete argument: ${arg}`);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(await retrieve(parseArgs(process.argv.slice(2))), null, 2) + '\n'); }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
