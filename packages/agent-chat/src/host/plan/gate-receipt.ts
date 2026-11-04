/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The gate's receipt: what it judged, and the exact source it judged. A
// delivery is "ready" only while the receipt passed and the source has not
// changed since; any edit after the gate needs the gate again.

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

/** The visible folder a video's plan and receipts live in, beside "01 Crudos". */
export const PLAN_DIR = '00 Plan';
export const RECEIPT_FILE = 'gate.json';
const SOURCE = /\.(tsx?|jsx?|css|json)$/i;
const SKIP = new Set(['node_modules', 'cache', '.syka', PLAN_DIR, '01 Crudos', '02 Finales', '03 Assets reutilizables', '90 Descartable', 'assets']);

export type GateReceipt = { version: 1; passed: boolean; at: string; scene: string; errors: number; warnings: number; codes: string[]; source: string };

/** One hash over the composition's code: the entry plus any components it imports. */
export async function sourceHash(dir: string): Promise<string> {
  const files: string[] = [];
  const walk = async (folder: string, depth: number) => {
    for (const entry of await readdir(folder, { withFileTypes: true }).catch(() => [])) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) { if (depth < 4 && !SKIP.has(entry.name) && !entry.name.startsWith('.')) await walk(path, depth + 1); }
      else if (SOURCE.test(entry.name) && !/^(package(-lock)?|tsconfig)\.json$/i.test(entry.name)) files.push(path);
    }
  };
  await walk(dir, 0);
  const hash = createHash('sha256');
  for (const file of files.sort()) hash.update(relative(dir, file).replaceAll('\\', '/')).update('\0').update(await readFile(file)).update('\0');
  return hash.digest('hex');
}

type GateResult = { passed?: unknown; issues?: unknown };
export async function writeGateReceipt(dir: string, scene: string, result: unknown): Promise<GateReceipt | null> {
  const value = result as GateResult;
  if (!value || typeof value.passed !== 'boolean' || !Array.isArray(value.issues)) return null;
  const issues = value.issues as { code?: string; severity?: string }[];
  const receipt: GateReceipt = { version: 1, passed: value.passed, at: new Date().toISOString(), scene,
    errors: issues.filter(issue => issue.severity === 'error').length, warnings: issues.filter(issue => issue.severity === 'warning').length,
    codes: [...new Set(issues.map(issue => String(issue.code)))], source: await sourceHash(dir) };
  const folder = join(dir, PLAN_DIR);
  await mkdir(folder, { recursive: true });
  const temporary = join(folder, `.${RECEIPT_FILE}.${process.pid}.tmp`);
  await writeFile(temporary, JSON.stringify(receipt, null, 2) + '\n');
  await rename(temporary, join(folder, RECEIPT_FILE));
  return receipt;
}

export async function readGateReceipt(dir: string): Promise<GateReceipt | null> {
  try { const value = JSON.parse(await readFile(join(dir, PLAN_DIR, RECEIPT_FILE), 'utf8')) as GateReceipt; return value?.version === 1 ? value : null; }
  catch { return null; }
}

/** The plan's scene lines for the gate to find on screen; none without a plan. */
type Margins = { top: number; bottom: number; left: number; right: number };
export async function planLines(dir: string): Promise<{ id: string; text: string; start: number; end: number; layer?: string; margins?: Margins }[]> {
  try {
    const plan = JSON.parse(await readFile(join(dir, PLAN_DIR, 'plan.json'), 'utf8')) as {
      escenas?: { id: string; frase: string; inicio: number; fin: number; capa?: string }[];
      formato?: { zonaSegura?: { arriba: number; abajo: number; izquierda: number; derecha: number } };
    };
    const zone = plan.formato?.zonaSegura;
    const margins = zone ? { top: zone.arriba, bottom: zone.abajo, left: zone.izquierda, right: zone.derecha } : undefined;
    return (plan.escenas ?? []).filter(scene => typeof scene.frase === 'string' && scene.frase.trim())
      .map(scene => ({ id: scene.id, text: scene.frase, start: scene.inicio, end: scene.fin, ...(scene.capa ? { layer: scene.capa } : {}), ...(margins ? { margins } : {}) }));
  } catch { return []; }
}

/** How long the plan's recipe lets the whole frame stand still; undefined keeps the gate's default. */
export async function planStillMax(dir: string): Promise<number | undefined> {
  try {
    const plan = JSON.parse(await readFile(join(dir, PLAN_DIR, 'plan.json'), 'utf8')) as { formato?: { quietoMaximo?: number } };
    const value = plan.formato?.quietoMaximo;
    return typeof value === 'number' && value >= 1 && value <= 30 ? value : undefined;
  } catch { return undefined; }
}

/** Why the current source has no passing gate, or null when it has one. */
export async function gateBlocker(dir: string): Promise<string | null> {
  const receipt = await readGateReceipt(dir);
  if (!receipt) return 'Falta correr gate sobre la escena terminada.';
  if (!receipt.passed) return `El último gate falló (${receipt.errors} error${receipt.errors === 1 ? '' : 'es'}: ${receipt.codes.join(', ')}). Corregí y volvé a correrlo.`;
  if (receipt.source !== await sourceHash(dir)) return 'El código cambió después del último gate. Volvé a correr gate sobre la versión final.';
  return null;
}
