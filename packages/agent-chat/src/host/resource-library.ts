import { readdir, readFile, realpath, stat, mkdir, writeFile, rename } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, isAbsolute, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { SOUND_CATEGORIES, soundFamily, type SoundFamily } from './sound-categories';
import type { SoundProfile } from './audio-spectrum';

export type ResourceKind = 'logos' | 'sounds' | 'motions';
export type ResourceFolder = { kind: ResourceKind; path: string; bundled?: boolean };
export type ResourceEntry = { kind: ResourceKind; path: string; name: string; brand: string; bytes: number; origin?: 'bundled' | 'personal'; variant?: string; theme?: string; url?: string; brandUrl?: string; title?: string; tags?: string[]; audioType?: 'sfx' | 'music' | 'stem'; audioFamily?: SoundFamily; duration?: number; bpm?: number; cuePoint?: number; soundProfile?: SoundProfile; loop?: boolean; license?: string; provider?: string; componentPath?: string; componentFiles?: string[]; usage?: string; posterPath?: string };
export type ResourceRequest = { action: 'list' | 'add-folder' | 'remove-folder' | 'preview'; kind?: ResourceKind; path?: string; query?: string; offset?: number; limit?: number; audioType?: 'sfx' | 'music' | 'stem'; audioFamily?: SoundFamily; brightness?: 'dark' | 'balanced' | 'bright'; attack?: 'sharp' | 'soft' };
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
export function resourceLibrary(config: string, req: ResourceRequest, bundledLogos?: string, bundledSounds?: string, bundledMotions?: string): Promise<ResourceResult> {
  if (req.action !== 'add-folder' && req.action !== 'remove-folder') return execute(config, req, bundledLogos, bundledSounds, bundledMotions);
  const result = (mutations.get(config) ?? Promise.resolve()).catch(() => undefined).then(() => execute(config, req, bundledLogos, bundledSounds, bundledMotions));
  mutations.set(config, result);
  void result.finally(() => { if (mutations.get(config) === result) mutations.delete(config); }).catch(() => undefined);
  return result;
}
async function execute(config: string, req: ResourceRequest, bundledLogos?: string, bundledSounds?: string, bundledMotions?: string): Promise<ResourceResult> {
  let folders = await load(config);
  if (req.kind && !kinds.includes(req.kind)) throw Error('Tipo de biblioteca inválido');
  if (req.audioType && !['sfx','music','stem'].includes(req.audioType)) throw Error('Tipo de audio inválido');
  if (req.audioFamily && !SOUND_CATEGORIES.some(c=>c.id===req.audioFamily)) throw Error('Categoría de sonido inválida');
  if (req.brightness && !['dark','balanced','bright'].includes(req.brightness)) throw Error('Brillo de sonido inválido');
  if (req.attack && !['sharp','soft'].includes(req.attack)) throw Error('Ataque de sonido inválido');
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
  const catalog = new Map<string,Partial<ResourceEntry> & {brand:string}>();
  for (const [kind, directory] of [['logos',bundledLogos],['sounds',bundledSounds],['motions',bundledMotions]] as const) {
    if (!directory) continue;
    try {
      const root = await realpath(directory);
      const manifest = JSON.parse(await readFile(join(root,'catalog.json'),'utf8'));
      if (manifest.version !== 1 || !Array.isArray(manifest.entries)) throw Error('Catálogo de recursos inválido');
      for (const entry of manifest.entries) {
        if (typeof entry.path !== 'string' || typeof entry.brand !== 'string') throw Error('Entrada de recurso inválida');
        const path=join(root,entry.path);
        if (!inside(root,path)) throw Error('Recurso fuera del catálogo');
        const metadata = { ...entry };
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
  if (req.action === 'preview') {
    if (!req.path) throw Error('Recurso requerido');
    const path = await realpath(req.path);
    const extension = extname(path).toLowerCase(), kind:ResourceKind = extension === '.svg' ? 'logos' : motionPreviewExtensions.includes(extension) ? 'motions' : 'sounds';
    const allowed = await Promise.all(folders.filter(f => f.kind === kind).map(async f => { try { return inside(await realpath(f.path), path); } catch { return false; } }));
    if (!allowed.some(Boolean) || !(kind==='motions'?motionPreviewExtensions:extensions[kind]).includes(extension) || (await stat(path)).size > (kind==='logos'?2:24) * 1024 * 1024) throw Error('Recurso fuera de la biblioteca o demasiado grande');
    if(kind==='sounds'||kind==='motions') {
      const mime:Record<string,string>={'.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.flac':'audio/flac','.m4a':'audio/mp4','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.gif':'image/gif','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
      return {folders,entries:[],total:0,nextOffset:null,warnings:[],preview:'data:'+mime[extension]+';base64,'+(await readFile(path)).toString('base64')};
    }
    const svg = await readFile(path, 'utf8');
    if (!/<svg[\s>]/i.test(svg) || /<(script|foreignObject)\b|\bon\w+\s*=|(?:href|url)\s*(?:=|\()\s*["']?\s*(?:https?:|javascript:|file:)/i.test(svg)) throw Error('El SVG contiene recursos activos o externos');
    return { folders, entries: [], total: 0, nextOffset: null, warnings: [], preview: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') };
  }
  if (!['list', 'add-folder', 'remove-folder'].includes(req.action)) throw Error('Acción desconocida');
  const entries: ResourceEntry[] = [], warnings: string[] = [], hashes = new Set<string>();
  let visited = 0;
  const query = (req.query ?? '').toLocaleLowerCase();
  const compact = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f\s_-]/g, '').toLocaleLowerCase();
  for (const folder of folders.filter(f => !req.kind || f.kind === req.kind)) {
    try {
      const root = await realpath(folder.path);
      const walk = async (dir: string, depth: number): Promise<void> => {
        for (const e of await readdir(dir, { withFileTypes: true })) {
          if (e.isSymbolicLink() || ++visited > 20000) continue;
          const path = join(dir, e.name);
          if (e.isDirectory() && depth < 8 && !['node_modules', '.git'].includes(e.name)) await walk(path, depth + 1);
          else if (e.isFile() && extensions[folder.kind].includes(extname(path).toLowerCase())) {
            const rel = relative(root, path);
            const metadata = folder.bundled ? catalog.get(path) : undefined;
            if (req.audioType && (folder.kind !== 'sounds' || (metadata?.audioType !== req.audioType && !(req.audioType==='sfx'&&!metadata?.audioType)))) continue;
            const brand = metadata?.brand ?? (dirname(rel) === '.' ? basename(root) : dirname(rel).replaceAll(sep, ' / '));
            // Filter before deduplication so a matching alias is not hidden by
            // an identical SVG with a different name in another folder.
            const searchable = e.name + ' ' + brand + ' ' + (metadata?.title ?? '') + ' ' + (metadata?.tags ?? []).join(' ');
            if (!searchable.toLocaleLowerCase().includes(query) && !compact(searchable).includes(compact(query))) continue;
            const info = await stat(path);
            if (folder.kind === 'logos' || folder.kind === 'sounds') {
              if (folder.kind === 'logos' && info.size > 2 * 1024 * 1024) { warnings.push('SVG demasiado grande: ' + e.name); continue; }
              // Large personal recordings stay importable without reading the
              // entire recording into memory on every library search.
              if(info.size <= 24 * 1024 * 1024) {
                const hash = createHash('sha256').update(await readFile(path)).digest('hex');
                if (hashes.has(hash)) continue;
                hashes.add(hash);
              }
            }
            entries.push({ kind: folder.kind, path, name: e.name, brand, bytes: info.size,
              origin:folder.bundled?'bundled':'personal',variant:metadata?.variant,theme:metadata?.theme,url:metadata?.url,brandUrl:metadata?.brandUrl,
              title:metadata?.title,tags:metadata?.tags,audioType:metadata?.audioType,
              audioFamily:folder.kind==='sounds'&&(!metadata?.audioType||metadata.audioType==='sfx')?(metadata?.audioFamily??soundFamily(e.name)):undefined,
              duration:metadata?.duration,bpm:metadata?.bpm,cuePoint:metadata?.cuePoint,loop:metadata?.loop,license:metadata?.license,provider:metadata?.provider,
              soundProfile:metadata?.soundProfile,
              componentPath:metadata?.componentPath,componentFiles:metadata?.componentFiles,usage:metadata?.usage,posterPath:metadata?.posterPath });
          }
        }
      };
      await walk(root, 0);
    } catch { warnings.push('No se pudo leer la carpeta: ' + folder.path); }
  }
  if (visited > 20000) warnings.push('Biblioteca muy grande; se examinó el primer conjunto de 20.000 entradas.');
  const audioCategories = SOUND_CATEGORIES.map(c=>({...c,count:entries.filter(e=>e.kind==='sounds'&&e.audioFamily===c.id).length})).filter(c=>c.count>0);
  const filtered = entries.filter(e=>(!req.audioFamily||e.audioFamily===req.audioFamily)
    &&(!req.brightness||e.soundProfile?.brightness===req.brightness)
    &&(!req.attack||e.soundProfile?.riseMs!==null&&e.soundProfile?.riseMs!==undefined&&(req.attack==='sharp'?e.soundProfile.riseMs<=25:e.soundProfile.riseMs>25)))
    .sort((a, b) => (a.brand + a.name).localeCompare(b.brand + b.name));
  const offset = req.offset ?? 0, limit = req.limit ?? 48;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw Error('Paginación inválida');
  return { folders, entries: filtered.slice(offset, offset + limit), total: filtered.length, nextOffset: offset + limit < filtered.length ? offset + limit : null, warnings, audioCategories };
}
