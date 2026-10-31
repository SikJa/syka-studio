import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { resourceLibrary, resourceFileHash, type ResourceEntry, type ResourceRequest } from './resource-library';
import { smallResponse } from './creative-search';
import { motionKnowledge } from './motion-knowledge';

type Receipt = { id: string; kind: 'reference' | 'resource'; title?: string; path?: string; sha256?: string; family?: string; audioType?: string; offset?: number; characters?: number; repeatNeedsConfirmation?: boolean };
type Event = { version: 1; project: string; at: string; items: Receipt[]; role?: string; reason?: string; imported?: string };
const within = (root: string, path: string) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep); };
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const roles = ['motion', 'look', 'story', 'music', 'sfx', 'technical'];
let receiptClock = 0;
export const CREATIVE_SELECTION_TOOL = {
  type: 'function', name: 'syka_creative_selection',
  description: 'Read compact project choices or record a choice from actual resource-search/source-read receipts. Persists IDs, hashes, reason and recent music choices across local projects. A projectAsset path verifies an imported copy by hash, not playback or aesthetic quality. Reuse the project choice until the brief changes; excludes and pagination retrieve alternatives without rereading everything.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {
    action: { type: 'string', enum: ['status', 'choose'] }, id: { type: 'string' }, role: { type: 'string', enum: roles },
    reason: { type: 'string', maxLength: 600 }, projectAsset: { type: 'string' }, allowRepeat: { type: 'boolean', description: 'Only true when the user explicitly chose to reuse this recent music for a NEW piece.' },
  }, required: ['action'] },
};

