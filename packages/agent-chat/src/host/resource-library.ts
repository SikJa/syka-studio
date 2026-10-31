import { readFile, realpath, stat, mkdir, writeFile, rename } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, isAbsolute, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { SOUND_CATEGORIES, soundFamily, type SoundFamily } from './sound-categories';
import type { SoundProfile } from './audio-spectrum';
import { resourceScore, logoScore, logoBrandKey, featuredLogoRank } from './creative-search';
import { bumpResourceRevision, resourceFiles, resourceRevision } from './resource-index';
import { createReadStream } from 'node:fs';
import { classifyAudio, readAudioAnnotations, writeAudioAnnotation, type AudioType } from './audio-classification';

export type ResourceKind = 'logos' | 'sounds' | 'motions';
export type ResourceFolder = { kind: ResourceKind; path: string; bundled?: boolean; classification?: AudioType };
export type ResourceEntry = { variants?: ResourceEntry[]; kind: ResourceKind; path: string; name: string; brand: string; bytes: number; categories?: string[]; id?: string; sha256?: string; compositionFamily?: string; relevance?: number; origin?: 'bundled' | 'personal'; variant?: string; theme?: string; url?: string; brandUrl?: string; title?: string; tags?: string[]; audioType?: AudioType; classificationSource?: 'catalog' | 'manual' | 'folder' | 'filename' | 'unknown'; audioFamily?: SoundFamily; duration?: number; bpm?: number; cuePoint?: number; soundProfile?: SoundProfile; loop?: boolean; license?: string; provider?: string; componentPath?: string; componentFiles?: string[]; usage?: string; posterPath?: string };
export type ResourceRequest = { refresh?: boolean; groupBrands?: boolean; action: 'list' | 'add-folder' | 'remove-folder' | 'preview' | 'classify'; kind?: ResourceKind; path?: string; query?: string; offset?: number; limit?: number; audioType?: AudioType | 'unclassified'; audioFamily?: SoundFamily; brightness?: 'dark' | 'balanced' | 'bright'; attack?: 'sharp' | 'soft'; classification?: AudioType | 'auto'; tags?: string[]; compositionFamily?: string; license?: string; bpm?: number; duration?: number; title?: string; includeUnclassified?: boolean };
export type ResourceResult = { folders: ResourceFolder[]; entries: ResourceEntry[]; total: number; nextOffset: number | null; warnings: string[]; preview?: string; audioCategories?: {id:SoundFamily;title:string;count:number}[] };
const kinds: ResourceKind[] = ['logos', 'sounds', 'motions'];
const extensions = { logos: ['.svg'], sounds: ['.wav', '.mp3', '.ogg', '.flac', '.m4a'], motions: ['.mp4', '.webm', '.mov', '.gif'] };
const motionPreviewExtensions = [...extensions.motions, '.png', '.jpg', '.jpeg', '.webp'];
const inside = (root: string, file: string) => { const rel = relative(root, file); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep); };
async function load(file: string): Promise<ResourceFolder[]> {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(data?.folders) || data.folders.some((f: ResourceFolder) => !f || !kinds.includes(f.kind) || typeof f.path !== 'string' || !isAbsolute(f.path))) throw Error('Configuración de bibliotecas inválida');
    return data.folders;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}
