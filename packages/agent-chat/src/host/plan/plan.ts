/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// A video's plan: the recipe it follows plus this video's brief, scenes,
// sound and notes. It lives in "00 Plan/plan.json", is the memory a new chat
// reads, and decides which phase the video is in. Building starts only once
// the plan holds; a delivery is ready only with a passing gate on the final
// source (see gate-receipt.ts).

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PLAN_DIR } from './gate-receipt';
import type { Receta } from './receta';

export const PLAN_FILE = 'plan.json';
/** general: the whole window or a wide shot; panel: one pane, or a person waist up (plano-medio); primer-plano: one control, or a face. */
export const DISTANCIAS = ['general', 'panel', 'plano-medio', 'primer-plano'] as const;
export const MOVIMIENTOS = ['quieto', 'acercar', 'alejar', 'paneo', 'corte', 'cursor'] as const;
export const COSTURAS = ['corte-en-movimiento', 'corte-seco', 'morph', 'coincidencia', 'fundido'] as const;
export const SONIDOS = ['musica', 'efectos', 'musica+efectos', 'voz', 'existente', 'silencio'] as const;
export const ASSETS = ['captura', 'construido', 'compartido', 'generado', 'material'] as const;

export type Plano = { at: number; distancia: typeof DISTANCIAS[number]; pantalla: string; movimiento: typeof MOVIMIENTOS[number]; destino?: string };
export type Escena = {
  id: string; inicio: number; fin: number; seccion?: string;
  /** Up to six words, shown whole; "" for a wordless scene. */
  frase: string; capa?: string; imagen: string;
  planos: Plano[]; costura: { tipo: typeof COSTURAS[number]; segundo?: number };
  assets: { que: string; tipo: typeof ASSETS[number]; ruta?: string; listo: boolean }[];
};
export type Historia = { nombre: string; recurso: string; forma: string; inicio: string; recorrido: string };
export type Plan = {
  version: 1;
  receta: { slug: string; nombre: string; revision: number; hash: string };
  formato: Receta['formato'];
  storyboard: boolean;
  brief: Record<string, string>;
  historias: Historia[];
  elegida: { indice: number; por: 'usuario' | 'delegado'; palabras?: string } | null;
  duracion: number | null;
  escenas: Escena[];
  sonido: { modo: typeof SONIDOS[number]; tema?: { ruta: string; fuente: string; licencia: string }; bpm?: number; beats?: number[] } | null;
  marca: string | null;
  aprobacion: { palabras: string; at: string } | null;
  notas: { pedido: string; cambio: string; at: string }[];
  /** Recorded footage and its real transcript, for recipes built from a recording. */
  material?: { fuente: string; transcripcion: string } | null;
  /** The notes the app last offered to turn into a recipe, so the same offer is not repeated. */
  ofertaReceta?: string;
};

export type Fase = 'brief' | 'material' | 'historias' | 'escenas' | 'storyboard' | 'construir';

export function nuevoPlan(receta: Receta, hash: string, storyboard = receta.fases.storyboard): Plan {
  return { version: 1, receta: { slug: receta.slug, nombre: receta.nombre, revision: receta.revision, hash }, formato: receta.formato, storyboard,
    brief: { ...receta.brief.resuelto }, historias: [], elegida: null, duracion: null, escenas: [], sonido: null, marca: null, aprobacion: null, notas: [] };
}

/** Brief questions the recipe asks that this video has not answered yet. */
export function briefPendiente(plan: Plan, receta: Receta): { id: string; pregunta: string }[] {
  return [{ id: 'idea', pregunta: '¿Cuál es la única idea que el espectador tiene que llevarse?' }, ...receta.brief.preguntas]
    .filter(question => !plan.brief[question.id]?.trim());
}