/** Append-only receipts avoid clobbering choices made by another chat/process. */
export class CreativeResearch {
  private cwd: string;
  private docs?: string;
  private config?: string;
  constructor(cwd: string, docs?: string, config?: string) { this.cwd = cwd; this.docs = docs; this.config = config; }
  private async folder(shared: boolean, category: 'reads' | 'choices', create = false) {
    const configuredRoot = shared && this.config ? dirname(this.config) : this.cwd;
    if (create && shared && this.config) await mkdir(configuredRoot, { recursive: true });
    let root: string;
    try { root = await realpath(configuredRoot); }
    catch (error) { if (!create && (error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    const segments = shared && this.config ? ['creative-usage', category] : ['.syka', 'creative-research', category];
    let folder = root;
    for (const segment of segments) {
      folder = join(folder, segment);
      if (create) await mkdir(folder).catch(error => { if (error.code !== 'EEXIST') throw error; });
      try {
        const info = await lstat(folder);
        if (!info.isDirectory() || info.isSymbolicLink() || !within(root, await realpath(folder))) throw Error('Creative history must stay inside its configured root.');
      } catch (error) { if (!create && (error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    }
    return folder;
  }
  private async project() { return hash(await realpath(this.cwd)); }
  private async events(shared: boolean, category: 'reads' | 'choices', role?: 'music' | 'sfx', limit=128): Promise<Event[]> {
    const folder = await this.folder(shared, category);
    if (!folder) return [];
    const names = (await readdir(folder)).filter(name => {
      const match=/^\d{13}-[a-f0-9-]{36}(?:\.(music|sfx|motion|look|story|technical))?\.json$/.exec(name);
      return match && (!role || !match[1] || match[1]===role);
    }).sort().slice(-128).reverse();
    const events: Event[] = [];
    for (const name of names) {
      const path = join(folder, name), info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 48_000) continue;
      const event = JSON.parse(await readFile(path, 'utf8')) as Event;
      if (event.version === 1 && (!role || event.role===role) && Array.isArray(event.items) && event.items.length <= 12) events.push(event);
      if(events.length>=limit)break;
    }
    return events;
  }
  private async append(items: Receipt[], category: 'reads' | 'choices', details: Partial<Event> = {}, shared = false) {
    if (!items.length) return;
    const event: Event = { ...details, version: 1, project: await this.project(), at: new Date().toISOString(), items };
    const folder = await this.folder(shared, category, true);
    // Several searches/choices can complete in the same millisecond. Keep read
    // receipts in logical order instead of letting random UUID order revive an
    // older unguarded receipt for a track requested as a new piece.
    receiptClock = Math.max(Date.now(), receiptClock + 1);
    const marker=category==='choices' && event.role && roles.includes(event.role) ? '.'+event.role : '';
    const path = join(folder!, `${receiptClock}-${randomUUID()}${marker}.json`);
    await writeFile(path + '.tmp', JSON.stringify(event), { flag: 'wx', mode: 0o600 });
    await rename(path + '.tmp', path);
  }
  async recentReferences() {
    return [...new Set((await this.events(false, 'choices')).flatMap(event => event.items.filter(item => item.kind === 'reference').map(item => item.id)))].slice(0, 32);
  }
  async recentMusicFamilies() {
    const local = await this.events(false,'choices','music',8);
    const shared = this.config ? await this.events(true,'choices','music',16) : [];
    return [...new Set([...local,...shared].flatMap(event=>event.items.flatMap(item=>item.family?[item.family]:[])))];
  }
  async recordCreatedMusic(path: string, family: string, title: string) {
    const root = await realpath(this.cwd), actual = await realpath(path);
    if (!within(root, actual)) throw Error('La música creada debe estar en el proyecto.');
    const sha256 = await resourceFileHash(actual);
    const receipt: Receipt = { id: 'sha256:' + sha256, kind: 'resource', title, path: actual, sha256, family, audioType: 'music' };
    await this.append([receipt], 'reads');
    return this.call({ action: 'choose', id: receipt.id, role: 'music', reason: 'Nueva composición procedural con armonía, motivo y arreglo propios para esta pieza.', projectAsset: relative(root, actual) });
  }
  async recordReferences(result: unknown) {
    const rows = (result as { results?: { id: string; title?: string; sourceText?: string; sourceSha256?: string; sourcePath?: string; textOffset?: number }[] }).results ?? [];
    await this.append(rows.filter(row => row.sourceText?.length && row.sourceSha256).map(row => ({ id: row.id, title: row.title, kind: 'reference', sha256: row.sourceSha256, path: row.sourcePath, offset: row.textOffset ?? 0, characters: row.sourceText!.length })), 'reads');
  }
  async planEvidence(raw: unknown) {
    const input = raw as { brief?: { purpose?: string; direction?: string; motion?: { grammar?: string }; useCase?: string; references?: { id: string }[] } };
    const reads = (await this.events(false, 'reads')).flatMap(event => event.items).filter(item => item.kind === 'reference');
    const references = await Promise.all((input.brief?.references ?? []).slice(0, 16).map(async reference => {
      const receipt = reads.find(item => item.id === reference.id);
      const current = receipt?.path && receipt.sha256 ? await readFile(receipt.path).then(data => hash(data) === receipt.sha256, () => false) : false;
      return { id: reference.id, recordedRead: Boolean(receipt), sourceUnchanged: Boolean(current), sourceHash: receipt?.sha256, characters: receipt?.characters };
    }));
    const needsDiscovery = !references.length || references.every(reference => !reference.sourceUnchanged);
    let candidates: unknown;
    if (needsDiscovery && this.docs) {
      const recent = await this.recentReferences();
      candidates = await motionKnowledge(this.docs, {
        query: [input.brief?.motion?.grammar, input.brief?.direction, input.brief?.purpose].filter(Boolean).join(' ').slice(0, 600) || 'motion continuity', kind: 'skill', limit: 3, maxChars: 3000,
      }, recent);
      if (!(candidates as { results: unknown[] }).results.length) candidates = await motionKnowledge(this.docs, {
        query: input.brief?.useCase || 'motion continuity', kind: 'skill', limit: 3, maxChars: 3000,
      }, recent);
    }
    return { references, ...(candidates ? { candidates } : {}), evidence: 'Host read receipts only. Read the chosen page before applying a source; visual/audio inspection remains separate.' };
  }
  async resources(raw: ResourceRequest & { excludeIds?: string[]; maxChars?: number; newPiece?: boolean }) {
    if (raw.action === 'classify') return resourceLibrary(this.config ?? join(this.cwd, '.syka', 'resource-library.json'), raw);
    if (raw.action !== 'list') throw Error('Use list or classify for audio resources');
    if (raw.query !== undefined && (typeof raw.query !== 'string' || raw.query.length > 1000)) throw Error('Resource query must be text up to 1000 characters.');
    if (raw.limit !== undefined && (!Number.isInteger(raw.limit) || raw.limit < 1 || raw.limit > 12)) throw Error('Resource limit must be 1–12.');
    if (raw.excludeIds && (!Array.isArray(raw.excludeIds) || raw.excludeIds.length > 128 || raw.excludeIds.some(id => typeof id !== 'string'))) throw Error('Invalid resource exclusions.');
    if (raw.newPiece !== undefined && typeof raw.newPiece !== 'boolean') throw Error('newPiece must be boolean.');
    const maxChars = raw.maxChars ?? 6000;
    if (!Number.isInteger(maxChars) || maxChars < 3000 || maxChars > 12000) throw Error('Resource budget must be 3000–12000 characters.');
    const project = await this.project(), localMusic = await this.events(false,'choices','music',16), localSfx=await this.events(false,'choices','sfx',12);
    const sharedMusic = this.config ? (await this.events(true,'choices','music',16)).filter(event=>raw.newPiece||event.project!==project) : [];
    const sharedSfx = this.config ? await this.events(true,'choices','sfx',24) : [];
    const recent = [...sharedMusic,...sharedSfx,...localSfx].flatMap(event=>event.items);
    const current = !raw.newPiece && raw.audioType==='music' ? localMusic[0]?.items??[] : [];
    if(raw.newPiece)recent.push(...localMusic.flatMap(event=>event.items));
    const result = await resourceLibrary(this.config ?? join(this.cwd, '.syka', 'resource-library.json'), { ...raw, limit: Math.min(raw.limit ?? 6, 12) },
      this.docs && join(this.docs, 'resources/logos'), this.docs && join(this.docs, 'resources/sounds'), this.docs && join(this.docs, 'resources/motions'),
      { excludeIds: raw.excludeIds, recentIds: recent.map(item => item.id), recentFamilies: recent.flatMap(item => item.family ? [item.family] : []), preferredIds: current.map(item => item.id), seed: project });
    const entries = result.entries.map(({ id, path, title, name, kind, audioType, classificationSource, audioFamily, duration, bpm, cuePoint, loop, license, provider, url, brandUrl, compositionFamily, componentPath, componentFiles, usage, soundProfile, brand }: ResourceEntry) => ({
      id, path, title: title ?? name, kind, brand, audioType, classificationSource, audioFamily, duration, bpm, cuePoint, loop, license, provider, url, brandUrl, compositionFamily, componentPath, componentFiles, usage,
      ...(soundProfile ? { soundProfile: { brightness: soundProfile.brightness, riseMs: soundProfile.riseMs } } : {}),
    }));
    const fresh = entries.filter(entry => entry.audioType === 'music' && !recent.some(item => item.id === entry.id || entry.compositionFamily && item.family === entry.compositionFamily));
    const needsMusic = raw.audioType === 'music' && !current.length && !fresh.length;
    const recordedMusic = !raw.newPiece && raw.audioType === 'music' ? localMusic[0] : undefined;
    const response = smallResponse({ entries, total: result.total, nextOffset: result.nextOffset, warnings: result.warnings.slice(0, 3).map(warning => warning.slice(0, 300)),
      ...(recordedMusic ? {recordedMusic:{id:recordedMusic.items[0]?.id,title:recordedMusic.items[0]?.title,projectAsset:recordedMusic.imported??null,evidence:'Recorded choice. Reopen the existing project asset before changing music; this is not a fresh file/playback verification.'}} : {}),
      ...(raw.audioType === 'music' ? { musicDecision: { state: needsMusic ? entries.some(entry => !entry.audioType) ? 'classify_or_source_or_create_or_ask' : 'source_or_create_or_ask' : 'compare_candidates', freshCandidates: fresh.length, unclassified: entries.filter(entry => !entry.audioType).length, nextAction: needsMusic ? 'Do not reuse a recent bed silently. Classify uncertain files and search Mixkit with syka_mixkit for online audiovisual work, create a new composition with syka_music_create only if the brief fits local synthesis, or ask for a source/provider/style. This local search did not query or download Mixkit. More pages may contain alternatives.' : 'Compare the actual candidates in context; revisions retain their selected track.' } } : {}),
      selectionPolicy: 'Relevant candidates first, then recent music/SFX diversity. Filename/folder classification is provisional; unknown files retain unknown status. Selection is not listening evidence.' }, maxChars, raw.offset ?? 0);
    const ids = new Set(response.entries.map(entry => entry.id));
    await this.append(result.entries.filter(entry => entry.id && ids.has(entry.id)).map(entry => ({ id: entry.id!, kind: 'resource', title: entry.title ?? entry.name, path: entry.path, sha256: entry.sha256, family: entry.compositionFamily ?? entry.audioFamily, audioType: entry.audioType, repeatNeedsConfirmation: Boolean(raw.newPiece && entry.audioType === 'music' && recent.some(item => item.id === entry.id || entry.compositionFamily && item.family === entry.compositionFamily)) })), 'reads');
    return response;
  }
  async call(raw: unknown) {
    const args = raw as { action?: string; id?: string; role?: string; reason?: string; projectAsset?: string; allowRepeat?: boolean };
    if (!args || Object.keys(args).some(key => !['action','id','role','reason','projectAsset','allowRepeat'].includes(key)) || args.allowRepeat !== undefined && typeof args.allowRepeat !== 'boolean') throw Error('Invalid creative selection arguments.');
    if (args.action === 'status') {
      const events = await this.events(false, 'choices'), seen = new Set<string>();
      for(const role of ['music','sfx'] as const) if(!events.some(event=>event.role===role)) {
        const latest=(await this.events(false,'choices',role,1))[0];if(latest)events.push(latest);
      }
      return { choices: events.filter(event => event.role && !seen.has(event.role) && seen.add(event.role)).map(event => ({ role: event.role, id: event.items[0]?.id, title: event.items[0]?.title, reason: event.reason, imported: Boolean(event.imported), projectAsset:event.imported??null })), evidence: 'Recorded selections and file copies verified at selection time; re-open the asset before revising. Not a claim of current playback, listening or user approval.' };
    }
    if (args.action !== 'choose' || !args.id || !roles.includes(args.role ?? '') || typeof args.reason !== 'string' || !args.reason.trim() || args.reason.length > 600) throw Error('Choose a returned id, role and concise reason.');
    const receipt = (await this.events(false, 'reads')).flatMap(event => event.items).find(item => item.id === args.id);
    if (!receipt || (receipt.kind === 'reference' && !receipt.characters)) throw Error('Read the chosen reference or search the resource first. No receipt exists for that id.');
    if (args.role === 'music' && receipt.audioType !== 'music') throw Error('Choose a music resource for the music role.');
    if (args.role === 'music' && receipt.repeatNeedsConfirmation && !args.allowRepeat) throw Error('Esta música o su familia ya se usó recientemente. Creá otra composición, buscá alternativas o preguntale al usuario antes de repetirla en una pieza nueva.');
    if (args.role === 'sfx' && receipt.audioType !== 'sfx') throw Error('Choose an SFX resource for the sfx role.');
    if (!receipt.path || !receipt.sha256 || await resourceFileHash(receipt.path) !== receipt.sha256) throw Error('The selected source changed or has no verifiable hash. Search/read it again.');
    let imported: string | undefined;
    if (args.projectAsset) {
      if (receipt.kind !== 'resource') throw Error('Only resource copies can be verified.');
      const root = await realpath(this.cwd), candidate = resolve(root, args.projectAsset);
      if (!within(root, candidate)) throw Error('Imported asset must belong to this project.');
      const actual = await realpath(candidate);
      if (!within(root, actual) || !(await lstat(actual)).isFile() || await resourceFileHash(actual) !== receipt.sha256) throw Error('Imported asset differs from the selected resource.');
      imported = relative(root, actual);
    }
    await this.append([receipt], 'choices', { role: args.role, reason: args.reason.trim(), imported });
    if (this.config && (args.role === 'music' || args.role === 'sfx')) await this.append([{ id: receipt.id, kind: receipt.kind, family: receipt.family }], 'choices', { role: args.role }, true);
    return { id: receipt.id, role: args.role, sourceHash: receipt.sha256, sourceReadCharacters: receipt.characters, imported: imported ?? null, evidence: imported ? 'Imported copy verified by SHA-256; timeline use and listening still require review.' : 'Selection recorded; not an assertion of import, playback or approval.' };
  }
}
