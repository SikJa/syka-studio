import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, realpath, lstat, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const within = (root, file) => { const rel = path.relative(root, file); return !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep); };
const nonempty = (value, max = 6000) => { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Texto/evidencia requerida'); return value.trim(); };
const brandId = value => { if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) throw new Error('brandId inválido'); return value; };
async function hash(file) { const h = createHash('sha256'); for await (const chunk of createReadStream(file)) h.update(chunk); return h.digest('hex'); }
async function contained(root, source) {
  nonempty(source); const candidate = path.resolve(root, source);
  if (!within(root, candidate)) throw new Error('Ruta fuera del proyecto');
  const actual = await realpath(candidate); if (!within(root, actual)) throw new Error('Enlace fuera del proyecto'); return actual;
}
async function safeDirectory(root, parts, create = false) {
  let dir = root;
  for (const part of parts) {
    dir = path.join(dir, part);
    if (create) { try { await mkdir(dir); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
    try { const stat = await lstat(dir); if (stat.isSymbolicLink() || !stat.isDirectory() || !within(root, await realpath(dir))) throw new Error('Memoria fuera del proyecto o enlazada'); }
    catch (e) { if (e.code === 'ENOENT' && !create) return null; throw e; }
  }
  return dir;
}
async function readState(root) {
  const history = await safeDirectory(root, ['.syka', 'content-memory', 'history']);
  if (!history) return { schemaVersion: 1, revision: 0, brands: {} };
  const files = (await readdir(history)).filter(f => /^\d{6}\.json$/.test(f)).sort();
  if (!files.length) return { schemaVersion: 1, revision: 0, brands: {} };
  const file = path.join(history, files.at(-1)); if ((await lstat(file)).isSymbolicLink()) throw new Error('Revisión enlazada');
  const state = JSON.parse(await readFile(file, 'utf8'));
  if (state.schemaVersion !== 1 || state.revision !== files.length || !state.brands) throw new Error('Historial de memoria inconsistente'); return state;
}
async function eventFor(root, request) {
  if (!['onboarding', 'export', 'user-request'].includes(request.trigger)) throw new Error('Trigger inválido');
  if (request.video) {
    const video = request.video; nonempty(video.revision, 200);
    if (!/^[a-f0-9]{64}$/.test(video.hash)) throw new Error('Hash de video requerido');
    const file = await contained(root, video.path);
    if (await hash(file) !== video.hash) throw new Error('El video cambió: verificar export antes de continuar');
    return `export:${video.hash}`;
  }
  if (request.trigger === 'export') throw new Error('Export requiere video verificado');
  return 'onboarding';
}
export async function contentMemory(project, request) {
  const root = await realpath(project);
  if (request.action === 'read') return readState(root);
  const key = brandId(request.brandId);
  if (request.action === 'route') {
    const state = await readState(root), brand = state.brands[key];
    const eventKey = await eventFor(root, request);
    const decision = brand?.occasions[eventKey]?.choice;
    let action = 'offer';
    if (request.trigger === 'user-request') action = 'record-acceptance';
    else if (decision === 'completed') action = 'done';
    else if (decision === 'accepted') action = 'prepare';
    else if (decision === 'declined' || brand?.offerMode === 'manual') action = 'skip';
    else if (decision === 'offered') action = 'wait';
    const preferences = Object.fromEntries(Object.values(brand?.preferences ?? {}).filter(p => p.scope !== 'piece' || p.eventKey === eventKey).sort((a, b) => Number(a.scope === 'piece') - Number(b.scope === 'piece')).map(p => [p.key, p]));
    const references = await Promise.all((brand?.references ?? []).map(async ref => {
      if (ref.kind !== 'file') return { ...ref, current: 'not-fetched' };
      try { return { ...ref, current: await hash(await contained(root, ref.source)) === ref.hash ? 'unchanged' : 'changed' }; }
      catch { return { ...ref, current: 'unavailable' }; }
    }));
    return { revision: state.revision, brandId: key, eventKey, action, preferences, references, offerMode: brand?.offerMode ?? 'ask' };
  }
  if (!['save', 'decide'].includes(request.action)) throw new Error('Acción inválida');
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) throw new Error('expectedRevision requerida');
  const folder = await safeDirectory(root, ['.syka', 'content-memory'], true);
  const lock = path.join(folder, '.lock'); await mkdir(lock);
  let temp;
  try {
    const state = await readState(root);
    if (state.revision !== request.expectedRevision) throw new Error('Conflicto de revisión: releé antes de guardar');
    const brand = state.brands[key] ?? { offerMode: 'ask', preferences: {}, references: [], occasions: {} };
    if (request.action === 'decide') {
      const eventKey = await eventFor(root, request);
      if (!['offered', 'accepted', 'declined', 'completed'].includes(request.choice)) throw new Error('Decisión inválida');
      if (request.choice === 'offered' && (brand.occasions[eventKey] || brand.offerMode === 'manual')) throw new Error('No repetir una oferta registrada o desactivada');
      let outputs;
      if (request.choice === 'completed') {
        if (brand.occasions[eventKey]?.choice !== 'accepted' || !Array.isArray(request.outputs) || !request.outputs.length) throw new Error('Completar requiere aceptación y artefactos guardados');
        outputs = await Promise.all(request.outputs.map(async source => { const file = await contained(root, source); return { path: path.relative(root, file).split(path.sep).join('/'), hash: await hash(file) }; }));
      }
      brand.occasions[eventKey] = { choice: request.choice, evidence: nonempty(request.evidence), at: new Date().toISOString(), ...(outputs ? { outputs } : {}) };
    } else {
      for (const [name, preference] of Object.entries(request.preferences ?? {})) {
        if (!/^(identity|voice|cover|descriptions|differences|(?:cover|descriptions)\.[a-z0-9-]{1,40})$/.test(name)) throw new Error('Preferencia desconocida');
        const scope = preference.scope ?? 'brand'; if (!['brand', 'piece'].includes(scope)) throw new Error('Alcance inválido');
        if (scope === 'piece' && !/^export:[a-f0-9]{64}$/.test(preference.eventKey ?? '')) throw new Error('Preferencia de pieza requiere eventKey del export');
        const storageKey = scope === 'piece' ? `${name}@${preference.eventKey}` : name;
        brand.preferences[storageKey] = { key: name, value: nonempty(preference.value), evidence: nonempty(preference.evidence), scope, ...(scope === 'piece' ? { eventKey: preference.eventKey } : {}) };
      }
      if (request.offerMode !== undefined) {
        if (!['ask', 'manual'].includes(request.offerMode)) throw new Error('Modo de oferta inválido');
        brand.offerMode = request.offerMode; brand.offerEvidence = nonempty(request.offerEvidence);
      }
      if (request.references !== undefined) {
        if (!Array.isArray(request.references) || request.references.length > 30) throw new Error('Referencias inválidas');
        brand.references = await Promise.all(request.references.map(async ref => {
          if (!['url', 'file'].includes(ref.kind) || !['cover', 'copy', 'both', 'logo'].includes(ref.purpose) || !['not-reviewed', 'reviewed'].includes(ref.analysis)) throw new Error('Referencia inválida');
          const result = { id: nonempty(ref.id, 100), kind: ref.kind, purpose: ref.purpose, note: nonempty(ref.note), evidence: nonempty(ref.evidence), analysis: ref.analysis };
          if (ref.kind === 'url') { const url = new URL(ref.source); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('URL inválida'); result.source = url.href; }
          else { const file = await contained(root, ref.source); result.source = path.relative(root, file).split(path.sep).join('/'); result.hash = await hash(file); }
          return result;
        }));
      }
    }
    state.brands[key] = brand; state.revision++; state.savedAt = new Date().toISOString();
    const history = await safeDirectory(root, ['.syka', 'content-memory', 'history'], true);
    temp = path.join(history, `${randomUUID()}.tmp`); await writeFile(temp, JSON.stringify(state, null, 2), { flag: 'wx' });
    await rename(temp, path.join(history, `${String(state.revision).padStart(6, '0')}.json`)); return state;
  } finally { if (temp) await rm(temp, { force: true }); await rm(lock, { recursive: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2); const project = args.includes('--project') ? args[args.indexOf('--project') + 1] : process.cwd();
    const root = await realpath(project);
    if (!args.includes('--read') && !args.includes('--request')) throw new Error('Usá --read o --request <archivo relativo>');
    const request = args.includes('--read') ? { action: 'read' } : JSON.parse(await readFile(await contained(root, args[args.indexOf('--request') + 1]), 'utf8'));
    console.log(JSON.stringify(await contentMemory(root, request), null, 2));
  } catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}
