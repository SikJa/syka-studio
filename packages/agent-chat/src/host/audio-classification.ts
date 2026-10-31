import { readFile, writeFile, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { dirname, relative, isAbsolute, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

export type AudioType = 'music' | 'sfx' | 'stem';
export type AudioClassification = { audioType?: AudioType; classificationSource: 'manual' | 'folder' | 'filename' | 'unknown'; tags?: string[]; compositionFamily?: string; license?: string; bpm?: number; duration?: number; title?: string };
type Annotation = Omit<AudioClassification, 'classificationSource'> & { path: string; scope: 'file' | 'folder'; signature?: string };
const within = (root: string, file: string) => { const rel = relative(root, file); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep); };
const normal = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const signature = (info: {size:number;mtimeMs:number;ctimeMs:number}) => `${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
const MAX_BYTES = 1024 * 1024, MAX_ENTRIES = 5000;

export async function readAudioAnnotations(config: string): Promise<Annotation[]> {
  try {
    const file = config + '.audio.json';
    if ((await stat(file)).size > MAX_BYTES) throw Error('La clasificación de audio supera 1 MiB');
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > MAX_ENTRIES || data.entries.some((entry: Annotation) => {
      if (!entry || typeof entry.path !== 'string' || !isAbsolute(entry.path) || !['file','folder'].includes(entry.scope) || !['music','sfx','stem'].includes(entry.audioType!)) return true;
      try { validateMetadata(entry); } catch { return true; }
      return entry.signature !== undefined && typeof entry.signature !== 'string';
    })) throw Error('Clasificación de audio inválida');
    return data.entries;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}

/** Caller validates the canonical path against connected personal folders first. */
function validateMetadata(raw: Partial<AudioClassification>) {
  for (const key of ['compositionFamily','license','title'] as const) if (raw[key] !== undefined && (typeof raw[key] !== 'string' || !raw[key]!.trim() || raw[key]!.length > 240)) throw Error('Metadata de audio inválida');
  if (raw.tags !== undefined && (!Array.isArray(raw.tags) || raw.tags.length > 24 || raw.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 80))) throw Error('Etiquetas de audio inválidas');
  if (raw.bpm !== undefined && (!Number.isFinite(raw.bpm) || raw.bpm < 20 || raw.bpm > 300) || raw.duration !== undefined && (!Number.isFinite(raw.duration) || raw.duration <= 0 || raw.duration > 86400)) throw Error('Tiempo de audio inválido');
}

export async function writeAudioAnnotation(config: string, path: string, raw: { classification?: AudioType | 'auto'; tags?: string[]; compositionFamily?: string; license?: string; bpm?: number; duration?: number; title?: string }) {
  if (!['music','sfx','stem','auto'].includes(raw.classification!)) throw Error('Elegí Música, Efectos, Capas o Automático');
  validateMetadata(raw);
  const info = await stat(path), scope = info.isDirectory() ? 'folder' : 'file';
  const entries = (await readAudioAnnotations(config)).filter(entry => entry.path !== path);
  if (raw.classification !== 'auto') entries.push({ path, scope, audioType: raw.classification, ...(scope === 'file' ? { signature: signature(info), tags: raw.tags, compositionFamily: raw.compositionFamily, license: raw.license, bpm: raw.bpm, duration: raw.duration, title: raw.title } : { tags: raw.tags }) });
  await mkdir(dirname(config), { recursive: true });
  const file = config + '.audio.json', temporary = file + '.' + randomUUID() + '.tmp';
  const body = JSON.stringify({ version: 1, entries }, null, 2);
  if (entries.length > MAX_ENTRIES || Buffer.byteLength(body) > MAX_BYTES) throw Error('La clasificación de audio alcanzó su límite; quitá entradas que ya no usás.');
  try { await writeFile(temporary, body, { flag: 'wx', mode: 0o600 }); await rename(temporary, file); }
  finally { await unlink(temporary).catch(()=>undefined); }
}

export function classifyAudio(path: string, info: {size:number;mtimeMs:number;ctimeMs:number}, annotations: Annotation[]): AudioClassification {
  const manual = annotations.find(entry => entry.scope === 'file' && entry.path === path && entry.signature === signature(info));
  const folder = annotations.filter(entry => entry.scope === 'folder' && within(entry.path, path)).sort((a,b) => b.path.length - a.path.length)[0];
  const chosen = manual ?? folder;
  if (chosen) { const { path: _path, scope: _scope, signature: _signature, ...metadata } = chosen; return { ...metadata, classificationSource: manual ? 'manual' : 'folder' }; }
  const name = normal(path.replace(/\\/g, '/'));
  if (/(?:^|[\s/_-])(stems?|capas|isolated|multitrack)(?:[\s/_.-]|$)/.test(name)) return { audioType: 'stem', classificationSource: 'filename' };
  if (/(whoosh|swoosh|click|keypress|keycap|thock|impact|riser|downlifter|notification|sfx|efectos|sonidos de interfaz)/.test(name) || /(?:^|[\s/_-])(pop|tap|chime|shimmer|glitch|success|error|switch|toggle)(?:[\s/_.-]|$)/.test(name)) return { audioType: 'sfx', classificationSource: 'filename' };
  if (/(?:^|[\s/_-])(music|musica|soundtrack|bgm|score|instrumental|piano|jazz|ambient|soundbed|canciones|songs)(?:[\s/_.-]|$)/.test(name) || /\b\d{2,3}[\s_-]*bpm\b/.test(name)) return { audioType: 'music', classificationSource: 'filename' };
  return { classificationSource: 'unknown' };
}