export function faseActual(plan: Plan, receta: Receta): Fase {
  if (briefPendiente(plan, receta).length) return 'brief';
  if (receta.fases.desdeTranscripcion && !plan.material) return 'material';
  if (receta.fases.historias && !plan.elegida) return 'historias';
  if (!plan.escenas.length || validarEscenas(receta, plan.escenas, plan.duracion, plan.sonido, plan.marca).errores.length) return 'escenas';
  if (plan.storyboard && !plan.aprobacion) return 'storyboard';
  return 'construir';
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Recipe controls the plan can check by itself, by id; the rest are for the agent and the gate to keep. */
const CONTROLES: Record<string, (escenas: Escena[], marca: string | null) => string | null> = {
  'ui-legible': escenas => {
    const flat = escenas.filter(scene => scene.seccion === 'demo' && !scene.planos.some(p => p.distancia !== 'general'));
    return flat.length ? `las escenas de demo ${flat.map(s => s.id).join(', ')} solo tienen planos generales; sumá un panel o un primer plano del control.` : null;
  },
  'logo-al-final': (escenas, marca) => {
    const index = escenas.findIndex(scene => scene.id === marca);
    return index >= 0 && index < escenas.length - 2 ? `el logo aterriza en ${marca}, que no es la última ni la anteúltima escena.` : null;
  },
  // Motion graphics cut while both sides move; a talking head lives on jump cuts, so its recipe leaves this out.
  'cortes-en-movimiento': escenas => {
    const seams = escenas.slice(0, -1), hard = seams.filter(scene => scene.costura.tipo === 'corte-seco').length;
    return seams.length >= 3 && hard > seams.length / 3 ? `${hard} de ${seams.length} costuras son cortes secos; como máximo un tercio, el resto corta en movimiento o se transforma.` : null;
  },
  'gancho-inmediato': escenas => {
    const hook = escenas[0];
    return hook && (hook.fin - hook.inicio > 3 || !hook.frase) ? 'la primera escena tiene que enganchar con una frase en los primeros 3 segundos.' : null;
  },
};
const id = /^[a-z0-9][a-z0-9-]{0,40}$/;

/** Every problem at once, so the agent fixes the plan in one pass; warnings never block. */
export function validarEscenas(receta: Receta, escenas: unknown, duracion: unknown, sonido: unknown, marca: unknown): { errores: string[]; avisos: string[]; escenas: Escena[] } {
  const errores: string[] = [], avisos: string[] = [];
  const out: Escena[] = [];
  if (!Array.isArray(escenas) || !escenas.length || escenas.length > 64) return { errores: ['escenas: se necesitan entre 1 y 64 escenas.'], avisos, escenas: out };
  const total = typeof duracion === 'number' && Number.isFinite(duracion) && duracion > 0 ? duracion : NaN;
  if (Number.isNaN(total)) errores.push('duracion: se necesita la duración total en segundos.');
  else if (total < receta.formato.duracion.min || total > receta.formato.duracion.max) avisos.push(`La duración ${total} s queda fuera del rango de la receta (${receta.formato.duracion.min}–${receta.formato.duracion.max} s).`);
  const seen = new Set<string>(), secciones = new Set(receta.estructura.map(s => s.id));
  escenas.forEach((raw, index) => {
    const at = `escenas[${index}]`;
    const e = (raw ?? {}) as Record<string, unknown>;
    const text = (key: string, required = true) => { const v = e[key]; if (typeof v !== 'string' || (required && !v.trim())) { errores.push(`${at}.${key}: se necesita texto.`); return ''; } return v.trim(); };
    const sceneId = text('id');
    if (sceneId && !id.test(sceneId)) errores.push(`${at}.id: minúsculas, números y guiones.`);
    if (seen.has(sceneId)) errores.push(`${at}.id: repetido.`); seen.add(sceneId);
    const inicio = Number(e.inicio), fin = Number(e.fin);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) errores.push(`${at}: inicio y fin en segundos, con fin mayor que inicio.`);
    const frase = typeof e.frase === 'string' ? e.frase.trim() : (errores.push(`${at}.frase: texto ("" si no lleva).`), '');
    if (words(frase) > 6) errores.push(`${at}.frase: «${frase}» tiene ${words(frase)} palabras; hasta 6.`);
    if (/[.…]$/.test(frase)) errores.push(`${at}.frase: sin punto final.`);
    const seccion = typeof e.seccion === 'string' ? e.seccion : undefined;
    if (seccion && !secciones.has(seccion)) errores.push(`${at}.seccion: «${seccion}» no está en la receta (${[...secciones].join(', ')}).`);
    const imagen = text('imagen');
    const planos: Plano[] = [];
    if (!Array.isArray(e.planos) || !e.planos.length) errores.push(`${at}.planos: al menos un plano.`);
    else e.planos.forEach((p, i) => {
      const plano = (p ?? {}) as Record<string, unknown>, pat = `${at}.planos[${i}]`;
      const t = Number(plano.at);
      if (!Number.isFinite(t) || t < inicio || t > fin) errores.push(`${pat}.at: dentro de la escena (${inicio}–${fin} s).`);
      if (!(DISTANCIAS as readonly string[]).includes(String(plano.distancia))) errores.push(`${pat}.distancia: ${DISTANCIAS.join(' | ')}.`);
      if (!(MOVIMIENTOS as readonly string[]).includes(String(plano.movimiento))) errores.push(`${pat}.movimiento: ${MOVIMIENTOS.join(' | ')}.`);
      if (['acercar', 'alejar', 'paneo', 'cursor'].includes(String(plano.movimiento)) && !(typeof plano.destino === 'string' && plano.destino.trim())) errores.push(`${pat}.destino: un ${plano.movimiento} tiene que llegar a algo (el control, el resultado).`);
      if (typeof plano.pantalla !== 'string' || !plano.pantalla.trim()) errores.push(`${pat}.pantalla: qué se ve.`);
      planos.push({ at: t, distancia: plano.distancia as Plano['distancia'], pantalla: String(plano.pantalla ?? ''), movimiento: plano.movimiento as Plano['movimiento'], ...(typeof plano.destino === 'string' ? { destino: plano.destino } : {}) });
    });
    const costura = (e.costura ?? {}) as Record<string, unknown>;
    if (!(COSTURAS as readonly string[]).includes(String(costura.tipo))) errores.push(`${at}.costura.tipo: ${COSTURAS.join(' | ')}.`);
    const assets = Array.isArray(e.assets) ? e.assets.map((a, i) => {
      const asset = (a ?? {}) as Record<string, unknown>;
      if (typeof asset.que !== 'string' || !(ASSETS as readonly string[]).includes(String(asset.tipo)) || typeof asset.listo !== 'boolean') errores.push(`${at}.assets[${i}]: que, tipo (${ASSETS.join(' | ')}) y listo.`);
      return { que: String(asset.que ?? ''), tipo: asset.tipo as Escena['assets'][number]['tipo'], listo: asset.listo === true, ...(typeof asset.ruta === 'string' ? { ruta: asset.ruta } : {}) };
    }) : (errores.push(`${at}.assets: lista ([] si no necesita).`), []);
    out.push({ id: sceneId, inicio, fin, ...(seccion ? { seccion } : {}), frase, ...(typeof e.capa === 'string' && e.capa.trim() ? { capa: e.capa.trim() } : {}), imagen, planos,
      costura: { tipo: costura.tipo as Escena['costura']['tipo'], ...(Number.isFinite(Number(costura.segundo)) && costura.segundo !== undefined ? { segundo: Number(costura.segundo) } : {}) }, assets });
  });
  // Contiguous from 0 to the total, as the gate reads them.
  out.forEach((scene, index) => {
    const expected = index === 0 ? 0 : out[index - 1]!.fin;
    if (Number.isFinite(scene.inicio) && Math.abs(scene.inicio - expected) > 0.05) errores.push(`escenas[${index}].inicio: ${scene.inicio} s; tiene que empezar donde termina la anterior (${expected} s).`);
  });
  const last = out.at(-1);
  if (last && !Number.isNaN(total) && Math.abs(last.fin - total) > 0.05) errores.push(`La última escena termina en ${last.fin} s y la duración es ${total} s.`);
  const audio = (sonido ?? null) as Record<string, unknown> | null;
  if (!audio || !(SONIDOS as readonly string[]).includes(String(audio.modo))) errores.push(`sonido.modo: ${SONIDOS.join(' | ')}.`);
  else if (String(audio.modo).startsWith('musica')) {
    const tema = audio.tema as Record<string, unknown> | undefined;
    if (!tema || typeof tema.ruta !== 'string' || typeof tema.licencia !== 'string') avisos.push('La música todavía no tiene tema elegido (ruta y licencia): elegilo antes de animar, así los cortes caen en sus golpes.');
    if (!Array.isArray(audio.beats) || !audio.beats.length) avisos.push('Faltan los golpes medidos del tema (syka_audio_analyze): sin ellos los cortes no se pueden colgar del ritmo.');
  }
  if (typeof marca === 'string' && marca && !seen.has(marca)) errores.push(`marca: «${marca}» no es una escena.`);
  if (receta.tipo === 'lanzamiento' && !marca) errores.push('marca: indicá la escena donde aterriza el logo.');
  for (const section of receta.estructura) if (!out.some(scene => scene.seccion === section.id)) avisos.push(`Ninguna escena cubre la sección «${section.nombre}» de la receta.`);
  for (const control of receta.controles) {
    const check = CONTROLES[control.id];
    const problem = check?.(out, typeof marca === 'string' ? marca : null);
    if (problem) errores.push(`Control «${control.id}» de la receta: ${problem}`);
  }
  return { errores, avisos, escenas: out };
}

export async function leerPlan(dir: string): Promise<Plan | null> {
  try { const plan = JSON.parse(await readFile(join(dir, PLAN_DIR, PLAN_FILE), 'utf8')) as Plan; return plan?.version === 1 ? plan : null; }
  catch { return null; }
}

export async function guardarPlan(dir: string, plan: Plan): Promise<string> {
  const folder = join(dir, PLAN_DIR);
  await mkdir(folder, { recursive: true });
  const temporary = join(folder, `.${PLAN_FILE}.${process.pid}.tmp`);
  await writeFile(temporary, JSON.stringify(plan, null, 2) + '\n');
  await rename(temporary, join(folder, PLAN_FILE));
  return `${PLAN_DIR}/${PLAN_FILE}`;
}
