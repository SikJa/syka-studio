/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// A recipe ("receta") is how someone makes one kind of video: what the brief
// asks, the usual structure, the style, sound and rhythm that stay fixed, and
// the checks the gate adds. Factory recipes ship with Syka; personal ones live
// in the personal skills folder as a skill with a receta.json, so they list
// with the skills and can be dragged into a chat. Every video's plan starts
// from one and can feed improvements back with the person's OK.

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const RECETA_FILE = 'receta.json';
export const CONFIANZAS = ['medida', 'aprobada', 'propuesta'] as const;
export const TIPOS = ['lanzamiento', 'youtube', 'vertical', 'general'] as const;
export const ORIGENES = ['fabrica', 'referencias', 'videos', 'video-aprobado', 'entrevista'] as const;

/** A rule with where it came from: measured from a video, approved by the person, or proposed by the agent. */
export type Regla = { texto: string; confianza: typeof CONFIANZAS[number]; fuente?: string };
export type Seccion = { id: string; nombre: string; proposito: string; duracion: { min: number; max: number }; frase: boolean };
export type Control = { id: string; regla: string; confianza: typeof CONFIANZAS[number] };
export type Receta = {
  version: 1; slug: string; nombre: string; tipo: typeof TIPOS[number]; revision: number;
  descripcion: string; cuandoUsar: string;
  origen: { tipo: typeof ORIGENES[number]; detalle: string };
  formato: { ancho: number; alto: number; fps: number; duracion: { min: number; max: number };
    /** Share of the frame each side keeps clear for lines, like a social app's buttons and captions; 5% when unset. */
    zonaSegura?: { arriba: number; abajo: number; izquierda: number; derecha: number };
    /** Seconds the whole frame may stand still mid-film; a screen recording with voice holds longer than a motion film. 1.6 when unset. */
    quietoMaximo?: number };
  fases: { historias: boolean; storyboard: boolean; desdeTranscripcion: boolean };
  brief: { preguntas: { id: string; pregunta: string }[]; resuelto: Record<string, string> };
  estructura: Seccion[];
  estilo: Regla[]; sonido: Regla[]; ritmo: Regla[];
  referencias: { fuente: string; tomar: string }[];
  fijo: string[]; variable: string[];
  controles: Control[];
};

type Row = Record<string, unknown>;
const fail = (path: string, problem: string): never => { throw Error(`receta.${path}: ${problem}`); };
function obj(value: unknown, path: string, keys: readonly string[]): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'se necesita un objeto.');
  const unknown = Object.keys(value as Row).filter(key => !keys.includes(key));
  if (unknown.length) fail(path, `campo desconocido ${unknown.join(', ')}.`);
  return value as Row;
}
function str(value: unknown, path: string, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(path, 'se necesita texto.');
  return (value as string).trim();
}
function num(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(path, `número entre ${min} y ${max}.`);
  return value as number;
}
function list<T>(value: unknown, path: string, max: number, each: (item: unknown, path: string) => T): T[] {
  if (!Array.isArray(value) || value.length > max) fail(path, `lista de hasta ${max}.`);
  return (value as unknown[]).map((item, index) => each(item, `${path}[${index}]`));
}
const oneOf = <T extends string>(value: unknown, path: string, options: readonly T[]): T =>
  options.includes(value as T) ? value as T : fail(path, `usá ${options.join(' | ')}.`);
const slugOf = (value: unknown, path: string) => /^[a-z0-9][a-z0-9-]{1,48}$/.test(String(value)) ? String(value) : fail(path, 'minúsculas, números y guiones (2–49).');
const range = (value: unknown, path: string, max: number) => {
  const r = obj(value, path, ['min', 'max']), min = num(r.min, path + '.min', 0, max), top = num(r.max, path + '.max', 0, max);
  if (top < min) fail(path, 'max menor que min.');
  return { min, max: top };
};
const regla = (value: unknown, path: string): Regla => {
  const r = obj(value, path, ['texto', 'confianza', 'fuente']);
  return { texto: str(r.texto, path + '.texto'), confianza: oneOf(r.confianza, path + '.confianza', CONFIANZAS), ...(r.fuente === undefined ? {} : { fuente: str(r.fuente, path + '.fuente') }) };
};