const mutations = new Map<string, Promise<unknown>>();
// Bounded content cache: unchanged audio/SVGs are not read/hashed on every query.
const audioHashes = new Map<string, { signature: string; result: Promise<string> }>();
type ResourceCatalog = { version: number; entries: Array<Partial<ResourceEntry> & { path: string; brand: string; category?: string | string[] }> };
const catalogReads = new Map<string, { signature: string; result: Promise<ResourceCatalog> }>();
async function readCatalog(path: string) {
  const info = await stat(path), signature = `${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
  const previous = catalogReads.get(path);
  if (previous?.signature === signature) return previous.result;
  if (catalogReads.size >= 12) catalogReads.delete(catalogReads.keys().next().value!);
  const result = readFile(path, 'utf8').then(text => JSON.parse(text) as ResourceCatalog);
  catalogReads.set(path, { signature, result });
  void result.catch(() => { if (catalogReads.get(path)?.result === result) catalogReads.delete(path); });
  return result;
}
export async function resourceFileHash(path: string, supplied?: {size:number;mtimeMs:number;ctimeMs:number}) {
  const info = supplied ?? await stat(path);
  if (info.size > 512 * 1024 ** 2) throw Error('El archivo supera 512 MiB; prepará una sección útil para registrar su selección.');
  const signature = `${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
  const previous = audioHashes.get(path);
  if (previous?.signature === signature) return previous.result;
  if (audioHashes.size >= 4096) audioHashes.delete(audioHashes.keys().next().value!);
  const result = (async()=>{const hash=createHash('sha256');for await(const bytes of createReadStream(path))hash.update(bytes);return hash.digest('hex');})();
  audioHashes.set(path,{signature,result});
  void result.catch(()=>{if(audioHashes.get(path)?.result===result)audioHashes.delete(path);});
  return result;
}
export type ResourceRecommendation = { excludeIds?: string[]; recentIds?: string[]; recentFamilies?: string[]; preferredIds?: string[]; seed?: string };
const audioMetadata = new Set(['title', 'tags', 'audioType', 'classificationSource', 'audioFamily', 'duration', 'bpm', 'cuePoint', 'soundProfile', 'loop', 'license', 'provider', 'compositionFamily', 'url', 'brandUrl']);
/** Identical bytes keep the personal path, but do not lose known catalog facts. */
function mergeAudioAliases(first: ResourceEntry, other: ResourceEntry): ResourceEntry {
  const rank = (entry: ResourceEntry) => ({ manual: 4, folder: 3, catalog: 2, filename: 1, unknown: 0 })[entry.classificationSource ?? 'unknown'];
  const [fallback, preferred] = rank(first) >= rank(other) ? [other, first] : [first, other];
  const metadata = (entry: ResourceEntry) => Object.fromEntries(Object.entries(entry).filter(([key, value]) => audioMetadata.has(key) && value !== undefined));
  return { ...first, ...metadata(fallback), ...metadata(preferred), relevance: Math.max(first.relevance ?? 0, other.relevance ?? 0) };
}
const PREVIEW_TYPES: Record<string,string> = {'.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.flac':'audio/flac','.m4a':'audio/mp4','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.gif':'image/gif','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
/** The single check for "may this file be previewed": inside a connected or bundled folder, known type, bounded size. */
async function previewTarget(folders: ResourceFolder[], requested: string | undefined, bundledLogos?: string, bundledSounds?: string, bundledMotions?: string) {
  const all = [...folders];
  for (const [kind, directory] of [['logos',bundledLogos],['sounds',bundledSounds],['motions',bundledMotions]] as const) {
    if (directory) all.push({kind,path:directory,bundled:true});
  }
  if (!requested) throw Error('Recurso requerido');
  const path = await realpath(requested);
  const extension = extname(path).toLowerCase(), kind:ResourceKind = extension === '.svg' ? 'logos' : motionPreviewExtensions.includes(extension) ? 'motions' : 'sounds';
  const allowed = await Promise.all(all.filter(f => f.kind === kind).map(async f => { try { return inside(await realpath(f.path), path); } catch { return false; } }));
  const size = (await stat(path)).size;
  if (!allowed.some(Boolean) || !(kind==='motions'?motionPreviewExtensions:extensions[kind]).includes(extension) || size > (kind==='logos'?2:24) * 1024 * 1024) throw Error('Recurso fuera de la biblioteca o demasiado grande');
  return { path, kind, size, mediaType: PREVIEW_TYPES[extension]! };
}

/** Validated audio/video/image preview to stream from disk instead of copying it as base64 over IPC. */
export async function resourcePreviewMedia(config: string, requested: string, bundledLogos?: string, bundledSounds?: string, bundledMotions?: string) {
  const target = await previewTarget(await load(config), requested, bundledLogos, bundledSounds, bundledMotions);
  if (target.kind === 'logos') throw Error('Los SVG se validan y entregan como vista previa segura.');
  return target;
}

// The ordered list of a query, reused for its other pages and repeated keystrokes
// until any library change bumps the revision. A short TTL covers filesystems
// without change notifications.
type ListedResults = { revision: number; at: number; folders: ResourceFolder[]; results: ResourceEntry[]; warnings: string[]; audioCategories?: ResourceResult['audioCategories'] };
const listCache = new Map<string, ListedResults>();
const LIST_CACHE_MS = 10_000;
const listKey = (config: string, req: ResourceRequest, dirs: (string | undefined)[], recommendation?: ResourceRecommendation) =>
  JSON.stringify([config, dirs, recommendation ?? null, { ...req, offset: undefined, limit: undefined, refresh: undefined }]);
function page(entry: ListedResults, req: ResourceRequest): ResourceResult {
  const offset = req.offset ?? 0, limit = req.limit ?? 48;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw Error('Paginación inválida');
  return { folders: entry.folders, entries: entry.results.slice(offset, offset + limit), total: entry.results.length, nextOffset: offset + limit < entry.results.length ? offset + limit : null, warnings: entry.warnings, audioCategories: entry.audioCategories };
}

export function resourceLibrary(config: string, req: ResourceRequest, bundledLogos?: string, bundledSounds?: string, bundledMotions?: string, recommendation?: ResourceRecommendation): Promise<ResourceResult> {
  if (req.action === 'list' && !req.refresh) {
    const cached = listCache.get(listKey(config, req, [bundledLogos, bundledSounds, bundledMotions], recommendation));
    if (cached && cached.revision === resourceRevision() && Date.now() - cached.at < LIST_CACHE_MS) {
      try { return Promise.resolve(page(cached, req)); } catch (error) { return Promise.reject(error); }
    }
  }
  if (!['add-folder','remove-folder','classify'].includes(req.action)) return execute(config, req, bundledLogos, bundledSounds, bundledMotions, recommendation);
  bumpResourceRevision();
  const result = (mutations.get(config) ?? Promise.resolve()).catch(() => undefined).then(() => execute(config, req, bundledLogos, bundledSounds, bundledMotions));
  mutations.set(config, result);
  void result.finally(() => { if (mutations.get(config) === result) mutations.delete(config); }).catch(() => undefined);
  return result;
}
async function execute(config: string, req: ResourceRequest, bundledLogos?: string, bundledSounds?: string, bundledMotions?: string, recommendation?: ResourceRecommendation): Promise<ResourceResult> {
  const startedAt = resourceRevision();
  let folders = await load(config);
  if (req.refresh !== undefined && typeof req.refresh !== 'boolean' || req.groupBrands !== undefined && typeof req.groupBrands !== 'boolean') throw Error('Consulta de biblioteca inválida');
  if (req.kind && !kinds.includes(req.kind)) throw Error('Tipo de biblioteca inválido');
  if (req.audioType && !['sfx','music','stem','unclassified'].includes(req.audioType)) throw Error('Tipo de audio inválido');
  if (req.includeUnclassified !== undefined && typeof req.includeUnclassified !== 'boolean') throw Error('Filtro de clasificación inválido');
  if (req.audioFamily && !SOUND_CATEGORIES.some(c=>c.id===req.audioFamily)) throw Error('Categoría de sonido inválida');
  if (req.brightness && !['dark','balanced','bright'].includes(req.brightness)) throw Error('Brillo de sonido inválido');
  if (req.attack && !['sharp','soft'].includes(req.attack)) throw Error('Ataque de sonido inválido');
  if (req.action === 'classify') {
    if (req.kind !== 'sounds' || !req.path || !isAbsolute(req.path)) throw Error('Elegí un audio o carpeta conectada');
    const path = await realpath(req.path);
    const roots = await Promise.all(folders.filter(folder => folder.kind === 'sounds' && !folder.bundled).map(folder => realpath(folder.path).catch(() => '')));
    if (!roots.some(root => root && inside(root, path)) || !(await stat(path)).isDirectory() && !extensions.sounds.includes(extname(path).toLowerCase())) throw Error('Clasificá solamente audios de carpetas personales conectadas');
    await writeAudioAnnotation(config, path, req);
    return execute(config, { action: 'list', kind: 'sounds', limit: 1 }, bundledLogos, bundledSounds, bundledMotions);
  }
  // Previews only check the path against the connected folders; classifications are irrelevant there.
  const audioAnnotations = req.action !== 'preview' && (req.kind === undefined || req.kind === 'sounds') ? await readAudioAnnotations(config) : [];
  folders = folders.map(folder => ({ ...folder, ...(folder.kind === 'sounds' && audioAnnotations.find(entry => entry.scope === 'folder' && entry.path === folder.path) ? { classification: audioAnnotations.find(entry => entry.scope === 'folder' && entry.path === folder.path)!.audioType } : {}) }));
  if (req.action === 'add-folder' || req.action === 'remove-folder') {
    if (!req.kind || !req.path || !isAbsolute(req.path)) throw Error('Elegí una carpeta local');
    const path = req.action === 'add-folder' ? await realpath(req.path) : req.path;
    if (req.action === 'add-folder' && !(await stat(path)).isDirectory()) throw Error('Elegí una carpeta');
    folders = folders.filter(f => f.kind !== req.kind || f.path !== path);
    if (req.action === 'add-folder') folders.push({ kind: req.kind, path });
    await mkdir(dirname(config), { recursive: true });
    const temp = config + '.' + randomUUID() + '.tmp';
    await writeFile(temp, JSON.stringify({ version: 1, folders }, null, 2), { flag: 'wx' });
    await rename(temp, config);
  }
  if (req.action === 'preview') {
    const { path, kind, mediaType } = await previewTarget(folders, req.path, bundledLogos, bundledSounds, bundledMotions);
    if(kind==='sounds'||kind==='motions') {
      return {folders,entries:[],total:0,nextOffset:null,warnings:[],preview:'data:'+mediaType+';base64,'+(await readFile(path)).toString('base64')};
    }
    const svg = await readFile(path, 'utf8');
    if (!/<svg[\s>]/i.test(svg) || /<(script|foreignObject)\b|\bon\w+\s*=|(?:href|url)\s*(?:=|\()\s*["']?\s*(?:https?:|javascript:|file:)/i.test(svg)) throw Error('El SVG contiene recursos activos o externos');
    return { folders, entries: [], total: 0, nextOffset: null, warnings: [], preview: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') };
  }
  const catalog = new Map<string,Partial<ResourceEntry> & {brand:string}>();
  for (const [kind, directory] of [['logos',bundledLogos],['sounds',bundledSounds],['motions',bundledMotions]] as const) {
    if (req.kind && req.kind !== kind) continue;
    if (!directory) continue;
    try {
      const root = await realpath(directory);
      const manifest = await readCatalog(join(root,'catalog.json'));
      if (manifest.version !== 1 || !Array.isArray(manifest.entries)) throw Error('Catálogo de recursos inválido');
      for (const entry of manifest.entries) {
        if (typeof entry.path !== 'string' || typeof entry.brand !== 'string') throw Error('Entrada de recurso inválida');
        const path=join(root,entry.path);
        if (!inside(root,path)) throw Error('Recurso fuera del catálogo');
        const metadata = { ...entry, categories: (Array.isArray(entry.category) ? entry.category : [entry.category]).filter((value): value is string => typeof value === 'string') };
        if(entry.posterPath !== undefined) {
          if(kind !== 'motions' || typeof entry.posterPath !== 'string' || !/\.(png|jpe?g|webp)$/i.test(entry.posterPath)) throw Error('Poster de motion inválido');
          const poster = join(root,entry.posterPath);
          if(!inside(root,poster)) throw Error('Poster fuera del catálogo');
          metadata.posterPath = await realpath(poster);
          if(!inside(root,metadata.posterPath)) throw Error('Poster fuera del catálogo');
        }
        if (entry.componentPath !== undefined) {
          if (kind !== 'motions' || typeof entry.componentPath !== 'string' ||
            !Array.isArray(entry.componentFiles) || !entry.componentFiles.every((f: unknown) => typeof f === 'string'))
            throw Error('Componente de motion inválido');
          const resolveComponent = async (file: string) => {
            const candidate = join(root,file);
            if (!inside(root,candidate) || !/\.(?:tsx?|md)$/.test(file)) throw Error('Componente fuera del catálogo');
            const actual = await realpath(candidate);
            if (!inside(root,actual)) throw Error('Componente fuera del catálogo');
            return actual;
          };
          metadata.componentPath = await resolveComponent(entry.componentPath);
          metadata.componentFiles = await Promise.all(entry.componentFiles.map(resolveComponent));
        }
        catalog.set(path,metadata);
      }
      folders = [...folders.filter(f=>f.path!==root), {kind,path:root,bundled:true}];
    } catch(error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  if (!['list', 'add-folder', 'remove-folder'].includes(req.action)) throw Error('Acción desconocida');
  const entries: ResourceEntry[] = [], warnings: string[] = [], hashes = new Set<string>(), audioByHash = new Map<string, number>();
  let visited = 0;
  const query = (req.query ?? '').toLocaleLowerCase();
  for (const folder of folders.filter(f => !req.kind || f.kind === req.kind)) {
    try {
      const root = await realpath(folder.path);
      const catalogPaths = folder.bundled ? [...catalog.keys()].filter(path=>inside(root,path)) : undefined;
      const indexed = await resourceFiles(root, config, extensions[folder.kind], req.refresh, catalogPaths?.length ? catalogPaths : undefined);
      if (indexed.truncated) visited = 20001;
      const candidates = indexed.files.filter(file => {
        const metadata = folder.bundled ? catalog.get(file.path) : folder.kind === 'sounds' ? classifyAudio(file.path,file,audioAnnotations) : undefined;
        if (folder.kind === 'sounds' && folder.bundled && req.audioType && metadata?.audioType && metadata.audioType !== req.audioType && 'sha256' in metadata && metadata.sha256 && !audioByHash.has(String(metadata.sha256))) return false;
        const brand = (metadata && 'brand' in metadata ? String(metadata.brand) : undefined) ?? dirname(relative(root,file.path));
        const text = file.name + ' ' + brand + ' ' + (metadata?.title ?? '') + ' ' + (metadata?.audioType ?? '') + ' ' + (metadata?.tags ?? []).join(' ');
        return (folder.kind === 'logos' ? logoScore(query,brand,text) : resourceScore(query,text,folder.kind === 'sounds')) > 0;
      });
      // First indexing hashes in bounded batches. Later searches reuse verified file signatures.
      if (folder.kind === 'logos' || folder.kind === 'sounds') {
        for (let i = 0; i < candidates.length; i += 8) await Promise.all(candidates.slice(i,i+8).map(async file => {
          if (!file.sha256 && file.size <= (folder.kind === 'sounds' ? 512 : 2) * 1024 * 1024) {
            indexed.remember(file, await resourceFileHash(file.path, file));
          }
        }));
      }
      for (const info of candidates) {
            const path = info.path, e = {name: info.name};
            const rel = relative(root, path);
            const metadata: Partial<ResourceEntry> | undefined = folder.bundled ? { ...catalog.get(path), classificationSource: 'catalog' } : folder.kind === 'sounds' ? classifyAudio(path, info, audioAnnotations) : undefined;
            // Shipped catalogs contain content hashes. Skip unrelated known
            // types without reading every SFX for a music query; an existing
            // personal alias still receives its matching catalog metadata.
            if (folder.kind === 'sounds' && folder.bundled && req.audioType && metadata?.audioType && metadata.audioType !== req.audioType && metadata.sha256 && !audioByHash.has(metadata.sha256)) continue;
            const brand = metadata?.brand ?? (dirname(rel) === '.' ? basename(root) : dirname(rel).replaceAll(sep, ' / '));
            // Filter before deduplication so a matching alias is not hidden by
            // an identical SVG with a different name in another folder.
            const searchable = e.name + ' ' + brand + ' ' + (metadata?.title ?? '') + ' ' + (metadata?.audioType ?? '') + ' ' + (metadata?.tags ?? []).join(' ');
            const relevance = folder.kind === 'logos' ? logoScore(query, brand, searchable) : resourceScore(query, searchable, folder.kind === 'sounds');
            if (!relevance) continue;
            let fingerprint: string | undefined;
            if (folder.kind === 'logos' || folder.kind === 'sounds') {
              if (folder.kind === 'logos' && info.size > 2 * 1024 * 1024) { warnings.push('SVG demasiado grande: ' + e.name); continue; }
              // Large personal recordings stay importable without reading the
              // entire recording into memory on every library search.
              if(info.size <= (folder.kind === 'sounds' ? 512 : 24) * 1024 * 1024) {
                const hash = info.sha256 ?? await resourceFileHash(path, info);
                fingerprint = hash;
                if (folder.kind === 'logos') {
                  if (hashes.has(hash)) continue;
                  hashes.add(hash);
                }
              } else if (folder.kind === 'sounds' && warnings.length < 3) warnings.push('Audio mayor a 512 MiB: puede preescucharse/importarse; para registrar su selección prepará una sección útil: ' + e.name);
            }
            const entry: ResourceEntry = { kind: folder.kind, path, name: e.name, brand, bytes: info.size, relevance, categories: metadata?.categories,
              id: fingerprint ? 'sha256:' + fingerprint : 'path:' + createHash('sha256').update(path).digest('hex'), sha256: fingerprint, compositionFamily: metadata?.compositionFamily,
              origin:folder.bundled?'bundled':'personal',variant:metadata?.variant,theme:metadata?.theme,url:metadata?.url,brandUrl:metadata?.brandUrl,
              title:metadata?.title,tags:metadata?.tags,audioType:metadata?.audioType,classificationSource:metadata?.classificationSource,
              audioFamily:folder.kind==='sounds'&&(!metadata?.audioType||metadata.audioType==='sfx')?(metadata?.audioFamily??soundFamily(e.name)):undefined,
              duration:metadata?.duration,bpm:metadata?.bpm,cuePoint:metadata?.cuePoint,loop:metadata?.loop,license:metadata?.license,provider:metadata?.provider,
              soundProfile:metadata?.soundProfile,
              componentPath:metadata?.componentPath,componentFiles:metadata?.componentFiles,usage:metadata?.usage,posterPath:metadata?.posterPath };
            const previous = folder.kind === 'sounds' && fingerprint ? audioByHash.get(fingerprint) : undefined;
            if (previous !== undefined) entries[previous] = mergeAudioAliases(entries[previous]!, entry);
            else {
              if (folder.kind === 'sounds' && fingerprint) audioByHash.set(fingerprint, entries.length);
              entries.push(entry);
            }
      }
    } catch { warnings.push('No se pudo leer la carpeta: ' + folder.path); }
  }
  if (visited > 20000) warnings.push('Biblioteca muy grande; se examinó el primer conjunto de 20.000 entradas.');
  const typed = entries.filter(entry => !req.audioType || entry.kind === 'sounds' && (req.audioType === 'unclassified' ? !entry.audioType : entry.audioType === req.audioType || !entry.audioType && (req.includeUnclassified ?? req.audioType !== 'stem')));
  const audioCategories = SOUND_CATEGORIES.map(c=>({...c,count:typed.filter(e=>e.kind==='sounds'&&e.audioFamily===c.id).length})).filter(c=>c.count>0);
  const filtered = typed.filter(e=>(!req.audioFamily||e.audioFamily===req.audioFamily)
    && (!e.id || !recommendation?.excludeIds?.includes(e.id))
    &&(!req.brightness||e.soundProfile?.brightness===req.brightness)
    &&(!req.attack||e.soundProfile?.riseMs!==null&&e.soundProfile?.riseMs!==undefined&&(req.attack==='sharp'?e.soundProfile.riseMs<=25:e.soundProfile.riseMs>25)));
  // Scored once per entry: the recommendation hash must not run on every comparison.
  const scores = new Map<ResourceEntry, number>();
  const sortKeys = new Map<ResourceEntry, string>();
  filtered.sort((a, b) => {
      const score = (entry: ResourceEntry) => {
        const cached = scores.get(entry);
        if (cached !== undefined) return cached;
        let value = query ? (entry.relevance ?? 0) * 4 : 0;
        if (!query && entry.kind === 'logos') value += featuredLogoRank(entry.brand) + (entry.categories?.some(category => category.toLowerCase() === 'ai') ? 10 : 0);
        if (entry.kind === 'sounds' && !entry.audioType) value -= 2;
        if (recommendation && entry.kind === 'sounds') {
          if (entry.id && recommendation.preferredIds?.includes(entry.id)) value += 100;
          if (entry.id && recommendation.recentIds?.includes(entry.id)) value -= 12;
          if ((entry.compositionFamily ?? entry.audioFamily) && recommendation.recentFamilies?.includes((entry.compositionFamily ?? entry.audioFamily)!)) value -= entry.audioType === 'music' ? 4 : 1;
          value += parseInt(createHash('sha256').update((recommendation.seed ?? '') + entry.id).digest('hex').slice(0, 6), 16) / 0xffffff;
        }
        scores.set(entry, value);
        return value;
      };
      const key = (entry: ResourceEntry) => { let value = sortKeys.get(entry); if (value === undefined) { value = entry.brand + entry.name; sortKeys.set(entry, value); } return value; };
      return score(b) - score(a) || key(a).localeCompare(key(b));
    });
  let results = filtered;
  if (req.kind === 'logos' && req.groupBrands) {
    const brands = new Map<string, ResourceEntry[]>();
    for (const entry of filtered) { const key = logoBrandKey(entry.brand); const group = brands.get(key) ?? []; group.push(entry); brands.set(key, group); }
    const preferred = (entry: ResourceEntry) => (entry.variant === 'symbol' ? 4 : 0) + (entry.theme === 'dark' ? 2 : 0) + (entry.name.includes('-color') ? 3 : 0);
    results = [...brands.values()].map(variants => {
      const ordered = [...variants].sort((a,b) => preferred(b)-preferred(a));
      return {...ordered[0]!,variants:ordered};
    });
  }
  // A change seen while computing leaves this result one revision behind, so it is recomputed next time.
  const listed: ListedResults = { revision: startedAt, at: Date.now(), folders, results, warnings, audioCategories };
  if (req.action === 'list') {
    if (listCache.size >= 16) listCache.delete(listCache.keys().next().value!);
    listCache.set(listKey(config, req, [bundledLogos, bundledSounds, bundledMotions], recommendation), listed);
  }
  return page(listed, req);
}