export function validarReceta(raw: unknown): Receta {
  const r = obj(raw, '', ['version', 'slug', 'nombre', 'tipo', 'revision', 'descripcion', 'cuandoUsar', 'origen', 'formato', 'fases', 'brief', 'estructura', 'estilo', 'sonido', 'ritmo', 'referencias', 'fijo', 'variable', 'controles']);
  if (r.version !== 1) fail('version', 'debe ser 1.');
  const origen = obj(r.origen, 'origen', ['tipo', 'detalle']);
  const formato = obj(r.formato, 'formato', ['ancho', 'alto', 'fps', 'duracion', 'zonaSegura', 'quietoMaximo']);
  const zona = formato.zonaSegura === undefined ? undefined : obj(formato.zonaSegura, 'formato.zonaSegura', ['arriba', 'abajo', 'izquierda', 'derecha']);
  const fases = obj(r.fases, 'fases', ['historias', 'storyboard', 'desdeTranscripcion']);
  for (const key of ['historias', 'storyboard', 'desdeTranscripcion']) if (typeof fases[key] !== 'boolean') fail('fases.' + key, 'true o false.');
  const brief = obj(r.brief, 'brief', ['preguntas', 'resuelto']);
  const resuelto = obj(brief.resuelto, 'brief.resuelto', Object.keys((brief.resuelto ?? {}) as Row));
  // Questions, sections and controls each have their own ids: a "gancho" question may sit beside a "gancho" section.
  const seen = new Map<string, Set<string>>();
  const unique = (id: string, path: string) => {
    const group = path.split('[')[0]!, ids = seen.get(group) ?? new Set<string>();
    if (ids.has(id)) fail(path, `id repetido ${id}.`);
    ids.add(id); seen.set(group, ids); return id;
  };
  const receta: Receta = {
    version: 1, slug: slugOf(r.slug, 'slug'), nombre: str(r.nombre, 'nombre', 80), tipo: oneOf(r.tipo, 'tipo', TIPOS),
    revision: num(r.revision, 'revision', 1, 100000), descripcion: str(r.descripcion, 'descripcion', 400), cuandoUsar: str(r.cuandoUsar, 'cuandoUsar', 600),
    origen: { tipo: oneOf(origen.tipo, 'origen.tipo', ORIGENES), detalle: str(origen.detalle, 'origen.detalle', 600) },
    formato: { ancho: num(formato.ancho, 'formato.ancho', 128, 7680), alto: num(formato.alto, 'formato.alto', 128, 7680), fps: num(formato.fps, 'formato.fps', 1, 120), duracion: range(formato.duracion, 'formato.duracion', 7200),
      ...(formato.quietoMaximo === undefined ? {} : { quietoMaximo: num(formato.quietoMaximo, 'formato.quietoMaximo', 1, 30) }),
      ...(zona ? { zonaSegura: { arriba: num(zona.arriba, 'formato.zonaSegura.arriba', 0, 0.4), abajo: num(zona.abajo, 'formato.zonaSegura.abajo', 0, 0.4), izquierda: num(zona.izquierda, 'formato.zonaSegura.izquierda', 0, 0.4), derecha: num(zona.derecha, 'formato.zonaSegura.derecha', 0, 0.4) } } : {}) },
    fases: { historias: fases.historias as boolean, storyboard: fases.storyboard as boolean, desdeTranscripcion: fases.desdeTranscripcion as boolean },
    brief: {
      preguntas: list(brief.preguntas, 'brief.preguntas', 12, (item, path) => { const q = obj(item, path, ['id', 'pregunta']); return { id: unique(slugOf(q.id, path + '.id'), path), pregunta: str(q.pregunta, path + '.pregunta', 400) }; }),
      resuelto: Object.fromEntries(Object.entries(resuelto).map(([key, value]) => [key, str(value, 'brief.resuelto.' + key, 600)])),
    },
    estructura: list(r.estructura, 'estructura', 24, (item, path) => {
      const s = obj(item, path, ['id', 'nombre', 'proposito', 'duracion', 'frase']);
      if (typeof s.frase !== 'boolean') fail(path + '.frase', 'true o false.');
      return { id: unique(slugOf(s.id, path + '.id'), path), nombre: str(s.nombre, path + '.nombre', 80), proposito: str(s.proposito, path + '.proposito', 400), duracion: range(s.duracion, path + '.duracion', 7200), frase: s.frase as boolean };
    }),
    estilo: list(r.estilo, 'estilo', 40, regla), sonido: list(r.sonido, 'sonido', 24, regla), ritmo: list(r.ritmo, 'ritmo', 24, regla),
    referencias: list(r.referencias, 'referencias', 16, (item, path) => { const ref = obj(item, path, ['fuente', 'tomar']); return { fuente: str(ref.fuente, path + '.fuente', 600), tomar: str(ref.tomar, path + '.tomar', 600) }; }),
    fijo: list(r.fijo, 'fijo', 24, (item, path) => str(item, path, 400)), variable: list(r.variable, 'variable', 24, (item, path) => str(item, path, 400)),
    controles: list(r.controles, 'controles', 24, (item, path) => { const c = obj(item, path, ['id', 'regla', 'confianza']); return { id: unique(slugOf(c.id, path + '.id'), path), regla: str(c.regla, path + '.regla', 400), confianza: oneOf(c.confianza, path + '.confianza', CONFIANZAS) }; }),
  };
  if (!receta.estructura.length) fail('estructura', 'se necesita al menos una sección.');
  return receta;
}

export type RecetaRef = { slug: string; nombre: string; tipo: string; descripcion: string; fabrica: boolean; revision: number; dir: string };

async function recetasEn(root: string | undefined, fabrica: boolean): Promise<(RecetaRef & { receta: Receta })[]> {
  if (!root) return [];
  const found: (RecetaRef & { receta: Receta })[] = [];
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    try {
      const receta = validarReceta(JSON.parse(await readFile(join(dir, RECETA_FILE), 'utf8')));
      found.push({ slug: receta.slug, nombre: receta.nombre, tipo: receta.tipo, descripcion: receta.descripcion, fabrica, revision: receta.revision, dir, receta });
    } catch { /* Not a recipe, or a broken one: skills folders hold both. */ }
  }
  return found;
}

/** Factory recipes from the bundled docs, personal ones from the skills folder; a personal recipe shadows a factory one with its slug. */
export async function todasLasRecetas(docsDir?: string, personalDir?: string) {
  const fabrica = await recetasEn(docsDir && join(docsDir, 'recetas'), true);
  const personales = await recetasEn(personalDir, false);
  const bySlug = new Map(fabrica.map(item => [item.slug, item]));
  for (const item of personales) bySlug.set(item.slug, item);
  return [...bySlug.values()].sort((a, b) => Number(a.fabrica) - Number(b.fabrica) || a.nombre.localeCompare(b.nombre));
}

export const recetaHash = (receta: Receta) => createHash('sha256').update(JSON.stringify(receta)).digest('hex').slice(0, 16);

/** The SKILL.md that makes a personal recipe a draggable skill. */
export function recetaSkill(receta: Receta): string {
  const lines = (title: string, rules: Regla[]) => rules.length ? `\n## ${title}\n${rules.map(rule => `- ${rule.texto} (${rule.confianza})`).join('\n')}\n` : '';
  return `---\nname: ${receta.slug}\ndescription: ${JSON.stringify(`Receta «${receta.nombre}»: ${receta.descripcion}`)}\n---\n\n# Receta: ${receta.nombre}\n\n${receta.cuandoUsar}\n\n` +
    `Para un video nuevo con esta receta: \`syka_receta action:usar slug:${receta.slug}\`, después seguí \`syka_plan\` fase por fase. La receta completa está en ${RECETA_FILE}; este archivo es un resumen.\n\n` +
    `## Estructura\n${receta.estructura.map(s => `- **${s.nombre}** (${s.duracion.min}–${s.duracion.max} s): ${s.proposito}`).join('\n')}\n` +
    lines('Estilo', receta.estilo) + lines('Sonido', receta.sonido) + lines('Ritmo', receta.ritmo) +
    (receta.controles.length ? `\n## Controles\n${receta.controles.map(c => `- ${c.regla}`).join('\n')}\n` : '');
}

/** Writes a personal recipe; the previous revision is kept in historial/. */
export async function guardarReceta(personalDir: string, receta: Receta, nota: string): Promise<{ dir: string; revision: number }> {
  const dir = join(personalDir, receta.slug);
  await mkdir(join(dir, 'historial'), { recursive: true });
  const previous = await readFile(join(dir, RECETA_FILE), 'utf8').catch(() => null);
  if (previous) {
    const old = validarReceta(JSON.parse(previous));
    if (receta.revision <= old.revision) throw Error(`La receta ya está en la revisión ${old.revision}; guardá la ${old.revision + 1} a partir de la última leída.`);
    await writeFile(join(dir, 'historial', `revision-${old.revision}.json`), previous);
  } else if (receta.revision !== 1) throw Error('Una receta nueva empieza en la revisión 1.');
  const atomic = async (name: string, content: string) => { const tmp = join(dir, `.${name}.${randomUUID()}.tmp`); await writeFile(tmp, content); await rename(tmp, join(dir, name)); };
  await atomic(RECETA_FILE, JSON.stringify(receta, null, 2) + '\n');
  await atomic('SKILL.md', recetaSkill(receta));
  const log = await readFile(join(dir, 'historial.md'), 'utf8').catch(() => `# Historial de «${receta.nombre}»\n`);
  await atomic('historial.md', `${log.trimEnd()}\n\n## Revisión ${receta.revision} · ${new Date().toISOString().slice(0, 10)}\n${nota.trim()}\n`);
  return { dir, revision: receta.revision };
}
